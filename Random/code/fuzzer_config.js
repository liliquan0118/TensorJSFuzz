var Graph=require("./graph.js");
const param=require("./param");
class Fuzzer {
    constructor(kwargs) {
        function _reset_model_test(target_config, model_test){
            if ('layer_constructor' in target_config)
                return model_test;
            else
                return false;
        }
        function _reset_check_nan(target_config, check_nan){
            if ('check_nan' in target_config){
                return check_nan;
            }else {
                return false
            }
        }
        this.allowed_kwargs = ['data_construct', 'dtype_config', 'fuzz_optional_p', 'model_test', 'check_nan', 'mutate_p', 'guided_mutate', 'special_value', 'gen_script', 'save', 'ignore', 'max_iter',
        'max_time', 'conform', 'target_config', 'timeout', 'verbose', 'workdir']
        this.fuzz_optional_p = kwargs.fuzz_optional_p;
        this.model_test=kwargs.model_test;
        this.model_test = kwargs.model_test;
        this.check_nan = kwargs.check_nan;
        this.mutate_p = kwargs.mutate_p;
        this.guided_mutate = kwargs.guided_mutate;
        this.special_value = kwargs.special_value;
        this.gen_script = kwargs.gen_script;
        this.save = kwargs.save;
        this.ignore_constraint = kwargs.ignore;
        this.max_iter = kwargs.max_iter;
        this.max_time = kwargs.max_time;
        this.obey = kwargs["conform"];
        this.timeout = kwargs.timeout;
        this.verbose = kwargs.verbose;
        this.workdir = kwargs.workdir;
        // # dtype config
        var dtype_config = kwargs.dtype_config;
        if (dtype_config==null)
            console.error('missing required dtype config.')
        this.dtype_map = dtype_config;
        // # target config
        var target_config = kwargs.target_config;
        if (target_config ==null)
            console.error('missing required target config.')
        this.package = target_config.package;
        this.version = target_config.version;
        this.target = target_config.op;

        this.model_test = _reset_model_test(target_config, this.model_test)
        this.check_nan = _reset_check_nan(target_config, this.check_nan)

        var exceptions = target_config.exceptions;
        if (exceptions instanceof Array){
            var tmp=[];
            for (var e in exceptions){
                tmp.push(Object.keys(e)[0]);
            }
            exceptions=tmp;
        }
        else {
            exceptions=[];
        }
        this.exceptions = exceptions;
        // # constraints from target config
        // var constraints;
        // if (! this.ignore_constraint)
        //     constraints= target_config.constraints;
        // else constraints=null;
        // this.param_call=Object.keys(constraints);

        // if (target_config.inputs==null)
        //     console.error('no "inputs" in the target config');
        var inputs = Object.keys(target_config.params_info)
        // # create param obj from inputs
       this.param = this.create_param(inputs,target_config.params_info,target_config.constraints)
        this.target_config=target_config;

    }

    check_one_input_constrt(constraints, input_name){
        if (constraints==null) return null;
        var input_constrt = constraints[input_name];
        // # special check to confirm there exist usable constraints
        // console.log(input_name,constraints)
        var constrt_cats = ['dtype', 'ndim', 'shape', 'range', 'enum', 'tensor_t', 'structure', 'default']
        if (Object.keys(input_constrt).every(val=>constrt_cats.includes(val)))
            return input_constrt;
        else return null; //# no useful constraints, simply set it to None
    }

    create_param(inputs,params_info,constraints){
        var param_dict = {}
        for (var one_input of inputs){
            // var input_constrt = this.check_one_input_constrt(constraints, one_input);
            // var mutate_p = this.mutate_p  //# if self.mutate else 0
            var input_info=params_info[one_input];
            var input_cons=null;
            if(one_input in Object.keys(constraints)){
                input_cons=constraints[one_input];
            }
            else {
                input_cons=null;
            }
            var one_param = new param(one_input, input_info,input_cons, this.dtype_map, this.guided_mutate, this.special_value);
            param_dict[one_input] = one_param;
        }
        return param_dict
    }

    output_mutate_coverage(){
        var all_param_obj = Object.values(this.param);
        if (all_param_obj==null)
            return [];
        var out = []
        for (var param of all_param_obj){
            var curr_line = [param.name];
            var title = ['Paramter']
            for (var mutate_op of Object.keys( param.mutator.coverage_record)){
                if (mutate_op != 'zero_ndim'){
                    title.push(mutate_op)
                    curr_line.push(param.mutator.coverage_record[mutate_op])
                }
            }
            for (var dim in param.mutator.zero_ndim_record){
                title.push(`zero_ndim_${dim.toString()}`);
                curr_line.push(param.mutator.zero_ndim_record[dim]);
            }
            out.push(title);
            out.push(curr_line);
        }
        return out
    }

    check_config_validity(){
        for (var attr in this.args){
            if (attr.value ==null)
                console.warning(`${attr.key} is None`);
        }
        return 0;
    }
}

module.exports=Fuzzer;