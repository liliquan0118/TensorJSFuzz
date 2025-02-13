constants=require("./constants")
const assert = require('assert')
const util=require("./util")
const math=require("mathjs")
class Range{
    // """
    // a simple structure to record several attributes of a specified range
    // """
    constructor(raw, compat_dtype, lower_bound, upper_bound, lower_ound_dep, upper_bound_dep, lower_bound_inclusive, upper_bound_inclusive, ault_low=null, ault_high=null){
        this.raw_rep = raw;
        this.compat_dtype = compat_dtype;//  // rare case: when a range is only for a specific dtype
        this.lower_bound = lower_bound;
        this.upper_bound = upper_bound;
        this.lower_bound_dep = lower_ound_dep;
        this.upper_bound_dep = upper_bound_dep;
        this.lower_bound_inclusive = lower_bound_inclusive;
        this.upper_bound_inclusive = upper_bound_inclusive;
        this.ault_low = ault_low;
        this.ault_high = ault_high;

        this.dtype = null;
        this.boundary = [];
    }


    __repr__(){
        return '{} {}'.format(this.__class__.__name__, this.raw_rep)
    }
    __str__(){
        return this.raw_rep;
    }


    is_ault(side){
        if (side==='low')
            return (this.ault_low === this.lower_bound);
        else if(side === 'high')
            return (this.ault_high === this.upper_bound)
        else
            console.error('invalid side %s' );
    }


    set_boundary(dtype){
        this.dtype = dtype;
        this.boundary = [];
        if (!util.is_type_numeric(dtype))
        // // if not numeric type
            return 0;
        var low=this.lower_bound;
        var high=this.upper_bound;
        if (dtype.includes('int'))
            this.boundary = [parseInt(low), parseInt(high)];
        if (dtype.includes('float'))
            this.boundary = [parseFloat(low), parseFloat(high)];
        if (dtype.includes('Number'))
            this.boundary = [parseFloat(low), parseFloat(high)];
        if (dtype.includes('complex'))
            this.boundary = [math.complex(low, low), math.complex(low, high), math.complex(high, high), math.complex(high, low)];

        // // this.boundary =  sorted(list(set(this.boundary)))
        // // this.boundary = list(dict.fromkeys(this.boundary))
        this.boundary = new Set(this.boundary);
    }

}





class Mutator{
    constructor(guided_mutate, special_value){
        this.guided_mutate = guided_mutate
        this.special_value = special_value

        this.funcdict = {
            'null': this._to_null,
            'zero': this._to_zero,
            'nan': this._to_nan,
            'inf': this._to_inf,
            'extreme': this._to_extreme,
            'empty_str': this._to_empty_str,
        // // 'negative': this._to_negative,
            'zero_ndim': this._zero_ndim,
            'empty_list': this._empty_list,
            'element_zero': this._element_zero
    }

        this.boundary_op_map = {
            "NUM": ['zero', 'extreme'],
            "STR": ['null', 'empty_str'],
            "BOOL": ['null'],
            "COMPLEX": ['null']
    }
        this.boundary_op_nd ={
           "NUM": ['zero', 'extreme', 'zero_ndim', 'empty_list', 'element_zero'],
            "STR": ['null', 'empty_str'],
            "BOOL": ['null', 'zero_ndim', 'empty_list'],
            "COMPLEX": ['null', 'zero_ndim', 'empty_list']
    }
        // // this.additional_map_nd = ['zero_ndim', 'empty_list']
        this.coverage_record = this.init_coverage_record() ; //// record of mutation operation used
        this.mutator_choices = null;
        this.mutation_op_covered = false;
        this.zero_ndim_record = this.init_zero_ndim_coverage();  //// record of ndim set to 0
        this.zero_ndim_covered = false;

        this.obey = true;
        this.dtype = null;
        this.shape = null;
        this.range = null;
        this.data = null;
        this.name = null;
        this.category = null;
        this.can_disobey_dtype = false;
        this.can_disobey_ndim = false;
        this.can_disobey_shape = false;
        this.can_disobey_range = false;
        this.can_disoeby_enum = false;
    }



 init_coverage_record(){
     var coverage_record = {};
     for(var op of Array.from(Object.keys(this.funcdict)))
        coverage_record[op] = false;
     // // for param_cat in this.boundary_op_map:
     // //     for op in this.boundary_op_map[param_cat]:
     // //         coverage_record[op] = false
     //
     // // for op in this.additional_map_nd:
     // //     coverage_record[op] = false
     return coverage_record;
 }



 init_zero_ndim_coverage(){
     var ret = {};
     for (var n of [...Array(constants.MAX_NUM_DIM).keys()]){
         ret[n] = false;
         // // ret['empty_list'] = false
     }
     return ret;
 }


 update_coverage(op, target_dim=null){
     if (!this.zero_ndim_covered && (op === 'zero_ndim')){
         if (!(target_dim in this.zero_ndim_record))
             console.error('target dim %s is not valid');
         this.zero_ndim_record[target_dim] = true;
     }
     var i=0;
     for(var x of Object.keys(this.zero_ndim_record)){
         if (this.zero_ndim_record[x]===false)
             i++;
     }
     if (i===0){
         console.log('Param  has covered all dimension for zero_ndim op');
         this.zero_ndim_covered = true;
     }
     if (!this.mutation_op_covered){
         if (!(op in this.coverage_record))
             console.error('mutation op is not ined');
     }
     this.coverage_record[op] = true;
     if (! this.zero_ndim_covered){
         this.coverage_record['zero_ndim'] = false;   // zero_ndim is not completely covered
     }
     i=0;
     for (var x2 of Object.keys(this.coverage_record)){
         if (this.coverage_record[x2]===false)
             i++;
     }
     if (i===0){
         console.log(`Param ${this.name} has covered all the mutation op`);
         this.mutation_op_covered = true;
     }
 }


 pick_mutation_op(max_coverage=true){
        var op_list;
     // function _init_mutator_choices(){
     //     if (this.shape.len === 0)
     //         op_list = this.boundary_op_map[this.category];
     //     else
     //         op_list = this.boundary_op_nd[this.category];
     //     if (this.mutator_choices != null)
     //        return 0;
     //     this.mutator_choices = {};
     //     for (var op of op_list)
     //        this.mutator_choices[op] = true; // true means not been tried
     // }

     function _aval_mutator(){
         // ret mutator that haven't been tried
         var ret = []
         for (var op of this.mutator_choices.keys()){
             if (this.mutator_choices[op])
                ret.push(op);
         }
         return ret
     }
     // _init_mutator_choices();

     if (this.shape.length === 0)
         op_list = this.boundary_op_map[this.category];
     else
         op_list = this.boundary_op_nd[this.category];
     if (this.mutator_choices != null)
         op_list=[];
     this.mutator_choices = {};
     for (var op of op_list)
         this.mutator_choices[op] = true; // true means not been tried

     // var candidate_op = _aval_mutator();
     var candidate_op=[]
     for (var op of Object.keys(this.mutator_choices)){
         if (this.mutator_choices[op])
             candidate_op.push(op);
     }

     if (candidate_op.length===0){
         return null;     // all available mutator have been tried and failed
     }
     var record_op=[];
     for(var x of candidate_op){
         if (this.coverage_record[x]===false)
             record_op.push(x);
     }
     var ret_op;
     // all available op are covered
     if (!max_coverage || this.mutation_op_covered || record_op.length===0)
        ret_op = util.random_choice(candidate_op);
     for (var op of candidate_op){
         if(this.coverage_record[op]===false)
            ret_op=op;
     }
     this.mutator_choices[ret_op] = false;
     return ret_op;
    }

    _to_null(val){
        return null;
    }

    _element_zero(val,mythis){
        if (mythis.can_disobey_range && mythis.obey){
            if (mythis.range && 0<mythis.range.lower_bound || 0>mythis.range.upper_bound)
                throw ('Need to follow constraint');
        }
        if (/^complex([0-9]*)/.exec(mythis.dtype)){
            return math.complex(0,0);
        }
        return 0;
    }

    _to_zero(val,mythis){
        if ((mythis.shape.length!=0) && mythis.can_disobey_ndim && mythis.obey){
            // if it is a multi-dimensional array AND with shape constraints AND need to obey constraints
            throw('Need to follow constraint');
        }
        return this._element_zero(val);
    }

    _to_nan(val,mythis){
        // special value
        if (mythis.special_value)
            return NaN;
        else
            throw ('MutationError: No special value');
    }

    _to_inf(val,mythis){
        // special value
        if (mythis.special_value)
            return util.random_choice([Infinity, -Infinity]);
        else
            throw ('MutationError: No special value');
    }

    _to_extreme(val,mythis){
        if (mythis.range){
            if (mythis.range.boundary)
                return util.random_choice(mythis.range.boundary);
            else
                throw(`MutationError: [ATTENTION!] boundary for ${mythis.name} is empty`);
        }
        else
            throw(`No range given, cannot mutate ${mythis.name} to extreme.`);
    }

    _to_empty_str(val){
        return ''
    }
     //  _to_negative(this, val):
     //     if this.range and this.range.lower_bound>=0:
     //         raise MutationError('MutationError: The parameter %s cannot be negative. ' % this.name)    // violate constraint
     //     if val<0:
     //         return val      // already a boundary case, don't mutate
     //     else:
     //         return 0-val

    _zero_ndim(target_dim,mythis){
        // mutate one element in shape into 0
        // e.g. shape (1,2,3) -> shape (1,0,3)

        // if this.can_disobey_shape and this.obey:
        //     raise MutationError('Need to follow constraint')
        var s = Array.from(mythis.shape);
        s[target_dim] = 0;
        return Array.from(s, mythis.dtype);
    }

    _empty_list(val,mythis){
        if (mythis.can_disobey_ndim && mythis.obey)
            throw('Need to follow constraint');
        return [];
    }

    pick_target_dim(){
        if (this.shape.length<2){
            throw('MutationError: to conduct zero_ndim, the parameter has to be at least 2D.');
        }
        if (this.zero_ndim_covered)   // already covered all
            return  util.randInt(0, this.shape.length-1,1);
        var dim_array=[];
        for (var x of this.zero_ndim_record.keys()){
            if (this.zero_ndim_record[x]===false)
                dim_array.push(x);
        }
        for (var dim of dim_array)
            if (dim <= this.shape.length-1)
                return dim
        // randint: both inclusive
        // print("Target dim is %s/%s" % (target_dim, this.shape))
        return util.randInt(0, this.shape.length - 1,1);
    }

     pick_element_index(shape){
         // pick a index from multi-dimensional array
         var index = [];
         for (var dim of shape){
             if (dim===0)          // 0 in shape, contain no elements
                return null;     // already a boundary case, don't mutate
             index.push(util.randInt(0, dim-1,1));      // [0, dim-1] inclusive
         }
         return index;
     }

     assign_element(data, index, func){
         // assign element of "data" at "index" to be "func(val)"
         // index is a list
         if (index.length===0)       // index = []
             return data;
         // print('Debugging: '+str(data))
         // print(this.shape)
         if (data instanceof String)   // the shape of string is random
             throw('String has invalid shape');
         try{
             if (index.length===1)
                data[index[0]] = func(data[index[0]],this);
             else if(index.length===2)
                 data[index[0]][index[1]] = func(data[index[0]][index[1]],this);
             else if ((index.length===3))
                 data[index[0]][index[1]][index[2]] = func(data[index[0]][index[1]][index[2]],this);
             else if ((index.length===4))
                 data[index[0]][index[1]][index[2]][index[3]] = func(data[index[0]][index[1]][index[2]][index[3]],this);
             else if ((index.length===5))
                 data[index[0]][index[1]][index[2]][index[3]][index[4]] = func(data[index[0]][index[1]][index[2]][index[3]][index[4]],this);
         }catch (e) {
             throw ('Mutating failed.');
         }
         return data;
     }

     gen_boundary_shape(shape, dtype){
         if (this.shape.length===0)
            return null;
         if (this.shape.length===1){
             if (!this.zero_ndim_record['empty_list'])
                return [];
             else
                 return null;
         }
         // len(this.shape) >=2
         var candidate_dim=[];
         while (true){
             for(var d of this.zero_ndim_record.keys())
                 if (this.zero_ndim_record[d]===false)
                    candidate_dim .push(d);
             if (!candidate_dim)
                 return null;
         }
         var target_dim =util.random_choice(candidate_dim);
         if (target_dim==='empty_list')
            return this._empty_list;
         else {
             this.shape = shape
             this.dtype = dtype
             return this._zero_ndim(target_dim = target_dim);
         }
     }

    mutate(name, category, data, obey, dtype, shape, curr_range, can_disobey_ndim, can_disobey_dtype, can_disobey_shape, can_disobey_range, can_disoeby_enum){
     this.name = name;
     this.data = data;
     this.obey = obey;
     this.dtype = dtype;
     this.shape = shape;
     this.range = curr_range;
     this.category = category;
     this.can_disobey_dtype = can_disobey_dtype;
     this.can_disobey_ndim = can_disobey_ndim;
     this.can_disobey_shape = can_disobey_shape;
     this.can_disobey_range = can_disobey_range;
     this.can_disoeby_enum = can_disoeby_enum;
     var new_val=data;
     var stop=true; // stop trying
     this.mutator_choices = null;

     // try to max coverage only the first time to avoid inf loop
        if (this.guided_mutate==="true")
            this.guided_mutate=true;
        else this.guided_mutate=false;
     var boundary_op = this.pick_mutation_op(this.guided_mutate);
     // assert (boundary_op is not null)
     while (true){
         try {
             if (this.can_disoeby_enum && this.obey){
                 // don't do mutation
                 console.log('Need to follow constraint. Will not mutate enum value.')
                 return new_val;
             }
             if (this.can_disobey_dtype && this.obey && (this.category==="BOOL")){
                 console.log('Need to follow constraint. Will not mutate bool type')
                 return new_val;
             }
             var target_dim = -1;
             var op_func = this.funcdict[boundary_op];
             // 0d case
             if ((shape.length === 0) || (this.category==="STR"))
                new_val = op_func(data,this);
             else{
                 if ((boundary_op === 'empty_list') || (boundary_op==='zero')){
                     new_val = op_func(data,this);
                 }
                 else if (boundary_op === 'zero_ndim'){
                     target_dim = this.pick_target_dim();
                     new_val = op_func(target_dim,this);
                 }
                 else {
                     var target_element_index = this.pick_element_index(shape);
                     console.log('mutate element at index '+(target_element_index).toString());
                     new_val = this.assign_element(data, target_element_index, op_func);
                 }
             }
             // success
             // update coverage info
             this.update_coverage(boundary_op, target_dim);
             break;
         }catch (e) {
             // TypeError: np.array cannot contain null .
             // ValueError: cannot convert nan to int/uint
             // OverflowError: cannot convert inf to int/uint
             // MutationError: (ined in util.py) cannot conduct mutation
             //   - boundary case out of the range constraint
             //   - cannot conduct zero_ndim on 0D/1D tensor
             console.log(`Failed to mutate parameter ${name}.\nError Message: ${e}\nDtype: ${dtype}; Shape: ${shape}; Category: ${this.category}; Operation: ${boundary_op}.`);
             // if fail, random pick op
             boundary_op = this.pick_mutation_op(false);
             if (!boundary_op){
                 console.log('No mutator avaliable.');
                 return new_val;
             }
             else
                 console.log('Try mutate again.');
         }
     }
     if (shape.length===0){
         console.log(`Mutate parameter ${name} from ${data} to ${new_val}.\nDtype: ${dtype}; Type: ${typeof data}; Shape: ${shape}; Category: ${this.category}`)
     }
     else
         console.log(`Mutate parameter ${name}. Dtype: ${dtype}; Type: ${typeof data}; Shape:  ${shape}; Category: ${this.category}; Operation: ${boundary_op}`);
     return new_val
 }

}

module.exports={
    Mutator,
    Range
}