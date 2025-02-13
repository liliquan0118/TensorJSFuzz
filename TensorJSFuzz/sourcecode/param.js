constants=require("./constants")
const assert = require('assert')
const util=require("./util")
const mathjs=require("mathjs")
const mutator=require("./param_utill").Mutator
const Range=require("./param_utill").Range
const Param_Category=["NUM","STR","BOOL","COMPLEX"];

var typedarray=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array]

class Param {

    reset_shape_var(){
        this.shape_var={};
        return 0;

    }
    constructor(name, params_info,constraints, dtype_map, guided_mutate=false, special_value=false) {
        this.can_disobey_dtype=false;
        this.can_disobey_ndim=false;
        this.can_disobey_shape = false;
        this.can_disobey_range = false;
        this.can_disoeby_enum = false;
        this.can_disobey = false;  //# will logical OR all can_disobey_*
        this.shape_dep = false;
        this.range_dep = false;
        this.shape_var={};
        this.default = null;
        this.data = null;
        this.structure=null;
        this.rank = null;
        this.valid_dtypes = null;
        this.list_len=null;
        this.enumv=null;

        this.pick_structure = null;
        this.pick_rank = null;
        this.pick_dtype = null;
        this.pick_enumv = null;
        this.shape_spec = null;
        this.pick_len=null;
        this.name = name;
        this.curr_range={};
        this.spec = params_info;           //  # NOTE: potentially be None
        this._process_spec();
        this.constraints=constraints;
        this.shape=null;
        // this.can_disobey = this.can_disobey_ndim || this.can_disobey_dtype || this.can_disobey_shape || this.can_disobey_range || this.can_disoeby_enum;
        this.mutator = new mutator(this.guided_mutate, this.special_value);
        this.pick_structure=null;
        return 0;
    }

    _process_spec(){
        if (! this.spec)
            return 0;
        // # spec exists
        this._parse_structure();
        this._parse_rank();
        this._parse_dtype();
        this._parse_len();
        this._parse_enumv();
        return 0;
    }

    _parse_structure() {
        this.structure = this.spec['structure'];
    }
    _parse_rank() {
            if (!('rank' in this.spec)) {        //:  # NOTE: when this happens, no way to dis-obey constraints
                this.rank = [];  //# leave it to the fuzzer to pass the default list to generator
                return 0;
            }
            var valid_rank = new Set();
            var rank_spec = this.spec['rank'];
            if (! (rank_spec instanceof Array))
                console.error('"rank" spec should be a list');
            for (var rank_str of this.spec['rank'])
                    valid_rank.add(rank_str);
            this.rank = Array.from(valid_rank);
            return 0;
    }
    _parse_dtype(){
        if(!('dtype' in this.spec)){
            // # NOTE: when this happens, no way to dis-obey constraints
            this.valid_dtypes = null;    //  # None here, so leave the job to the fuzzer to pass the default list to generator
            return 0;
        }
        this.valid_dtypes = this.spec["dtype"];
    }
    _parse_len(){
        if(!('len' in this.spec)){
            // # NOTE: when this happens, no way to dis-obey constraints
            this.list_len = null;    //  # None here, so leave the job to the fuzzer to pass the default list to generator
            return 0;
        }
        this.list_len = this.spec["len"];
    }
    _parse_enumv(){
        if(!('enumv' in this.spec)){
            // # NOTE: when this happens, no way to dis-obey constraints
            this.enumv = null;    //  # None here, so leave the job to the fuzzer to pass the default list to generator
            return 0;
        }
        this.enumv = this.spec["enumv"];
    }

    process_shape_dep(shape_spec){
        if (!shape_spec || shape_spec[0] === '[' && shape_spec.charAt(shape_spec.length-1)=== ']')
            shape_spec = shape_spec.slice(1,-1);  //# remove '[]'
        shape_spec = shape_spec.replace(/\s+/g, '')  //# remove space
        var shape_toks = shape_spec.split(/[,|\+|-|\*|]/);
        var const_dep,var_dep;
        [const_dep, var_dep] = this.process_shape_toks(shape_toks);
        return[var_dep, const_dep];
    }

    process_shape_toks(shape_toks) {
        var var_dep = [];
        var const_dep = [];
        for (var tok of shape_toks){
            var _, ref, is_var;
            while (tok!==''){
                if (!tok)
                    console.error(`invalid shape spec ${tok}`);
                if (!isNaN(tok))        //do nothing
                    break;
                // # maybe a non-integral numeric value
                else if(util.is_float(tok)){
                    console.error(`shape value cannot be a float number ${tok}`);
                    tok='';
                }
                else if(tok[0]==='>' || tok[0]==='<'){
                    [ref, is_var] = util.gobble_unequal_sign(tok);
                    tok='';
                }
                else if(tok[0]==='&'){
                    // # depends on another var and that var has to be 0D int
                    // [ref, is_var] = [tok.slice(1),true]
                    [_, ref, is_var] = util.gobble_var_dep(tok, '');
                }
                else if(tok[0] === '.'){
                    //uncertain number of dimensions
                    break;
                }
                else if (tok.includes('len:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'len:');
                    if(!is_var){
                        console.error(`expect ${ref} in "len:xx" a variable, rather than a constant`);
                    }
                }
                else if (tok.includes('ndim:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'ndim:');
                    if(!is_var){
                        console.error(`expect ${ref} in "ndim:xx" a variable, rather than a constant`);
                    }
                }
                else if (tok.includes('ndimre1:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'ndimre1:');
                    if(!is_var){
                        console.error(`expect ${ref} in "ndim:xx" a variable, rather than a constant`);
                    }
                }
                else if (tok.includes('max_value:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'max_value:');
                    if(!is_var){
                        console.error(`expect ${ref} in "max_value:xx" a variable, rather than a constant`);
                    }
                }
                else if (tok.includes('shapen:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'shapen:');
                }
                else if (tok.includes('index:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'index:');
                }
                else if (tok.includes('shape:')){
                    [_, ref, is_var] = util.gobble_var_dep(tok, 'shape:');
                    if(!is_var){
                        console.error(`expect ${ref} in "shape:xx" a variable, rather than a constant`);
                    }
                }
                // else                 # referring to another constant value e.g. [batch_size,num_labels]
                else
                    [_, ref, is_var] = util.gobble_var_dep(tok);

                if (ref!=null){
                    if (is_var)
                        var_dep.push(ref);
                    else const_dep.push(ref);
                }
                tok=_;
            }

        }
        return [const_dep,var_dep];
    }



    _parse_enum(){
        if ('enum' in this.spec){
            this.can_disoeby_enum = true;
            this.choices = this.spec['enum']
        }
        return 0;
    }

    _parse_range(){
        if (!('range' in this.spec))
            return 0;
        this.can_disobey_range = true;
        var range_str_list = this.spec['range']
        assert(range_str_list instanceof Array);
        var range_spec_list = []
        for (var range_str of range_str_list){
            var for_dtype = 'all';
            if (range_str.includes(':') && !range_str.includes('ndim:') && !range_str.includes('len:') && !range_str.includes('dtype:') && !range_str.includes('max_value:'))
            {
                // # special form, e.g., int:[0, inf)
                for_dtype = range_str.split(':')[0];
                range_str = range_str.split(':')[1];
            }
            range_spec_list.push(this._process_range_str(for_dtype, range_str));
        }
        this.range_choices = range_spec_list;
    }

    _process_range_str(for_dtype, range_str){
        if (!('(['.includes(range_str[0])) || !('])'.includes(range_str[range_str.length-1])))
            console.error(`invalid range spec ${range_str} for param ${this.name}`)
        var lower_bound_inclusive;
        if (range_str[0] === '[')
            lower_bound_inclusive= true;
        else
            lower_bound_inclusive= false;
        // # starting from index 1, get the lower bound string
        var lower_bound_str, next_start_idx;
        [lower_bound_str, next_start_idx] = util.gobble_until(1, range_str, ',');
        var lower_bound_value, lower_bound_dep;
        [lower_bound_value, lower_bound_dep] = this._process_bound_str(lower_bound_str);
        var upper_bound_inclusive;
        if (range_str[range_str.length-1] === ']')
            upper_bound_inclusive= true;
        else
            upper_bound_inclusive= false;
        // # starting from the next_start_idx, get the upper bound string
        var upper_bound_str, _;
        [upper_bound_str, _] = util.gobble_until(next_start_idx, range_str, ')]');
        var upper_bound_value, upper_bound_dep;
        [upper_bound_value, upper_bound_dep] = this._process_bound_str(upper_bound_str);
        if (lower_bound_value !=null && upper_bound_value !=null && lower_bound_value > upper_bound_value) {
            console.error(`Error: upper bound should be greater than the lower bound${range_str}` );
            system.exit(1);
        }
        // # bound value can be none
        return new Range(range_str, for_dtype, lower_bound_value, upper_bound_value, lower_bound_dep, upper_bound_dep,
            lower_bound_inclusive, upper_bound_inclusive);
    }


    _process_bound_str(bound_str){
        var bound_value, bound_dep;
        if (!util.str_is_number(bound_str)){
            var operands = this._find_dependency(bound_str);
            for(var o of operands) {
                if (o == '' || util.str_is_number(o))
                    continue;
                else if (o[0] == '&')
                    this.var_dep.add(o.slice(1));
                else
                    this.const_dep.add(o);
            bound_value = null;
            bound_dep = bound_str;
            }
        }else{
            bound_value = util.convert_to_num(bound_str);
            bound_dep = null;
        }
        return [bound_value, bound_dep];
    }


    _find_dependency(s){
        /* """
       this function tries to figure out the dependencies and returns a list of operands
       :param s: given string expression (should only contain +-*\/ and the special operations such as ndim:
            :return: a list of operands (e.g., -ndim:&a+1 will return ['', '&a', '1']
             */
        var operators = ['+', '-', '*', '/'];
        var sp_operators = ['ndim:', 'len:', 'max_value:', 'dtype:','shapen:','ndimre1:']
        var operands = [];
        var str_buff = '';
        for (var c of s){
            if (operators.includes(c)){
                operands.push(str_buff);  //# NOTE: could be ''
                str_buff = '';
            }else {
                str_buff += c;
                if ( sp_operators.includes(str_buff))
                    str_buff = '';
            }
        }
        operands.push(str_buff);
        return operands;
    }


    can_disobey_cat(){
        // assert self.can_disobey, 'Fuzzer Bug: selected a parameter that cannot violate constraints'
        var categories = [];
        if (this.can_disobey_shape || this.can_disobey_ndim)
            categories.push('ndim');
        if(this.can_disobey_dtype)
            categories.push('dtype');
        if(this.can_disobey_range)
            categories.push('range');
        if (this.can_disoeby_enum)
            categories.push('enum');
        return categories;
    }
    gen_from_var_rank(){
            var gen_shape=this._gen_shape_from_rank(this.pick_rank);
            this.shape=gen_shape;
            var data = this.gen_var_from_shape(gen_shape, this.pick_dtype);
            this.data=data;
            return this.data;
    }
    gen_from_var_len(){
        var list_shape=[this.pick_len];
        this.shape=list_shape;
        var data = this.gen_var_from_shape(list_shape, this.pick_dtype);
        this.data=data;
        return this.data;
    }
    gen_from_var_value(){
        var gen_shape=this._gen_shape_from_rank(this.pick_rank);
        this.shape=gen_shape;
        var data = this.gen_var_from_shape(gen_shape, this.pick_dtype);
        this.data=data;
        return this.data;
    }
    gen_from_var_dtype(){
        var data;
        if(this.pick_structure==="Tensor"){
            data = this.gen_var_from_shape(this.shape, this.pick_dtype);
            this.data=data;
        }else if(this.pick_structure==="List"){
            data = this.gen_var_from_shape(this.shape, this.pick_dtype);
            this.data=data;
        }else if (this.pick_structure==="String"){
            if (this.pick_dtype==="Int"){
                this.data=~~(Math.random()*65);
                this.pick_structure="Int";
            }else {
                var pick_enumv=this._pick_enum();
                this.pick_enumv=pick_enumv;
                this.data=pick_enumv;
            }

        }else if(this.pick_structure==="Int"){
            if (this.pick_dtype==="String"){
                var pick_enumv_=this._pick_enum();
                this.pick_enumv=pick_enumv_;
                this.data=pick_enumv_;
                this.pick_structure="String";
            }else {
                this.data=~~(Math.random()*65);
            }
        }
        return this.data;
    }
    gen(){

        // # reset self.pick_dtype & self.pick_ndim
        this.pick_dtype = null;
        this.pick_rank = null;

        // console.log("gen");
        var pick_structure,pick_dtype,data;

        pick_structure=this._pick_structure();
        this.pick_structure=pick_structure;
        if(pick_structure==="Tensor"){
            var pick_rank=this._pick_rank();
            this.pick_rank=pick_rank;
            pick_dtype=this._pick_dtype();
            var gen_shape=this._gen_shape_from_rank(pick_rank);
            this.shape=gen_shape;
            data = this.gen_var_from_shape(gen_shape, pick_dtype);
            this.data=data;

        }else if(pick_structure==="List"){
            var pick_len=this._pick_len();
            pick_dtype=this._pick_dtype();
            var list_shape=[pick_len];
            this.shape=list_shape;
            data = this.gen_var_from_shape(list_shape, pick_dtype);
            this.data=data;
            this.pick_len=pick_len;
        }else if (pick_structure==="String"){
            pick_dtype="String";
            var pick_enumv=this._pick_enum();
            this.pick_enumv=pick_enumv;
            this.data=pick_enumv;
        }else if(pick_structure==="Int"){
            pick_dtype="Int";
            this.data=~~(Math.random()*65)+1;
        }
        this.pick_dtype=pick_dtype;
        return this.data;
    }

    convert_to_tensor(data, data_construct){
        if ((data===null) || data instanceof(String) || data instanceof (Number))
            return data;
        // assert self.tensor_t is None or isinstance(self.tensor_t, list), 'tensor_t needs to be either None or a list'

        // # there exist constraint, only call data_construct when tensor_t presents
        // # if the generated data is ndarray, better to convert
        if (this.tensor_t || data instanceof Array)
            data = data_construct(data);
        return data;
    }

    convert_typedarray(data,array_dtype,pick_ndim){

        console.log("convert_typedarray_begin");

        console.log(pick_ndim);
        // console.log(data)
        if (pick_ndim===1){
            console.log("convert_typedarray_end");
            return new array_dtype(data);
        }
        else if (pick_ndim===2){
            for (var l=0;l<data.length;l++)
                data[l]=new array_dtype(data[l]);
            console.log("convert_typedarray_end");
            return data;
        }
        else if (pick_ndim===3){
            for (l=0;l<data.length;l++)
                for (var l2=0;l2<data[0].length;l2++)
                    data[l][l2]=new array_dtype(data[l][l2]);
            console.log("convert_typedarray_end");
            return data;
        }
        else if (pick_ndim===4){
            // console.log(data.length,data[0].length,data[0][0].length,data[0][0][0].length)
            for (l=0;l<data.length;l++)
                for(l2=0;l2<data[0].length;l2++)
                    for(var l3=0;l3<data[0][0].length;l3++){
                        data[l][l2][l3]=new array_dtype(data[l][l2][l3]);
                    }

            console.log("convert_typedarray_end");
            return data;
        }
        else if (pick_ndim===5){
            for (l=0;l<data.length;l++)
                for(l2=0;l2<data[0].length;l2++)
                    for(l3=0;l3<data[0][0].length;l3++)
                        for(var l4=0;l4<data[0][0][0].length;l4++)
                        data[l][l2][l3][l4]=new array_dtype(data[l][l2][l3][l4]);
            console.log("convert_typedarray_end");
            return data;
        }

    }

    convert_structure(data, pick_ndim){
        if(this.spec==null)     //:  # no constraint
            return [data,false];
        var structure_spec = this.spec['structure'];
        if (pick_ndim!==0 && structure_spec.length!==0){
            var pick_structure=util.random_choice(structure_spec);
            this.pick_structure=pick_structure;
            // if (pick_structure==="TypedArray"){
            //     var pick_typedarray=util.random_choice(typedarray);
            //     this.pick_structure=pick_typedarray;
            //     try{
            //         var typedarray_data=this.convert_typedarray(data,pick_typedarray,pick_ndim);
            //     }
            //     catch (e) {
            //         console.log("typedarray_data_error");
            //         // console.log(data,pick_ndim,data.length)
            //         // console.log(data[0].length,data[0][0])
            //         // console.log(data,pick_ndim,data.length)
            //         console.log(e.message)
            //        throw e;
            //     }
            //
            //     return [typedarray_data,false];
            // }
            return [data,false];
        }
        // return [data,false];
        // var pick
        // var pick_typedarray=util.random_choice(typedarray);
        // if (structure_spec==null || (pick_ndim != 1) || data instanceof String)
        // // # only convert the data if pick_ndim is 1
        // // # this is because we currently only support structure like list/tuple
        // // # also, won't convert a string to list/tuple
        //     return [data, true];
        // assert(pick_ndim===1);
        // assert (structure_spec instanceof Array);
        // for (var each_spec of structure_spec){
        //     // if (each_spec.includes('Array') || util.is_iterable(data))    //:  # we simply convert the given data to a list
        //         return [data, false];
        //     // else if (each_spec.includes('tuple') || util.is_iterable(data))
        //     // return tuple(data), False  //# simply convert the given data to a tuple
        // }

        return [data, false];
    }


    _pick_dtype_ndim(obey, default_ndims, dtype_map, chosen_np_dtype){
        // console.log("_pick_dtype_ndim");
        var range_obey = true;
        var enum_obey = true;
        var pick_dtype;
        var pick_ndim;
        if (obey){
            // console.log("obey");
            pick_dtype = this._pick_obey_dtype(dtype_map, chosen_np_dtype);

            if (pick_dtype.includes('string'))     //  # NOTE: force string generation to be 0D
            // # TODO: also for bool
                pick_ndim = 0
            else {
                pick_ndim = this._pick_obey_ndim(default_ndims)

                // # if not self.required:  # optional parameter, default value exists
                // #     # perhaps we can learn something from the default values
                // #     pick_dtype, pick_ndim = self._decide_from_default(pick_dtype, pick_ndim)
            }
        }

        if (pick_dtype in dtype_map)    //:  # TODO: this check is bc inconsistent dtype representation from obey and dis-obey
            pick_dtype = dtype_map[pick_dtype];
        return [pick_dtype, pick_ndim, range_obey, enum_obey];
    }


    get_dtype_dep(dtype_str){
        // # TODO: the string matching below is specific to MXNet which returns in form of `<class 'numpy.float32'>`
        // var m = re.search('^<class \'(.*)\'>', dtype_str)
        // if m:           //# to make it consistent with the other 2 libraries, only take `numpy.float32`
        // dtype_str = m.group(1)
        var dtype;
        if (dtype_str.includes('dtype:')) {
            // # depends on another param
            [_, ref, is_var] = util.gobble_var_dep(dtype_str, 'dtype:');
            assert (is_var);
            dtype = this._gen_value_from_var_dep(ref, 'dtype', false);
        }
        else {
            dtype = dtype_str;
        }
        return dtype;
    }

    _pick_obey_dtype(dtype_map, chosen_np_dtype){
        var get_dtype_dep_func=this.get_dtype_dep;
        var get_package_dtype_name_func=this.get_package_dtype_name;
        function process_picked_dtype(dtype_str){
            var pick_dtype = get_dtype_dep_func(dtype_str);
            pick_dtype = get_dtype_dep_func(pick_dtype, dtype_map);
            assert (pick_dtype!=null);
            return pick_dtype;
        }
        if (chosen_np_dtype)
            return process_picked_dtype(chosen_np_dtype);
        var default_dtypes=[];
        for (var key in dtype_map){
            if (dtype_map[key]!=null)
                default_dtypes.push(key);
        }
        // # retry_times = 10
        // # while True:  # ensure the picked dtype has a numpy correspondence
        var pick_dtype;
        var index;
        if (this.valid_dtypes) {
            //  # constraints for dtype exist
            // # print(self.valid_dtypes)
            index=util.randInt(0,this.valid_dtypes.length-1,1)[0];
            pick_dtype = this.valid_dtypes[index];
        }
        else {
            //set pick_dtype=number???
            // # constraint doesn't exist for dtype

            // index=Math.floor((Math.random()*default_dtypes.length));
            // pick_dtype = default_dtypes[index];
            pick_dtype = "number";
        }
        return process_picked_dtype(pick_dtype);
    }


    check_dtype_dep(valid_dtypes){
        for(var t of valid_dtypes){
            if (t.includes('dtype:&'))
                return this.get_dtype_dep(t);
        }
        return null;
    }


    take_out_dtype_from(from_list, target){
        var tmp=[];
        for (var t of from_list){
            if (!t.includes(target))
                tmp.push(t);
        }
        return tmp;
    }


    _pick_disobey_dtype(dtype_map){
        function get_dtype_nbit(dtype_str){
            // # give int32, return (int, 32)
            var pat = /int|float|uint|complex([0-9]*)/
            var m = pat.exec(dtype_str);
            if (m){
                var dtype = m[1];
                var nbit;
                try{
                    nbit = parseInt(m[2]);
                }catch (e){
                    nbit= 0;
                }
                return [dtype, nbit];
            }
            return [null, null];
        }

        function check_disobey(pick_dtype, valid_dtypes){
            // # if int32 is a valid dtype, int16 is not a violation
            var pick_type, pick_nbit;
            [pick_type, pick_nbit]= get_dtype_nbit(pick_dtype);
            if (!pick_type)
                return true;

            for (var vd of valid_dtypes){
                var vd_type, vd_nbit;
                [vd_type, vd_nbit] = get_dtype_nbit(vd);
                if (!vd_type)
                    continue;
                if ((vd_type === pick_type) && (vd_nbit >= pick_nbit))
                    return false;
            }

            return true;
        }

        // util.DEBUG('trying to violate dtype constraint for %s' % self.name)
        var default_dtypes=[];
        for (var key in dtype_map){
            if (dtype_map[key]!=null)
                default_dtypes.push(key);
        }
        var pick_dtype;
        while(true){
            if (this.can_disobey_dtype){
                if (this.valid_dtypes === default_dtypes){
                    console.log('log: valid dtype == default dtypes; NO way to dis-obey the dtype constraint');
                    pick_dtype = util.random_choice(this.valid_dtypes);
                }
                else {
                    var dtype_dep = this.check_dtype_dep(this.valid_dtypes);
                    if (dtype_dep===null) {
                        //:  # no dtype dependency
                        pick_dtype = util.random_choice(Array.from(new Set(default_dtypes.filter(x=>!(this.valid_dtypes.includes(x))))));
                        console.log(`selected ${pick_dtype} to violate dtype constraint`);
                    }
                    else {
                        var dtype_choices = this.take_out_dtype_from(default_dtypes, dtype_dep);
                        if (!dtype_choices)
                            console.error('unable to violate dtype constraint');
                        pick_dtype = util.random_choice(dtype_choices);
                        console.error(`selected ${pick_dtype} to differ from dtype dep ${dtype_dep}`);
                    }
                }
            }
            else {
                console.error('no way to violate dtype constraint; selecting from default');
                pick_dtype = util.random_choice(default_dtypes);
            }

            if (pick_dtype in dtype_map && check_disobey(pick_dtype, this.valid_dtypes))
                return dtype_map[pick_dtype];
        }
    }


    _pick_dtype(){
        var pick_dtype;
        if (this.valid_dtypes){
            pick_dtype = util.random_choice(this.valid_dtypes);
            return pick_dtype;
        }
        else return null;
    }
    _pick_enum(){
        var pick_enum;
        if (this.enumv){
            pick_enum = util.random_choice(this.enumv);
            return pick_enum;
        }
        else return null;
    }
    _pick_len(){
        var pick_len;
        if (this.list_len){
            pick_len = util.random_choice(this.list_len);
            return pick_len;
        }
        else return null;
    }
    _pick_structure(){
        var pick_structure;
        if (this.structure){
            pick_structure = util.random_choice(this.structure);
            return pick_structure;
        }
        else return this._pick_dtype();;
    }
    _pick_rank(){
        var pick_rank;
        if (this.rank){
            pick_rank = util.random_choice(this.rank);
            if (!isNaN(pick_rank))
                return parseInt(pick_rank);
        }
    }


    _gen_value_from_var_dep(ref, relation, gen_shape=true){
        // assert ref in self.dep_param
        var dep_param_obj = this.dep_param[ref];
        if (relation === 'dtype'){
            try{
                // # print(dep_param_obj.data)
                if (dep_param_obj.data instanceof String)
                    return 'String';
                return dep_param_obj.data.dtype.toString();  //# return the string form of dtype
            }catch (e){
                    return typeof(dep_param_obj.data).split("'")[1];
            }
        }
        if (relation === 'index'){
            try{
                dep_param_obj = this.dep_param[ref[0]];
                return dep_param_obj.data.indexOf(ref[1])
            }catch (e){
                return typeof(dep_param_obj.data).split("'")[1];
            }
        }
        else if (relation === 'len'){
            try {
                return dep_param_obj.data.length;
            }catch (e) {
                console.error(`unable to get length of ${ref}`);
            }
        }
        else if (relation === 'ndim'){
            try {

                return dep_param_obj.pick_ndim;

            }catch (e) {
                // # not an object with 'ndim' attribute, check if it's just 0D value
                console.error(`not an object with 'ndim' attribute, check if it's just 0D value`);
            }
            try{
                var _ = dep_param_obj.data / 1;
                return 0;   //  # just a 0D numerical value
            }catch (e) {
                console.error(`not 0D`);
            }
            if (dep_param_obj.pick_ndim !=null){
                return dep_param_obj.pick_ndim;
            }

            console.error(`unable to get ndim of ${ref}`);
        }
        else if (relation === 'max_value'){
            try {
                var max_val = max(dep_param_obj.data);
                if (gen_shape && !(max_val instanceof Number)){
                    console.log(`Error: try to generate a shape value, but max value for ${ref} with value ${dep_param_obj.data} is not an integer`);
                    throw (TypeError);
                }
                return max_val;
            }catch (e) {
                console.error(`unable to get max value for ${ref} with value ${dep_param_obj.data}`);
            }
        }
        else if (relation === 'min_value'){
            try {
                var min_val = min(dep_param_obj.data);
                if (gen_shape && !(min_val instanceof Number)){
                    console.log(`Error: try to generate a shape value, but min value for ${ref} with value ${dep_param_obj.data} is not an integer`);
                    throw (TypeError);
                }
                return min_val;
            }catch (e) {
                console.error(`unable to get min value for ${ref} with value ${dep_param_obj.data}`);
            }
        }
        else if (relation === 'shape'){
            try {
                var data = this.dep_param[ref].data;
                var shape=[];
                while (data instanceof Array){
                    shape.push(data.length);
                    data=data[0];
                }
                return shape;
            }catch (e) {
                if ((dep_param_obj instanceof Number)||(dep_param_obj instanceof mathjs.complex) ||(dep_param_obj instanceof String))
                    return [];
                console.error.error(`unable to get the shape for ${ref} with value ${dep_param_obj.data}`);
            }
        }
        else if (relation === 'eval'){
            var value = dep_param_obj.data;
            // # assumption here: for given '&a' that 'a' should be a number
            if (value instanceof Boolean)
                console.error(`referred value ${ref} is a boolean value; cannot be used to decide another var`);
            if (!(value instanceof Number))
                console.error(`referred value ${ref} is not a single numeric value;cannot be used to decide another var`);
            return value
        }
        else{
            console.error(`unknown relation ${relation}`);
        }
    }


    process_shape_tok_loop(tok, ndim){
        // assert isinstance(tok, str)
        var shape_value = 0;
        var sign = '+';
        while (tok){
            ///# process until tok is empty string
            var value;
            [tok, value] = this.process_shape_tok(tok, ndim);
            if (value instanceof Array)    //  # the spec was "shape:&xxx"
                return value;
            if ('+-*/'.includes(value)){
                sign = value;
                continue;
            }
            else if(value==='-1')
                return -1;
            if (!util.str_is_int(value)){
                console.error(`given shape value ${value} is invalid.`);
            }

            value = parseInt(value);
            // # check for special values
            if (sign === '+'){
                shape_value += value;
            }
            else if (sign === '-'){
                // # assert shape_value > value
                shape_value = max(0, shape_value-value);
            }
            else if(sign === '*'){
                shape_value *= value;
            }
            else {
                // # sign is '/'
                if (value === 0){
                    console.error('attempting to divide by 0');
                }
                if (shape_value % value != 0){
                    console.log(`${shape_value}/${value} is not divisible, will use ceil(result) instead`);
                    shape_value = parseInt(shape_value / value) + 1;
                }
                else {
                    shape_value /= value;
                    shape_value = parseInt(shape_value);
                }
            }
        }
        return shape_value
    }


    process_shape_tok(tok, ndim){
        var ref, is_var;
        if ('+-*/'.includes(tok[0])){
            return [tok.slice(1),tok[0]];
        }
        else if(!isNaN(tok)){
            return ['',tok];
        }
        else if(tok[0]==='>'||tok[0]==='<'){
            var sign, shape_bound;
            // # implicitly 1D
            assert(ndim === 1);
            [sign, shape_bound] = util.parse_shape_bound(tok);
            if (sign === '>')
                return ['', util.randInt(shape_bound + 1, constants.MAX_DIM + 1,1).toString()];
            else
            return ['', util.randInt(0,shape_bound - 1,1).toString()];
        }
        else if (tok[0]==='.'){
            // # there's unknown number of dimensions
            return ['', (-1).toString()];  //  # put -1 as an indicator; need to call process_dot() later
        }
        else if (tok[0] === 'l' && tok.includes('len:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'len:');
            if (is_var)
                return [tok,this._gen_value_from_var_dep(ref,'len').toString()];
            else{
                console.log('Error: expect "xxx" in "len(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else if (tok[0]==='n'&&tok.includes('ndimre1:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'ndimre1:');
            if (is_var)
                return [tok, (this._gen_value_from_var_dep(ref, 'ndim')-1).toString()];
            else{
                console.log('Error: expect "xxx" in "ndimre1(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else if (tok[0]==='n'&&tok.includes('ndim')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'ndim:');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'ndim').toString()];
            else{
                console.log('Error: expect "xxx" in "ndim(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else if (tok[0] === 'm' && tok.includes('max_value')){
            // # implicitly 1D
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'max_value:');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'max_value').toString()];
            else {
                console.log('Error: expect "xxx" in "max_value(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else if (tok[0] === 'i' && tok.includes('index:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'index:');
            if (is_var){
                var itok,index;
                [itok, index, is_var] = util.gobble_var_dep(tok, '');
                if(!is_var)
                    return [itok,this._gen_value_from_var_dep([ref,index], 'index')];
                else if(is_var){
                    var values;
                    [tok,values] = this.process_shape_tok(tok,ndim);
                    return [tok,this._gen_value_from_var_dep([ref,values], 'index')];
                }
            }
            else {
                console.log('Error: expect "xxx" in "index(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
            }
        else if (tok[0] === 's' && tok.includes('shapen:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'shapen:');
            if (is_var){
                var index_tok,index_value;
                [index_tok,index_value]  = this.process_shape_tok(tok,ndim);

                var ref_shape=this._gen_value_from_var_dep(ref, 'shape');
                if(ref==="x" && ("dataFormat" in this.dep_param)){
                    if(ref_shape.length=== this._gen_value_from_var_dep("dataFormat", 'len')){
                        return [index_tok,ref_shape[index_value]];
                    }else {
                        var tmp=this._gen_value_from_var_dep("dataFormat", 'len')-ref_shape.length;
                        var newshape=new Array(tmp).fill(1);
                        newshape=newshape.concat(ref_shape)
                        return [index_tok,newshape[index_value]];
                    }
                }
                return [index_tok,ref_shape[index_value]];
            }

            else {
                console.log('Error: expect "xxx" in "shape(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else if (tok[0] === 's' && tok.includes('shape:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'shape:');
            if (is_var)
                return [tok, Array.from(this._gen_value_from_var_dep(ref, 'shape'))];
            else {
                console.log('Error: expect "xxx" in "shape(xxx)" a variable, rather than a constant');
                system.exit(1);
            }
        }
        else {
            // # referring to another var or constant value e.g. [batch_size,num_labels]
            [tok, ref, is_var] = util.gobble_var_dep(tok, '');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'eval').toString()];
            else {
                if (Object.keys(this.shape_var).length===0 || !(ref in this.shape_var) || this.shape_var[ref]==null)
                //     # constraint file doesn't have 'shape_var' attribute OR
                // # constraint file doesn't have referred constant ref in 'shape_var' attribute OR
                // # the concrete value for ref is not initialized yet
                    this.shape_var[ref] = util.randInt(1,constants.MAX_DIM + 1,1);
                return [tok, this.shape_var[ref].toString()];
            }
        }
    }

    _gen_shape_from_rank(rank){
        // # no corresponding shape spec, so just use rank to generate info
        if (rank === 0)
            return [];  //# an empty tuple for 0D
        else if(rank === 1)
            return util.randInt(1,constants.MAX_DIM+1,1);
        else if (rank > 1)
            return util.randInt(1,constants.MAX_DIM+1, rank);
        else {
            console.log('Error: Invalid Number of Dimension %d' % rank);
            system.exit(1);
        }

    }

    gen_var_from_shape(shape, dtype){
        var new_val;
        if (dtype === 'Int'){
            [this.curr_range.lower_bound,this.curr_range.upper_bound] = util.get_default_range(dtype);
            new_val = this._gen_int(dtype,shape);
        }
        if (dtype === 'number'){
            [this.curr_range.lower_bound,this.curr_range.upper_bound] = util.get_default_range(dtype);
            new_val = this._gen_number(dtype,shape);
        }

        // # bool
        if (dtype === 'boolean'){
            new_val = this._gen_bool(shape);
        }
        // # str
        if (dtype === 'String'){
            // # don't care about the shape of a string parameter
            new_val = this._gen_str();
        }

        // if (util.is_type_numeric(np_dtype)){
        //     this.curr_range.set_boundary(np_dtype);    //# set boundary cases for extreme values
        // }
        try{
            return new_val;
        }catch (e){
            // # if new_val is not defined
            console.error(`given dtype ${np_dtype} is not recognizable` );
        }
    }
    gen_var_from_bound(shape, dtype,low,high){
        var new_val;
        if (dtype === 'Int'){
            [this.curr_range.lower_bound,this.curr_range.upper_bound] = [low,high];
            new_val = this._gen_int(dtype,shape);
        }
        if (dtype === 'number'){
            [this.curr_range.lower_bound,this.curr_range.upper_bound] = [low,high];
            new_val = this._gen_number(dtype,shape);
        }

        // # bool
        if (dtype === 'boolean'){
            new_val = this._gen_bool(shape);
        }
        // # str
        if (dtype === 'String'){
            // # don't care about the shape of a string parameter
            new_val = this._gen_str();
        }

        // if (util.is_type_numeric(np_dtype)){
        //     this.curr_range.set_boundary(np_dtype);    //# set boundary cases for extreme values
        // }
        try{
            return new_val;
        }catch (e){
            // # if new_val is not defined
            console.error(`given dtype ${np_dtype} is not recognizable` );
        }
    }

    _gen_dtype(dtype_map){
        var default_dtypes=[];
        for (var key in dtype_map){
            if (dtype_map[key]!=null)
                default_dtypes.push(key);
        }
        var chosen_dtype;
        while (true){
            chosen_dtype = util.random_choice(default_dtypes);
            chosen_dtype = dtype_map[chosen_dtype];
            if (chosen_dtype)
                break;
        }
        // # only retain dtype part
        var chosen_dtype_tokens = chosen_dtype.split('.');
        if (chosen_dtype_tokens.length > 1){
            chosen_dtype = chosen_dtype_tokens[1];
        }
        var new_val;
        try{
            new_val = dtype(chosen_dtype);
        }catch (e) {
            console.error(`cannot create a valid dtype ${chosen_dtype}` );
        }
        return new_val;
    }

    _gen_str(){
        // # already forced pick_ndim=0 in _pick_dtype_ndim()
        console.log('log: trying to generate string; will not generate multi-dimensional string')

        var letters = [];
        for (var c="a";c<="z";c++)
            letters.push(c);
        for (c="A";c<="Z";c++)
            letters.push(c);
        for (c="0";c<="9";c++)
            letters.push(c);
        var str_len = util.randInt(0, 1024,1);
        var str='';
        for (var l=0;l<str_len;l++)
            str=str+util.random_choice(Array.from(letters));
        return str;
    }

    _gen_bool(shape){
        if(shape.length === 0)
            return util.random_choice([true, false]);
        return util.random_choice([true, false], shape);
    }

    _gen_int(np_dtype, shape){
    //     """
    //     generate integer value based on dtype and shape
    //         :param n_bit: string. represent the number of bits for the variable. e.g. '64' in 'int64'
    // :param np_dtype: the target int numpy dtype, e.g. 'int32'
    // :param shape: the desired shape of the generated variable
    //         :return: newly generated value
    //     """

        var low=this.curr_range.lower_bound;
        var high=this.curr_range.upper_bound;
        var new_val;
        if (low > high){
            console.log(`Error: invalid range for ${this.name} (low > high)`);
            system.exit(1);
        }
        if (low === high){
            try{
                new_val = util.random_uniform_int(low,high,...shape);
                new_val.fill(low);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (low < high){
            try{
                new_val = util.random_uniform_int(low, high, ...shape);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (shape.length===0){
            // :  # 0D

            return util.randInt(low,high,1)[0];
        }
        // new_val = new_val.astype(np_dtype);
        return new_val;
    }

    process_range_loop(tok){
        var range_value = 0;
        var sign = '+';
        while (tok){
        // :  # process until tok is empty string
            var value, new_sign;
            [tok, value, new_sign] = this.process_range_tok(tok);
            if (new_sign){
                sign = new_sign
            }
            if (value !=null)
                continue;
            // # check for special values
            if (sign === '+')
                range_value += value;
            else if(sign === '-')
                range_value -= value;
            else if(sign === '*')
                range_value *= value;
            else {
                // # sign is '/'; this case is highly unlikely
                // assert value != 0
                range_value /= value;
            }
        }
        return range_value;
    }

    process_range_tok(tok){
        if ('+-*/'.includes(tok[0])){
            return [tok.slice(1), null, tok[0]];
        }
        else if (!isNaN(tok)){
            return ['', parseInt(tok), ''];
        }
        else if (tok[0] === 'l' && tok.includes('len:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'len:');
            if (is_var){
                return [tok, this._gen_value_from_var_dep(ref, 'len', false), ''];
            }
            else
                console.error(`expect ${ref} in "len:xx" a variable, rather than a constant`);
        }
        else if (tok[0] === 'n' && tok.includes('ndim:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'ndim:');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'ndim', false), ''];
            else
                console.error(`expect ${ref} in "ndim:xx" a variable, rather than a constant`);
        }
        else if (tok[0] === 'm' && tok.includes('max_value:')){
            [tok, ref, is_var] = util.gobble_var_dep(tok, 'max_value:');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'max_value', false), ''];
            else
                console.error(`expect ${ref} in "max_value:xx" a variable, rather than a constant`);
        }
        else{
            // # referring to another var or constant value e.g. [batch_size,num_labels]
            [tok, ref, is_var] = util.gobble_var_dep(tok, '');
            if (is_var)
                return [tok, this._gen_value_from_var_dep(ref, 'eval', false), ''];
            else{
                if (!this.shape_var || !this.shape_var.includes(ref) || this.shape_var[ref] ===null){
                    //     # constraint file doesn't have 'shape_var' attribute OR
                    // # constraint file doesn't have referred constant ref in 'shape_var' attribute OR
                    // # the concrete value for ref is not initialized yet
                    this.shape_var[ref] = util.randInt(0,constants.MAX_DIM + 1);
                }
                return [tok, this.shape_var[ref], '']
            }
        }
    }


    process_bound_value(bound, bound_dep, defaultv){
        var value;
        if (bound_dep)
            value = this.process_range_loop(bound_dep);
        else if (bound ===null || bound === -Infinity || bound === Infinity)
            value = defaultv;
        else {
            value = bound;
        }
        return value;
    }


    _pick_range_spec(np_dtype, choices){
        // assert choices and isinstance(choices, list)
        var range_spec = null;
        if (choices.length === 1){
            range_spec = choices[0];
        }
        else {
            for (var rgc of choices){
                if (np_dtype in rgc.compat_dtype){
                    range_spec = rgc;
                    break;
                }
            }
        }
        if (range_spec===null){
            console.log('cannot find a compatible range choice; picking the first one');
            range_spec = choices[0];
        }
        // assert range_spec is not None
        return range_spec;
    }


    _get_low_high_from_range(np_dtype, n_bit, obey=true){
        var default_low, default_high;
        [default_low, default_high] = util.get_default_range(n_bit, np_dtype);
        if (this.range_choices.length===0){
            return new Range(null,np_dtype, default_low, default_high, null, null, false, false, default_low, default_high);
            // #return default_low, default_high
        }
        var range_spec = this._pick_range_spec(np_dtype, this.range_choices);
        // # NOTE: this epsilon is used when we have range such as (a, b]
        // # since the random generator we use will have range [a, b) we have to modify the a and b to
        // # achieve a range e.g., (a, b] and [a, b]
        var epsilon = util.choose_epsilon(np_dtype);

        var low = this.process_bound_value(range_spec.lower_bound, range_spec.lower_bound_dep, default_low);
        if (!range_spec.lower_bound_inclusive){
            // / # case like (a, b)
            low += epsilon; // # add a constant epsilon to avoid to generate `a`
        }
        var high = this.process_bound_value(range_spec.upper_bound, range_spec.upper_bound_dep, default_high);
        if (range_spec.upper_bound_inclusive)//:  # case like [a, b]
            high += epsilon;  //# NOTE: technically could generate a number in [b, b+epsilon), but no better solution
        var valid_range = new Range(null,np_dtype, low, high, null, null, range_spec.lower_bound_inclusive, range_spec.upper_bound_inclusive, default_low, default_high);
        // # return low, high
        if (obey)
            return valid_range;
        else
            return this._gen_violate_range(np_dtype, valid_range);
    }


    _gen_violate_enum(data, dtype, choices){
        function get_min_max(choices){
            var min = constants.MAX_INT;
            var max = constants.MIN_INT;
            for (var value of choices){
                if (parseInt(value) < min)
                    min = parseInt(value);
                if (parseInt(value) > max)
                    max = parseInt(value);
            }
            return [min, max];
        }
        // util.DEBUG('trying to violate enum constraint for %s' % self.name)

        // # if one of the value in choices is of type string, this param is of type string
        var str_type = false;
        for (var value of choices){
            if (util.infer_type_from_str(value) === 'String'){
                str_type=true;
                break;
            }
        }
        if (str_type)
            data = util.str_mutation(data, 1);   //# mutate the string with one edit distance

        // # if all of the value in choices are not string
        else if (dtype==='int'){
            [min, max] = get_min_max(choices);
            data = util.random_choice([min-1, max+1]);
        }
        else if (dtype === 'float'){
            // # no such case so far, not implemented
            // raise NotImplementedError("Enum is of type float.")
            throw ("Enum is of type float.");

        }
        // util.DEBUG('selected %s for enum while the choices are %s' % (data, str(choices)))
        return data;
    }


    _gen_violate_range(dtype, range_obj){
        // util.DEBUG('trying to violate range constraint for %s' % self.name)
        var range_list = [];
        if (!range_obj.is_default('low'))
            range_list.push([range_obj.default_low, range_obj.lower_bound]);
        if (!range_obj.is_default('high'))
            range_list.push([range_obj.upper_bound, range_obj.default_high]);
        if (range_list === [])
            range_list.push([range_obj.default_low, range_obj.default_high]);
        [low, high] = util.random_choice(range_list);
        // util.DEBUG('selected range [%s, %s]' % (low, high))
        // # TODO: lower and upper bound inclusive are wrong here
        return new Range(null, dtype, low, high, null, null, true, true, range_obj.default_low, range_obj.default_high);
    }


    _gen_float(np_dtype, shape){
        // # default_low, default_high = util.get_default_range(n_bits, np_dtype)
        // # self.curr_range = self._get_low_high_from_range(np_dtype, default_low, default_high, obey=range_obey)
        [low, high] = [this.curr_range.lower_bound, this.curr_range.upper_bound];
        var new_val;
        if (low > high){
            console.log(`Error: invalid range for ${this.name} (low > high)`);
            system.exit(1);
        }
        if (low === high){
            try{
                new_val = new Array(shape).fill(low,np_dtype);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (low < high){
            try{
                new_val = util.random_uniform(low, high, ...shape);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (!shape){
        // :  # 0D
            return parseFloat(new_val);
        }
        new_val = new_val.astype(np_dtype);
        return new_val;
    }

    _gen_number(dtype, shape){
        // # default_low, default_high = util.get_default_range(n_bits, np_dtype)
        // # self.curr_range = self._get_low_high_from_range(np_dtype, default_low, default_high, obey=range_obey)
        var low=this.curr_range.lower_bound;
        var high=this.curr_range.upper_bound;
        var new_val;
        if (low > high){
            console.log(`Error: invalid range for ${this.name} (low > high)`);
            system.exit(1);
        }
        if (low === high){
            try{
                new_val = util.random_uniform(low,high,...shape);
                new_val.fill(low);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (low < high){
            try{
                new_val = util.random_uniform(low, high, ...shape);
            }catch (e) {
                console.error(`given shape ${shape} is too big to be generated`);
            }
        }
        if (shape.length===0){
            // :  # 0D

            return Math.random()*(high -low+1)+low;
        }
        // new_val = new_val.astype(np_dtype);
        return new_val;
    }


    _gen_complex(half_bit, np_dtype, shape){
        // # if n_bit.isnumeric():
        // #     half_n_bit = str(int(int(n_bit) / 2))
        // # else:  # just complex
        // #     half_n_bit = str(64)  # default to complex 128 bit

        var float_dtype = 'float' + half_bit;
        var real_part = this._gen_float(float_dtype, shape);
        var imagine_part = this._gen_float(float_dtype, shape);
        if ((shape.length) === 0){
                // :  # 0D
            return complex(real_part, imagine_part);
        }
        var real_part_flat = real_part.flatten();
        var imagine_part_flat = imagine_part.flatten();
        imagine_part_flat = Array.from(map(cmath.sqrt, imagine_part_flat));
        var new_val = real_part_flat + imagine_part_flat;
        new_val = new_val.reshape(shape).astype(np_dtype);
        return new_val;
    }


    get_package_dtype_name(dtype, dtype_map){
    //     """
    //     find the package-specific dtype name using substring matching
    //         :param dtype: the plain dtype name (e.g. float32)
    // :param dtype_map: the data type mapping
    //         :return: return the package-specific name if found, otherwise None
    //     """
    //     # only care about the key
        for (var dtype_name of dtype_map.keys()){
            if (dtype_name.includes(dtype))
                return dtype_name;
        }
        return dtype;
    }




}
module.exports=Param;
// var param=new Param();
// param.process_shape_tok_loop("shapen:&x_index:&dataFormat(C)*shapen:&depthwiseFilter_3", 4)
