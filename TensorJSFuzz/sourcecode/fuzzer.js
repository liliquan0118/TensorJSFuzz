const util=require("./util")
const constants=require("./constants")
const param=require("./param");
var path=require("path");
var fs=require("fs");
const assert=require("assert")
// const puppeteer_browser_execute=require("../example/web_DL_framework_testing/puppeteer_browser_execute")
// const runapi=require("./run_api_demo");
const diff_test=require("./diff_test_canary")
const {string} = require("mathjs");

var Status=['INIT','PASS','FAIL','TIMEOUT','SIGNAL'];


class FuzzerFailureStatus{
    constructor(){
    this.consec_fail_count = 0;  //// used to determine if too many cases failed in expect_ok case
    this.is_consec_fail = false;
    this.reduce_failure = false
    this.ok_seed_list = [];
    this.excpt_seed_list = []  ;
}

}

class Fuzzer{
    // //
    // For fuzzing by specified from one configuration
    // //
    constructor(config, data_construct=null){
        this.config = config;
        this.data_construct = data_construct;

        this.exit_flag = false;
        this.fstatus = new FuzzerFailureStatus();
        this.import_statements = [];
        this.total_iter = 0;
        this.tried_empty = false;
        this.model_input = false;
        this.valid_permute_dtypes = [];
        this.ok_seed_num=0;
        this.ok_see_list=[];
        // // after this, may want to check first if package is importable
        // // NOTE: doing this means every Fuzzer object would try to do the import
        // // this may not be the most efficient way to check if package is importable
        // this._check_target_package();
    }
    default_ndims(){
        var default_ndims_arr=[];
        for (var i=0;i<constants.MAX_NUM_DIM+1;i++){
            default_ndims_arr.push(i);
        }
        return default_ndims_arr;
    }
    add_ok_seed(seed_path){
        // // only save the seed_path to save memory
        this.fstatus.ok_seed_list.push(seed_path);
    }

    add_excpt_seed(seed_path){
        // // only save the seed_path to save memory
        this.fstatus.excpt_seed_list.push(seed_path);
    }
    _generate_model_input(){
        // // TODO
        // // hardcode
        // // input= (np.random.randn(1,32,32,16)).astype(np.float32)
        var input_constr = util.def_model_input_constr(this.config.package);
        var input_param = new param('model_input', input_constr, this.config.dtype_map, true,
            this.config.guided_mutate, false);
        var p_mutate=false;
        if (util.random_prob(this.config.mutate_p))
            p_mutate = true;
        var input_value = input_param.gen(true, this.default_ndims, this.config.dtype_map,
            this.data_construct, null, p_mutate);
        return input_value;
    }

    _pick_disobey_param(param_list, obey){
        // # param_list: a list of parameter name as parameters to choose from

        if (obey)
            return [];

        // # violating constraint
        // # Note: it's not interesting to make all parameters to violate constraints
        // # because one parameter violating constraints will lead to the entire function call fail
        // # so, it's more interesting to make one parameter violate at a time

        var disobey_candidates_required_param = [];
        for (var p of Object.values(this.config.required_param))
            if (p.can_disobey)
                disobey_candidates_required_param.push(p.name);
        var disobey_candidates_optional_param = [];
        for (var op of Object.values(this.config.optional_param))
            if (op.can_disobey)
                disobey_candidates_optional_param.push(op.name);

        var disobey_params = disobey_candidates_required_param.concat(disobey_candidates_optional_param);
        // # if self.config.fuzz_optional:
        // #     pnames = [pname for pname in disobey_all]
        // # else:  # only fuzz required params
        // #disobey_params = [pname for pname in disobey_all]

        var candidate = Array.from(disobey_params.filter(x=>new Set(param_list).has(x)))//# intersection of two list (param can disobey & param to fuzz)
        if (candidate){
            //:  # possible to disobey constraints
            var index=Math.floor((Math.random()*candidate.length));
            var disobey_param = [candidate[index]];  //# pick 1 random param to disobey
            console.log(`selected ${disobey_param} to violate constraints` );
            // return disobey_param;
            return "dimRoundingMode";
        }
        console.log('no parameter can disobey constraints, falling back to random generation');
        return [];
    }

    _pick_mutate_param(param_list){
        if (util.random_prob(this.config.mutate_p)){
            var mutate_candidates_required_param = [];
            for (var p of Object.values(this.config.required_param))
                    mutate_candidates_required_param.push(p.name);
            var mutate_candidates_optional_param = [];
            for (var op of Object.values(this.config.optional_param))
                mutate_candidates_optional_param.push(op.name);

            var mutate_all = mutate_candidates_required_param.concat(mutate_candidates_optional_param);

            var candidate = Array.from(mutate_all.filter(x=>new Set(param_list).has(x)))  //# intersection of two list (param can disobey & param to fuzz)
            if (candidate){
                var index=Math.floor((Math.random()*candidate.length));
                var mutate_param = [candidate[index]]  //# pick 1 random param to disobey
                console.log(`selected ${mutate_param} to mutate `);
                return mutate_param;
            } else{
                console.log('no parameter can mutate');
            }
        }

        return [];
    }


    _parse_expression(expression){
        var reg = /(.*)(=|!=|>|<|>=|<=)(.*)/;
        var match = reg.exec(condition)
        if(match){
            var left= match[1];
            var op=match[2];
            var right=match[3];

        }
    }
   _get_right_value(config,right){
        var right_value;
       var right_param,shape_num;
       if(right.includes("_slice")){
           right_param=right.split("_slice(")[0];
           var first_p=right.split("_slice(")[1].split(",")[0];
           var sec_p=right.split("_slice(")[1].split(",")[1].replace(")","");
           return this._get_right_value(config,right_param).slice(parseInt(this._get_right_value(config,first_p)),parseInt(this._get_right_value(config,sec_p)));
       }
       if(right.includes("+")||(right.includes("-") && !right.includes("[-"))||right.includes("*")||right.includes("/")){
           var right_match= /(.*?)(\+|\-|\*|\/)(.*)/g.exec(right);
           var r_left=this._get_right_value(config, right_match[1]);
           var r_right=this._get_right_value(config, right_match[3])
           if(right_match[2]==="+")
               return r_left+r_right;
           else if (right_match[2]==="-")
               return r_left-r_right;
           else if (right_match[2]==="*")
               return r_left*r_right;
           else return r_left/r_right;
       }else if(right.includes("_shape[")){
           right_param=right.split("_shape[")[0];
           shape_num=parseInt(right.split("_shape[")[1].split("]")[0]);
           if (shape_num===-1){
               shape_num=config.param[right_param].shape.length-1;
           }
           right_value=config.param[right_param].shape[shape_num];
           return right_value;
       }else if(right.includes("_type")){
           right_param=right.split("_type")[0];
           right_value=config.param[right_param].pick_dtype;
           return right_value;
       }else if(right==="integer"||right==="string"){
           right_value=right;
           return right_value;
       }else if (right.includes("_shape_length")){
           right_param=right.split("_shape_length")[0];
           right_value=config.param[right_param].shape.length;
           return right_value;
       }else if (right.includes("_shape")){
           right_param=right.split("_shape")[0];
           right_value=config.param[right_param].shape;
           return right_value;
       }else if(right.includes("_rank")){
           right_param=right.split("_rank")[0];
           right_value=config.param[right_param].pick_rank;
           return right_value;
       }else if(right.startsWith("[")){
           var valid_value=right.split("[")[1].split("]")[0].split(",");
           right_value=util.random_choice(valid_value);
           return right_value;
       }else if(right.includes("[")){
           right_param=right.split("[")[0];
           shape_num=parseInt(right.split("[")[1].split("]")[0]);
           if (config.param[right_param].pick_structure==="List"){
               right_value=config.param[right_param].data[shape_num];
               return right_value;
           }
           else{
               right_value=config.param[right_param].data;
               return right_value;
           }
       }else if(Object.keys(config.param).includes(right)){
           right_value=config.param[right].data;
           return right_value;
       }else {
           if (util.str_is_int(right) || util.str_is_number(right)){
               right_value=parseInt(right);
           }else {
               right_value=right;
           }
           return right_value;
       }

   }
    _set_config(config,left,op,right){
        var left_param,right_param,shape_num;
        var right_value;
        right_value=this._get_right_value(config,right)
        if(left.includes("_shape[")){
            left_param=left.split("_shape[")[0];
            shape_num=parseInt(left.split("_shape[")[1].split("]")[0]);
            if (shape_num===-1){
                shape_num=config.param[left_param].shape.length-1
            }
            if (Object.keys(config.param).includes("dataFormat") && config.param[left_param].pick_rank<config.param["dataFormat"].data.length){
                config.param[left_param].shape[shape_num-1]=right_value;
            }else {
                config.param[left_param].shape[shape_num]=right_value;
            }

        }else if(left.includes("_shape")){
            left_param=left.split("_shape")[0];
            config.param[left_param].shape=right_value;
        }else if(left.includes("_length")){
            left_param=left.split("_length")[0];
            if(util.str_is_int(right_value)&& (op===">="||op===">")){
                config.param[left_param].pick_len=~~Math.random()*5+right_value;
            }else if(op==="="){
                config.param[left_param].pick_len=right_value;
            }
        }
        else if(left.includes("_type")||left.includes("_dtype")){
            if (left.includes("_type")){
                left_param=left.split("_type")[0];
            }else {
                left_param=left.split("_dtype")[0];
            }

            if (right_value==="integer"){
                config.param[left_param].pick_dtype="Int";
            }else if(right_value==="string"){
                config.param[left_param].pick_dtype="String";
            }else if(right_value.includes("bool")){
                config.param[left_param].pick_dtype="boolean";
            }
        }else if(left.includes("_rank")){
            left_param=left.split("_rank")[0];
            if (util.str_is_int(right_value)&& op==="="){
                config.param[left_param].pick_rank=parseInt(right_value);
            }else if(util.str_is_int(right_value)&& op===">"){
                config.param[left_param].pick_rank=Math.floor(Math.random()*5)+parseInt(right_value);
            }else if(util.str_is_int(right_value)&& op==="<"){
                config.param[left_param].pick_rank=~~(Math.random()*parseInt(right_value));
            }else if(util.str_is_int(right_value)&& op==="<="){
                config.param[left_param].pick_rank=~~(Math.random()*parseInt(right_value))+1;
            }else if(util.str_is_int(right_value)&& op===">="){
                config.param[left_param].pick_rank=~~(Math.random()*5)+parseInt(right_value);
            }
        }
        else {
            if (left.includes("_value")){
                left_param=left.split("_value")[0]
            }else {
                left_param=left;
            }
            if (config.param[left_param].pick_structure==="List" && util.str_is_int(right_value) && op==="="){
                config.param[left_param].data.fill(parseInt(right_value));
            }else if (config.param[left_param].pick_structure==="List" && util.str_is_int(right_value) && op===">"){
                for (let i = 0; i < config.param[left_param].data.length; i++) {
                    if (config.param[left_param].data[i]<=parseInt(right)){
                        config.param[left_param].data[i] = Math.floor(Math.random() * 25)+parseInt(right)+1;
                    }
                }
            }else if (config.param[left_param].pick_structure==="List" && util.str_is_int(right_value) && (op==="<"||op==="<=")){
                for (let i = 0; i < config.param[left_param].data.length; i++) {
                    if (config.param[left_param].data[i]>=parseInt(right)){
                        config.param[left_param].data[i] = Math.floor(Math.random() * parseInt(right));
                    }
                }
            }else if (config.param[left_param].pick_structure==="List" && Array.isArray(right_value)){
                config.param[left_param].data = right_value
            }
            else if(config.param[left_param].pick_structure==="Tensor" && util.str_is_int(right_value) && op==="="){
                config.param[left_param].data=config.param[left_param].gen_var_from_bound(config.param[left_param].shape,config.param[left_param].pick_dtype,parseInt(right_value),parseInt(right_value))
            }else if(config.param[left_param].pick_structure==="Tensor" && util.str_is_int(right_value) && op===">"){
                config.param[left_param].data=config.param[left_param].gen_var_from_bound(config.param[left_param].shape,config.param[left_param].pick_dtype,parseInt(right_value),25)
            }else if(config.param[left_param].pick_structure==="Tensor" && util.str_is_int(right_value) && op==="<"){
                config.param[left_param].data=config.param[left_param].gen_var_from_bound(config.param[left_param].shape,config.param[left_param].pick_dtype,0,parseInt(right_value))
            }else if(config.param[left_param].pick_structure==="Tensor"){
                config.param[left_param].data=right_value
            }
            else if (util.str_is_int(right_value)&& op==="="){
                config.param[left_param].data=parseInt(right_value);
            }else if(util.str_is_int(right_value)&& op===">"){
                config.param[left_param].data=Math.floor(Math.random()*5)+parseInt(right_value);
            }else if(util.str_is_int(right_value)&& op==="<"){
                config.param[left_param].data=~~(Math.random()*parseInt(right_value));
            }else if(util.str_is_int(right_value)&& op==="<="){
                config.param[left_param].data=~~(Math.random()*parseInt(right_value))+1;
            }else if(util.str_is_int(right_value)&& op===">="){
                config.param[left_param].data=~~(Math.random()*5)+parseInt(right_value);
            } else {
                config.param[left_param].data=right_value.replace(/'/g,"");
            }

        }
        return left_param;

    }

    _gen_from_dtype_comb(){
        var default_ndims=this.default_ndims();
        var data_construct=this.data_construct;
        var gen_inputs = {} ;//    # dict: generated input
        var config=this.config;
        var params=Object.keys(config.param);
        var structure={};
        for (var pc of params){
            gen_inputs[pc]=null;
        }

        console.log(`Parameter to generate: ${Object.keys(gen_inputs).toString()}`);

        for (var pname of params) {
            //: # generate all param in case it has dependency
            var p_obj = config.param[pname];
            var gen_data=p_obj.gen();
            if(pname in gen_inputs){
                gen_inputs[pname] = gen_data;
            }
        }
        var constraints=config.target_config.constraints;
        var cons_params=Object.keys(constraints)
        for (var cparam of cons_params){
            var param_cons_list=constraints[cparam];
            for (var pcon of param_cons_list){
                var reg_rank = new RegExp(cparam+"_rank=\\[(.*)\\]","g");
                var reg_rank_ = new RegExp("_rank(!?=|>=?|<=?)(.*)","g");
                var reg_scalar = new RegExp(cparam+"(!?=|>=?|<=?)(.*)","g");
                var reg_if = new RegExp("if\\((.*)\\) then (.*) else (.*)","g");
                var match_if=reg_if.exec(pcon);
                var if_reg_ = new RegExp("if\\((.*)\\) then (.*)","g");
                var reg_value = new RegExp(cparam+"_value=\\[(.*)\\]","g");
                var reg_value_ = new RegExp(cparam+"_value(!?=|>=?|<=?)(.*)","g");
                var match_if_=if_reg_.exec(pcon);
                var match_scalar=reg_scalar.exec(pcon);
                var match_rank=reg_rank.exec(pcon);
                var match_value=reg_value.exec(pcon);
                var match_value_=reg_value_.exec(pcon);
                var match_shape=/_shape=(.*)/g.exec(pcon);
                var match_shape_=/_shape\[(-?.*)\](!?=|>=?|<=?)(.*)/g.exec(pcon);
                var reg_type = new RegExp(cparam+"(_type|_dtype)=(.*)","g");
                var match_length=/_length=\[(.*)\]/g.exec(pcon);
                var match_length_=/_length(!?=|>=?|<=?)(.*)/g.exec(pcon);
                var match_type=reg_type.exec(pcon);
                var match_rank_=reg_rank_.exec(pcon);
                if (match_rank){
                    var valid_rank=match_rank[1].split(",").map((value)=>{return parseInt(value)})
                    if (valid_rank.includes(config.param[cparam].pick_rank)){
                        console.log("do not");
                    }
                    else {
                        config.param[cparam].rank=valid_rank;
                        gen_inputs[cparam] = config.param[cparam].gen();
                    }
                }
                else if(match_if){
                    var condition=match_if[1];
                    var then_do=match_if[2];
                    var else_do=match_if[3];
                    var left_param;
                    if(this._is_sat(condition)){
                        var reg_ = /(.*)(=|!=|>|<|>=|<=)(.*)/;
                        var match_ = reg_.exec(then_do)
                        if(match_){
                            var left= match_[1];
                            var op=match_[2];
                            var right=match_[3];
                            left_param=this._set_config(config,left,op,right);
                            if(left.includes("shape")){
                                gen_inputs[left_param] = config.param[left_param].gen_var_from_shape(config.param[left_param].shape,config.param[left_param].pick_dtype);
                            }else if(left.includes("_type")){
                                gen_inputs[left_param] = config.param[left_param].gen_from_var_dtype();
                            }else if(left.includes("rank")){
                                gen_inputs[left_param] = config.param[left_param].gen_from_var_rank();
                            }
                            else {
                                gen_inputs[left_param] = config.param[left_param].data;
                            }

                        }
                        console.log("then do");
                    }else {
                        var else_reg_ = /(.*)(=|!=|>|<|>=|<=)(.*)/;
                        var else_match = else_reg_.exec(else_do)
                        if(else_match){
                            var else_left= else_match[1];
                            var else_op=else_match[2];
                            var else_right=else_match[3];
                            var left_param=this._set_config(config,else_left,else_op,else_right);
                            if(else_left.includes("shape")){
                                gen_inputs[left_param] = config.param[left_param].gen_var_from_shape(config.param[left_param].shape,config.param[left_param].pick_dtype);
                            }else if(else_left.includes("_type")){
                                gen_inputs[left_param] = config.param[left_param].gen_from_var_dtype();
                            }else if(else_left.includes("rank")){
                                gen_inputs[left_param] = config.param[left_param].gen_from_var_rank();
                            }
                            else {
                                gen_inputs[left_param] = config.param[left_param].data;
                            }

                        }
                        console.log("else do");
                    }
                }else if(match_if_){
                    var condition_=match_if_[1];
                    var then_do_=match_if_[2];
                    if(this._is_sat(condition_)){
                        var reg_ = /(.*)(=|!=|>|<|>=|<=)(.*)/;
                        var match__ = reg_.exec(then_do_)
                        if(match__){
                            var left_= match__[1];
                            var op_=match__[2];
                            var right_=match__[3];
                            var left_param_=this._set_config(config,left_,op_,right_);
                            if(left_.includes("_shape")){
                                gen_inputs[left_param_] = config.param[left_param_].gen_var_from_shape(config.param[left_param_].shape,config.param[left_param_].pick_dtype);
                            }else if(left_.includes("_type")){
                                gen_inputs[left_param] = config.param[left_param].gen_from_var_dtype();
                            }else if(left_.includes("_rank")){
                                gen_inputs[left_param_] = config.param[left_param_].gen_from_var_rank();
                            }else {
                                gen_inputs[left_param_] = config.param[left_param_].data;
                            }

                        }
                        console.log("then do");
                    }else {
                        console.log("do not");
                    }
                }
                else  if(match_scalar){
                    config.param[mv_left_param]
                    if(this._is_sat(pcon)){
                        console.log("do not");
                    }
                    else {
                        var left2= cparam;
                        var op2=match_scalar[1];
                        var right2=match_scalar[2];
                        if ((config.param[left2].pick_dtype==="Int" && !util.str_is_int(right2))){
                            console.log("");
                        }else {
                            var mv_left_param=this._set_config(config,left2,op2,right2);
                            gen_inputs[mv_left_param] = config.param[mv_left_param].data;
                        }

                    }
                }
                else if(match_value){
                    var [low,high]=match_value[1].split(",").map((value)=>{return parseInt(value)})
                    if (config.param[cparam].pick_structure==="Tensor" || config.cparam.pick_structure==="List"){
                        gen_inputs[cparam] = config.param[cparam].gen_var_from_bound(config.param[cparam].shape,config.param[cparam].pick_dtype,low,high);
                    }else {
                        if (config.param[cparam].pick_dtype==="Int"){
                            gen_inputs[cparam]= ~~(Math.random()*(high-low+1)+low);
                        }else {
                            gen_inputs[cparam]= Math.random()*(high-low+1)+low;
                        }

                    }

                }
                else if(match_value_){
                    if(this._is_sat(pcon)){
                        console.log("do not");
                    }
                    else {
                        var left_param2=this._set_config(config,cparam+"_value",match_value_[1],match_value_[2]);
                        gen_inputs[left_param2] = config.param[left_param2].data;
                    }
                }
                else if(match_shape){
                    var left_param2=this._set_config(config,pcon.split("=")[0],"=",match_shape[1]);
                    gen_inputs[left_param2] = config.param[left_param2].gen_var_from_shape(config.param[left_param2].shape,config.param[left_param2].pick_dtype);
                }else if (match_shape_){

                    var left_param2=this._set_config(config,pcon.split(match_shape_[2])[0],match_shape_[2],match_shape_[3]);
                    gen_inputs[left_param2] = config.param[left_param2].gen_var_from_shape(config.param[left_param2].shape,config.param[left_param2].pick_dtype);
                }
                else if(match_type){
                    var left_param2=this._set_config(config,cparam+match_type[1],"=",match_type[2]);
                    gen_inputs[left_param2] = config.param[left_param2].gen_from_var_dtype();
                }
                else if (match_rank_){
                    if(!this._is_sat(pcon)){
                        var left_param2=this._set_config(config,pcon.split(match_rank_[1])[0],match_rank_[1],match_rank_[2]);
                        gen_inputs[left_param2] = config.param[left_param2].gen_from_var_rank();vv
                    }

                }
                else if(match_length){
                    var valid_length=match_length[1].split(",").map((value)=>{return parseInt(value)})
                    var param_name=pcon.split("_length")[0]
                    if (valid_length.includes(config.param[param_name].pick_len)){
                        console.log("do not");
                    }
                    else {
                        config.param[param_name].list_len=valid_length;
                        gen_inputs[param_name] = config.param[param_name].gen();
                    }
                }
                else if(match_length_){
                    if(!this._is_sat(pcon)){
                        var left_param2=this._set_config(config,pcon.split("_length")[0]+"_length",match_length_[1],match_length_[2]);
                        gen_inputs[left_param2] = config.param[left_param2].gen_from_var_len();
                    }

                }
            }
        }
        var convert_tensor={};
        var dtype={};
        var varshape={}
        for (var pc of params){
            if(config.param[pc].pick_structure==="Tensor"){
                convert_tensor[pc]=true;
            }else {
                convert_tensor[pc]=false;
            }
            dtype[pc]=config.param[pc].pick_dtype;
            varshape[pc]=config.param[pc].shape;
        }
        // var return_value={"gen_inputs":gen_inputs,"convert_tensor":convert_tensor,"structure":structure}
        var return_value={"gen_inputs":gen_inputs,"convert_tensor":convert_tensor,"dtype":dtype,"varshape":varshape}
        return return_value;
    }
    _is_sat(condition){
        function execute(left,op,right){
            if(op==="="){
                if (Array.isArray(left)){
                    return left.every(element => element === right);
                }else {
                    return left===right;
                }
            }
            else if(op==="!="){
                if (Array.isArray(left)){
                    return !(left.every(element => element === right));
                }else {
                    return left!==right;
                }
            }
            else if(op===">"){
                if (Array.isArray(left)){
                    return left.every(element => element > right);
                }else {
                    return left>right;
                }
            }
            else if(op===">="){
                if (Array.isArray(left)){
                    return left.every(element => element >= right);
                }else {
                    return left>=right;
                }
            }
            else if(op==="<"){
                if (Array.isArray(left)){
                    return left.every(element => element < right);
                }else {
                    return left<right;
                }
            }
            else if(op==="<="){
                if (Array.isArray(left)){
                    return left.every(element => element <= right);
                }else {
                    return left<=right;
                }
            }
        }
        var reg = /(.*)(!=|>=|<=)(.*)/;
        var match = reg.exec(condition)
        if(match){
            var left= match[1];
            var op=match[2];
            var right=match[3];
            var leftv=this._get_value(left);
            var rightv=this._get_value(right);
            return execute(leftv,op,rightv);
        }else if(/(.*)(=|>|<)(.*)/.exec(condition)){
            var match_=/(.*)(=|>|<)(.*)/.exec(condition)
            var left_= match_[1];
            var op_=match_[2];
            var right_=match_[3];
            var leftv_=this._get_value(left_);
            var rightv_=this._get_value(right_);
            return execute(leftv_,op_,rightv_);
        }
    }

    _get_value(varible){
        if(varible.includes("_rank")){
            return this.config.param[varible.split("_rank")[0]].pick_rank;
        }else if(varible.includes("_shape[")){
            var index=parseInt(varible.split("_shape[")[1].split("]")[0]);
            if (index===-1){
                index=this.config.param[varible.split("_shape[")[0]].shape.length-1
            }
            return this.config.param[varible.split("_shape[")[0]].shape[index];
        }else if(varible.includes("_shape")){
            return this.config.param[varible.split("_shape")[0]].shape;
        }else if(varible.includes("_type")){
            return this.config.param[varible.split("_type")[0]].pick_dtype;
        }else if (varible.includes("_value")){
            return this.config.param[varible.split("_value")[0]].data;
        }else if(varible.includes("_length[")){
            var index=parseInt(varible.split("_length[")[1].split("]")[0]);
            return this.config.param[varible.split("_length[")[0]].data[index];
        }else if(varible.includes("_length")){
            return this.config.param[varible.split("_length")[0]].pick_len;
        }else if(varible.includes("'")){
            return varible.replace(/'/g,"");
        }else if (util.str_is_int(varible)){
            return parseInt(varible);
        } else if(Object.keys(this.config.param).includes(varible)){
            return this.config.param[varible].data;
        }else if(varible==="null"){
            return "undefined";
        }
        else {
            return varible;
        }
    }




    _generate_new_input(){

        var gen_inputs = {};
        var config=this.config;
        var params=Object.keys(config.param);
        for (var pc of params)
            gen_inputs[pc]=undefined;
        return this._gen_from_dtype_comb();
    }




    async _run_max_iter(max_iter, obey, gen_script = false) {
        var runforever = false;
        if (max_iter === -1)  //:  // run indefinitely
            runforever = true
        // var seeds = this._check_exist_seed(); //// currently empty
        var count = 0;1
        var new_seed;
        while (true) {
            count += 1;
            if (count > max_iter && !runforever)
                break;
            console.log(`${count}/${max_iter}begin`);
            // // making param to reset the shape_var
            // param.reset_shape_var
            try {
                // // generate new inputs
                new_seed = this._generate_new_input();    ////this._generate(seeds, obey=obey, reduce_failure=this.fstatus.reduce_failure)
            } catch (e) {
                console.log(e.message);
                console.log('fuzzer failed to generate an input, will try again');
                continue;
            }

            if (this.exit_flag)
                return;
            if (JSON.stringify(new_seed) === '{}') {
                console.log('Empty Input');
            }
            // // new_seed: new input
            // await this._test(new_seed, count, obey, gen_script, this.config.save);
            await this.diff_test(new_seed,count, obey, gen_script, this.config.save)
            console.log(`${count}/${max_iter} done`);
            // console.log('{:-^50}'.format(''))
        }
    }

    async run(obey = true, max_iter = 0, max_time = 0, gen_script = false) {
        assert(max_iter != 0 || max_time != 0);
        var start = new Date().getTime();
        if (max_iter) {
            await this._run_max_iter(max_iter, obey, gen_script = gen_script);
        } else {
           await this._run_max_iter(max_time, obey, gen_script = gen_script);
        }
        var end = new Date().getTime();
        var config = this.config;

        function output_fuzzing_time(sec) {
            var timefile = config.workdir + '/fuzz_time';
            var msg = `\n////// Total time used for input generation and testing: ${sec} sec\n`;
            console.log(msg);
            fs.writeFileSync(timefile, sec.toString());
            // util.output_time(timefile, sec, msg);
        }

        function output_mutate_coverage() {
            var out = config.output_mutate_coverage();
            fs.writeFileSync(config.workdir + '/mutate_op_coverage.csv', JSON.stringify(out));
            // util.write_csv(this.config.workdir + '/mutate_op_coverage.csv', out)
        }

        output_fuzzing_time((end - start)/1000);
        if (this.config.mutate_p > 0)
            output_mutate_coverage();
        for (var ok_seed of this.ok_see_list){
            fs.appendFileSync(config.workdir + '/ok_seed_name.csv', JSON.stringify(ok_seed)+"\n");
        }
        fs.appendFileSync(config.workdir + '/ok_seed_name.csv', "ok_seed_num:"+JSON.stringify(this.ok_seed_num)+"\n");
    }

    _check_exist_seed(){
    //     //
    //     This function checks if seeds exist
    //     if exists, use one of the existing seeds to mutate
    //     TODO: consider if this func makes sense: we don't have coverage to guide mutation
    // :return:
    //     //
        var seeds = [];
        return seeds;
    }

    async diff_test(seed, count = null, obey = true, gen_script = false, save = false) {
        var seed_fpath = '';
        var is_duplicate = false;
        var info = util.save_seed_to_file(seed, this.config.workdir, this.config.target,'gen_order', count, save);
        seed_fpath = info["fpath"];
        is_duplicate = info["is_dup"];
        var inputs=Object.values(seed.gen_inputs);
        var convert_tensor=Object.values(seed.convert_tensor);
        var dtype=Object.values(seed.dtype);
        var varshape=Object.values(seed.varshape);
        this.total_iter += 1;
        console.log("in diff_test");
        var diff = await diff_test.diff_test(inputs, this.config.target,convert_tensor,dtype,varshape,count,obey);
        if (diff.states.includes(0)){
            this.ok_seed_num++;
            this.ok_see_list.push(seed_fpath)
        }
        if (diff.wasm_memory_bug===true) {
            var e_wasm_fpath;
            e_wasm_fpath = seed_fpath.replace('.p', '.u');
            // only writes if not exist
            util.write_record(path.join(this.config.workdir, 'memory_bug_record'), `${e_wasm_fpath}, ${count}\n`);
            if (this.config.save && !fs.existsSync(e_wasm_fpath)) {
                fs.writeFile(e_wasm_fpath, JSON.stringify(diff), function (err) {
                    if (err) {
                        return console.error(err);
                    }
                });
            }
            console.log("*********************");
            console.log("find memory bug");
            console.log("**********************");
        }

        if (diff.type !== "no diff") {
            var e_fpath;
            e_fpath = seed_fpath.replace('.p', '.d');
            // only writes if not exist
            util.write_record(path.join(this.config.workdir, 'diff_record'), `${e_fpath}, ${count}\n`);
            if (this.config.save && !fs.existsSync(e_fpath)) {
                fs.writeFile(e_fpath, JSON.stringify(diff), function (err) {
                    if (err) {
                        return console.error(err);
                    }
                });
            }
            console.log("===========================");
            console.log(diff);
            console.log("===========================");
        } else {
            console.log("no diff!!!!!!!")
        }
        if (!save)
            util.save_seed(seed_fpath, seed);


    }

    async _test(seed, count = null, obey = true, gen_script = false, save = false) {
        // //
        // This function tests the target function with seed
        //     :return: 0 if the test was fine; 1 if the test had issue; 2 if the test timeout
        // //
        var seed_fpath = '';
        var is_duplicate = false;
        var model_input_path = '', input_duplicate = false;
        var test_script_path = ''
        //model_input_path, input_is_duplicate = '', false
        // try:
        // var save_info=seed.gen_inputs;
        // save_info.convert_tensor=seed.convert_tensor;
        // save_info.structure=seed.structure;
        var info = util.save_seed_to_file(seed, this.config.workdir, this.config.target,'gen_order', count, save);
        seed_fpath = info["fpath"];
        is_duplicate = info["is_dup"];
        // except OverflowError:
        //     util.DEBUG('OverflowError when trying to save file.')
        //     return

        this.total_iter += 1;
        var model_input;
        if (this.config.model_test) {
            while (true) {
                try {
                    model_input = this._generate_model_input();
                    // if (util.detect_nan_inf(model_input))
                    //     throw('Model input contains nan/inf.');
                    [model_input_path, input_duplicate] = util.save_seed_to_file(model_input, this.config.workdir, this.config.target,'gen_order_model_input', count, save);
                    break;
                } catch (e) {
                    console.log('fuzzer failed to generate a model input. Will try again.');
                }
            }
        } else {
            model_input = false;
        }

        // // if we want to generate a python script to reproduce the generated input
        // test_script_path, content = util.gen_input_test_script(seed_fpath, model_input_path,
        //     this.import_statements,
        //     this.config.package,
        //     this.target_func_statement, save=save) if gen_script else ''

        // util.write_record(os.path.join(this.config.workdir, 'script_record'), '%s, %s\n' % (test_script_path, count))
        // if is_duplicate and (this.config.model_test == false or input_duplicate):
        // // assume the chance that both layer_obj and model_input duplicate is low
        // util.log('skipping a duplicate')
        // return Status.PASS

        var exception_list = this.config.exceptions;
        var res = [];
        // var worker_func = this._expect_ok;
        var res_status;
        if (obey) {
            [this.fstatus, res_status]=await this._expect_ok(seed, model_input, res, seed_fpath, exception_list, this.config.model_test, count);
        } else {
            [this.fstatus, res_status]=await this._expect_exception(seed, model_input, res, seed_fpath, exception_list, this.config.model_test, count);
        }

        // var res_status;
        // [this.fstatus, res_status] = res.pop();
        // assert res_status == Status.PASS or res_status == Status.FAIL
        if (res_status === "FAIL")
            // # failure: either (expect_ok & got exception) or (expect_exception & no exception)
            // util.report_failure(seed_fpath, test_script_path, self.config.workdir)
            console.log("find a crash");
        if (!save)
            util.save_seed(seed_fpath, seed);
        return res_status

    }

    async _run_test(seed, model_test){
        // var verbose_ctx = util.verbose_mode(this.config.verbose);
        var contain_nan = false;
        // var browser_config0=[{ backend: 'wasm' }, { msg: 'initial' },{size:shape},{operator:operator},{seed:seed}];
        // var browser_wasm_result = puppeteer_browser_execute(browser_config0);
        var inputs=Object.values(seed.gen_inputs);
        var convert_tensor=Object.values(seed.convert_tensor);
        var backend="cpu";
        var result=await runapi.operator_exec(inputs,convert_tensor,this.config.target,backend);
        // console.log("result",result);
        function have_not_number(arr){
            if (arr.includes(null) || arr.includes(NaN) || arr.includes(Infinity)){
                return true;
            }
            return false;
        }
        if (!model_test && this.config.check_nan){
            try{
                // var is_not_number = [];
                // result.map(function (value, index) {
                //     is_not_number[index]=have_not_number(value);
                // });
                contain_nan=have_not_number(result.flat(10));
                // if (is_not_number.includes(true)) {
                //     contain_nan = true;
                // }
            }  catch (e) {
                console.log(e.message)
            }
        }
        if (contain_nan)
            throw (new Error("contain nan"));
        return result;
    }

    async _expect_ok(seed, model_input, res, seed_fpath = '', exception_list = [], model_test = false, count = null) {
        // NOTE: although we expect status to be ok, the constraints could be very loose
        // so even though we think we might have generated valid input according to constraints
        // might still cause exceptions
        var constructor_fail = true;
        try {
            // verbose_ctx = util.verbose_mode(this.config.verbose)
            // with verbose_ctx:
            //   this._target_func(**seed)
            var layer_obj = await this._run_test(seed, model_test);
            if (model_test) {
                constructor_fail = false;
                this._run_model_test(layer_obj, model_input);
            }

            if (seed_fpath)  // seed_fpath == '' when we don't want to save the input
                this.add_ok_seed(seed_fpath);
            else {
                res.push([this.fstatus, "PASS"]);
                // return [this.fstatus, "PASS"];
            }
            this.fstatus.is_consec_fail = false;
            this.fstatus.consec_fail_count = 0;
            res.push([this.fstatus, "PASS"]);
            return [this.fstatus, "PASS"];
        } catch (e) {
            if (e.message === "SystemExit") {
                system.exit(SYS_EXIT);
            } else if (e.message === "ZeroDivisionError") {
                system.exit(ZERO_DIV_EXIT);
            } else if (e.message === "ZeroDivisionError") {
                system.exit(ZERO_DIV_EXIT);
            } else if (e.message === "CustomCrash") {
                system.exit(CustomCrash.code);
            } else {
                // NOTE: with current setting, due to lack of detailed documentation
                // exceptions frequently occur in this case (especially on what valid data type should be)
                // MAY WANT TO consider to ADD another mode of execution to only care about sys signals
                var message=e.message;
                console.log('FuzzerMessage: expects function execution to be ok, but exception occurred.');
                console.log('------------ Exception Message ------------');
                console.log(e)
                console.log('-------------------------------------------');
                if (seed_fpath) {
                    // when we don't want to save the seed
                    res.push([this.fstatus, "FAIL"]);
                    // return [this.fstatus, "FAIL"];
                }
                // # save exception message to file
                // assert seed_fpath.endswith('.p')
                var e_fpath;
                if (constructor_fail)
                    e_fpath = seed_fpath.replace('.p', '.e');
                else
                    e_fpath = seed_fpath.replace('.p', '.emt');      //# exception for model testing
                // only writes if not exist
                util.write_record(path.join(this.config.workdir, 'exception_record'), `${e_fpath}, ${count}\n`);
                if (this.config.save && !fs.existsSync(e_fpath)) {
                    fs.writeFile(e_fpath, message, function (err) {
                        if (err) {
                            return console.error(err);
                        }
                    });
                }
                this.add_excpt_seed(seed_fpath);
                this.fstatus.consec_fail_count += 1;
                // if this.fstatus.is_consec_fail:
                //     if this.fstatus.consec_fail_count > this.config.consec_fail:
                //         util.log('max consecutive failure reached, will try to reduce failure')
                //         this.fstatus.reduce_failure = true
                // else:
                //     this.fstatus.is_consec_fail = true
                res.push([this.fstatus, "FAIL"]);
                return [this.fstatus, "FAIL"];
            }
        }
    }

    async _expect_exception(seed, model_input, res, seed_fpath = '', exception_list = [], model_test = false, count = null) {
        var had_exception = false;
        var constructor_fail = true;
        try {
            // #     verbose_ctx = util.verbose_mode(this.config.verbose)
            // #     with verbose_ctx:
            //     #         this._target_func(**seed)
            var layer_obj = await this._run_test(seed, model_test);
            if (model_test) {
                constructor_fail = false;
                this._run_model_test(layer_obj, model_input);
            }
        } catch (e) {
            // # save exception message to file
            console.log('FuzzerMessage: expects function execution to be exception, exception occurred.')
            console.log('------------ Exception Message ------------')
            console.log(e)
            console.log('-------------------------------------------')
            if (seed_fpath) {
                // assert seed_fpath.endswith('.p')
                var e_fpath;
                if (constructor_fail)
                    e_fpath = seed_fpath.replace('.p', '.e');
                else
                    e_fpath = seed_fpath.replace('.p', '.emt');      //# exception for model testing

                util.write_record(path.join(this.config.workdir, 'exception_record'), `${e_fpath}, ${count}\n`);
                // # # only writes if not exist
                if (this.config.save && !fs.existsSync(e_fpath)) {
                    fs.writeFile(e_fpath, e.message, function (err) {
                        if (err) {
                            return console.error(err);
                        }
                    });
                }
            }
            had_exception = true;
            if (exception_list.length === 0) {
                //# we don't know the valid exceptions, so we treat any exception as valid
                res.push([this.fstatus, "PASS"]);
                return;
            }
            if (exception_list.includes(e.name)) {
                //  # in the valid list, also ok
                res.push((this.fstatus, Status.PASS));
                return;
            }
            // # not in the valid list
            // # might be an error but it could be caused by insufficient knowledge of valid exceptions
            console.log(`Caught exception ${e.name} is not in the valid exception list, but may not be an error`);
            res.push([this.fstatus, Status.PASS]);
            return;
        }
        if (!had_exception)
            console.log('Error: expected to have exception but got no exception');
        res.push([this.fstatus, "FAIL"]);
        return;
    }





}


module.exports=Fuzzer;