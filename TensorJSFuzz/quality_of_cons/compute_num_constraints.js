var fs=require("fs")
var path=require("path")

function listFile(dir,list=[]){
    var arr=fs.readdirSync(dir);
    arr.forEach(function (item){
        var fullpath=path.join(dir,item);
        var stats=fs.statSync(fullpath);
        if (stats.isDirectory()){
            listFile(fullpath,list);
        }else {
            list.push(item);
        }
    });
    return list;
}

var dir_name="./cons_new";
var api_num=0;
var cons_num=0;
var basic_cons_num=0;
var basic_dtype_cons_num=0;
var basic_structure_cons_num=0;
var basic_values_cons_num=0;
var basic_shape_cons_num=0;
var dep_cons_num=0;
var dep_dtype_cons_num=0;
var dep_structure_cons_num=0;
var dep_values_cons_num=0;
var dep_shape_cons_num=0;
var param_num=0;
var param_with_dep_cons=0;
var param_with_dep_cons_=0;

for (var filename of listFile(dir_name)){
    var data=JSON.parse(fs.readFileSync(dir_name+"/"+filename));
    // console.log(data)
    var params_info=data["params_info"];
    var constraints=data["constraints"];
    api_num=api_num+1;
    for (var param in params_info){
        param_num=param_num+1;
        if("dtype" in params_info[param]){
            basic_dtype_cons_num = basic_dtype_cons_num+1;
            cons_num=cons_num+1;
            basic_cons_num=basic_cons_num+1;
        }
        if("structure" in params_info[param]){
            basic_structure_cons_num=basic_structure_cons_num+1;
            cons_num=cons_num+1;
            basic_cons_num=basic_cons_num+1;
        }else{
            console.log(params_info,filename)
        }
        if("rank" in params_info[param] || "len" in params_info[param] || "shape" in params_info[param]){
            basic_shape_cons_num=basic_shape_cons_num+1;
            cons_num=cons_num+1;
            basic_cons_num=basic_cons_num+1;
        }
        if("enumv" in params_info[param] || "value" in params_info[param] || "default" in params_info[param]){
            basic_values_cons_num=basic_values_cons_num+1;
            cons_num=cons_num+1;
            basic_cons_num=basic_cons_num+1;
        }

    }
    var param_set=new Set();
    for (var param_ in constraints){
        param_with_dep_cons_=param_with_dep_cons_+1;
        for (var param_con of constraints[param_]){
            fs.appendFileSync("./constrains_new.csv",filename+";"+param_con+"\n");
            cons_num=cons_num+1;
            for (var param_name of Object.keys(data.params_info)){
                if(param_con.includes(param_name)){
                    param_set.add(param_name);
                }
            }

            if (param_con.includes("_dtype") || param_con.includes("_type")){
                dep_cons_num=dep_cons_num+1;
                dep_dtype_cons_num = dep_dtype_cons_num+1;
                // fs.appendFileSync("./constrains_category_new.csv",filename+";"+"dtype"+";"+param_con+"\n");
            }
            if (param_con.includes("_rank") || param_con.includes("_shape") || param_con.includes("_length")|| param_con.includes("_size")|| param_con.includes(".size")){
                dep_cons_num=dep_cons_num+1;
                dep_shape_cons_num = dep_shape_cons_num+1;
                // fs.appendFileSync("./constrains_category_new.csv",filename+";"+"shape"+";"+param_con+"\n");
            }
            var reg_scalar = new RegExp(param_+"(!?=|>=?|<=?)(.*)","g");
            if(param_con.includes("_value") || reg_scalar.exec(param_con) || param_con.includes("_elements")){
                dep_cons_num=dep_cons_num+1;
                dep_values_cons_num=dep_values_cons_num+1;
                // fs.appendFileSync("./constrains_category_new.csv",filename+";"+"value"+";"+param_con+"\n");
            }
            if (param_con.includes("structure")){
                dep_cons_num=dep_cons_num+1;
                dep_structure_cons_num=dep_structure_cons_num+1;
                // fs.appendFileSync("./constrains_category_new.csv",filename+";"+"structure"+";"+param_con+"\n");
            }
        }
    }
    param_with_dep_cons=param_with_dep_cons+param_set.size;
}
console.log("\n api_num:"+api_num);
console.log("\n cons_num:"+cons_num);
console.log("\n basic_cons_num:"+basic_cons_num);
console.log("\n basic_dtype_cons_num:"+basic_dtype_cons_num);
console.log("\n basic_structure_cons_num:"+basic_structure_cons_num);
console.log("\n basic_values_cons_num:"+basic_values_cons_num);
console.log("\n basic_shape_cons_num:"+basic_shape_cons_num);
console.log("\n dep_cons_num:"+dep_cons_num);
console.log("\n dep_dtype_cons_num:"+dep_dtype_cons_num);
console.log("\n dep_structure_cons_num:"+dep_structure_cons_num);
console.log("\n dep_values_cons_num:"+dep_values_cons_num);
console.log("\n dep_shape_cons_num:"+dep_shape_cons_num);
console.log("\n param_num:"+param_num);
console.log("\n param_with_dep_cons:"+param_with_dep_cons);
console.log("\n param_with_dep_cons_:"+param_with_dep_cons_);