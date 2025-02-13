// process.env.http_proxy="http://127.0.0.1:7890"
// process.env.HTTPs_PROXY="http://127.0.0.1:7890"
const ts=require("typescript")
const {OpenAI}=require("openai")
const {HttpsProxyAgent} = require("https-proxy-agent")
const fs= require("fs")
const path = require('path');
// const {delay} = require("lodash/function");


function visit(node) {
    var params_info={}
    var constraints=[];
    var node_name="";
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        var abstract_types={};

        //处理抽象类型
        if (node.typeParameters!==undefined){
            for (const abtype of node.typeParameters){
                var abtype_name=abtype.name.getText();
                if (abtype.constraint!==undefined){
                    abstract_types[abtype_name]= abtype.constraint.getText();
                }
            }
        }


        var params=[];
        for (const param of node.parameters) {
            const paramName = param.name.getText();
            var paramType = (param.type!=undefined)?param.type.getText():"bool";
            const paramDefaultValue = param.initializer;
            if(paramType!==undefined && paramType.includes("T")){
                params.push('$'+paramName);
            }else {
                params.push(paramName);
            }
            paramType=paramType.replace(/[\r\n]+/g,"").replace(/\s+/g,"")
            var paramtypes=paramType.split("|")
            for (var i=0;i<paramtypes.length;i++){
                if (paramtypes[i] in abstract_types){
                    paramtypes[i]=abstract_types[paramtypes[i]];
                }
            }
            const questionToken=param.questionToken;
            // 处理参数的类型注解、泛型约束、默认值等
            console.log(`Parameter: ${paramName}`);
            console.log(`Type Annotation: ${paramType ? paramtypes.join("|") : 'No type annotation'}`);
            // console.log(`Default Value: ${paramDefaultValue ? paramDefaultValue.getText() : 'No default value'}`);
            // console.log(`optional: ${questionToken ? questionToken.getText() : 'Not optional'}`);
            params_info[paramName]={"type":paramType ? paramtypes.join("|"):"","default value":paramDefaultValue ? paramDefaultValue.getText():"","optional":questionToken ? questionToken.getText():""};

        }

        node_name=node.name.getText().replace("_","");
        return {"op":node_name,"params_info":params_info,"constraints":constraints}
    }
    return  ts.forEachChild(node, visit);

}

function  get_constrains(op_config){
    var cons_config={"op":{},"params_info":{},"constraints":{}};
    cons_config["op"]=op_config["op"]
    var params_info=op_config["params_info"];
    for (var param in params_info){
        var structure_set = new Set();
        var rank_set = new Set();
        var dtype_set = new Set();
        var enumv_set = new Set();
        var len_set = new Set();
        var param_type = params_info[param].type.replace(/[\r\n]+/g,"").replace(/[ ]+/g,"");
        var param_types = param_type.split("|");
        for (var pt of param_types){
            if(pt.includes("Array<T")){
                structure_set.add("Tensor_List");
            }
            if(pt.match(/Tensor(\d+)D/)!==null){
                structure_set.add("Tensor");
                rank_set.add(pt.match(/Tensor(\d+)D/)[1]);
                dtype_set.add("number")
            }else if(pt.match(/\[(.*?)\]/i)!=null){
                structure_set.add("List");
                var match =pt.match(/\[(.*?)\]/i);
                len_set.add(match[1].split(",").length);
                if (match[1]!=""){
                    dtype_set.add(match[1].split(",")[0]);
                }

            }else if(pt==="number"){
                structure_set.add("Int");
                dtype_set.add("Int");
            }
            // else if(pt==="bool"){
            //     structure_set.add("bool");
            //     dtype_set.add("bool");
            // }
            else if (pt.includes("'")){
                structure_set.add("String");
                enumv_set.add(pt.replace(/'/g,""));
            }else if(pt.includes("Tensor") && !pt.includes("TensorLike")){
                structure_set.add("Tensor");
                rank_set.add("1");
                rank_set.add("2");
                rank_set.add("3");
                rank_set.add("4");
                dtype_set.add("number")
            }
            // else {
            //     //不考虑conv_util.ExplicitPadding这种结构
            // }
        }
        var default_values=params_info[param]["default value"];
        if (default_values!==''){
            var dmatch=default_values.match(/\[(.*?)\]/i);
            if (dmatch){
                const isInteger = /^\d+$/.test(dmatch[1].split(",")[0]);
                if (isInteger){
                    dtype_set.delete("number");
                    dtype_set.add("Int");
                }else {

                    dtype_set.add("bool");
                }
            }else {
                const isInteger = /^\d+$/.test(default_values);
                if (isInteger){
                    dtype_set.delete("number");
                    dtype_set.add("Int");
                }else if (default_values==="false" || default_values==="true"){
                    structure_set.add("bool");
                    dtype_set.add("bool");
                }
            }
        }
        var optional=params_info[param]["optional"];
        if (optional==="?"){
            structure_set.add("String");
            enumv_set.add("undefined");
        }
        var new_param_info={};
        if (structure_set.size>0){
            new_param_info["structure"]=[...structure_set];
        }
        if (rank_set.size>0){
            new_param_info["rank"]=[...rank_set];
        }
        if (dtype_set.size>0){
            new_param_info["dtype"]=[...dtype_set];
        }
        if (len_set.size>0){
            new_param_info["len"]=[...len_set];
        }
        if (enumv_set.size>0){
            new_param_info["enumv"]=[...enumv_set];
        }
        if (params_info[param]["default value"]!==''){
            new_param_info["default"]=params_info[param]["default value"].replace(/'/g,"");
        }

        cons_config["params_info"][param]=new_param_info;

    }
    cons_config["constraints"]=op_config["constraints"];
    return cons_config
}

function traverseFolder(folderPath) {
    // 读取文件夹内容
    const files = fs.readdirSync(folderPath);
    var operator=[]
    // 遍历文件和子文件夹
    files.forEach((file) => {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        // 判断是否为文件夹
        if (!stat.isDirectory() && !file.includes("util") && !file.includes("test") && !file.includes("fused_ops")&& !file.includes("fused_types") && !file.includes("ops")) {
            // 递归遍历子文件夹
            operator.push(filePath);
        }

    });
    return operator;
}

function extractParameterConstraints(filename){
    const code = fs.readFileSync(filename, 'utf-8');
    const sourceFile = ts.createSourceFile(filename, code, "es2017", true);
    var op_config=visit(sourceFile);
    // console.log(op_config);
    var cons=get_constrains(op_config);
    return cons
}

async function gpt_test(data){
    const openai=new OpenAI({
        apiKey:"sk-xxxxxxxxx",
    })
    const data_example = await fs.readFileSync('conv2d_code.ts', 'utf8').toString();
    var prompt_example= "Act as a professional software engineer specializing in deep learning libraries. Your task is to meticulously analyze a given JavaScript-based deep learning library code,  identify and extract all constraints on the parameters. These constraints are critical for ensuring the successful execution of the kernel function within the given code. Once identified, articulate these constraints in the form of clear, concise, and precise mathematical expressions or logical statements. \n To guide your analysis, consider aspects such as parameter types, dimensional requirements, value ranges, and any preconditions or postconditions related to the parameters. \n Example:\n Given the following source code for conv2d operator, the output should systematically list constraints on the parameters:\n"+data_example
    var prompt="Now, apply this methodical approach to the following code. Extract and present the constraints of parameters in a clear, structured format, akin to the provided example.\n "+data

    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt_example},{role: 'assistant', content: '{"x":["x_rank==[3,4]"],"filter":["filter_rank==[4]","dataFormat_value=\'NHWC\'? x_shape[3]==filter_shape[3]: x_shape[1]=filter_shape[3]"],"strides":["strides_value==1 or dilations_value=1","strides_value>0"],"dilations":["dilations_value>0"],"pad":["dimRoundingMode_value!=undefined ? pad_type==int : pad_type=string"]'},{ role: "user", content: prompt}],
        model: "gpt-4-0613",
        top_p:0.1,
    });
    // console.log(chatCompletion.choices[0].message);
    return chatCompletion.choices[0].message.content;
}



const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(){

    // 指定要遍历的文件夹路径
    const folderPath = 'tfjs_source_code/tfjs-4.1.0/tfjs/tfjs-core/src/ops';

// 调用遍历函数
    var operators=await traverseFolder(folderPath);

    for (var operator of operators){
        console.log(operator)
        var operatornew=operator.split("/").pop()
        if(operatornew.startsWith("p") || operatornew.startsWith("r") ||operatornew.startsWith("s")||operatornew.startsWith("t") || operatornew.startsWith("u") || operatornew.startsWith("v") || operatornew.startsWith("w") || operatornew.startsWith("z")){
            var basic_cons= await extractParameterConstraints(operator);
            var code = await fs.readFileSync(operator, 'utf-8').toString();
            var checkPadOnDimRoundingMode=fs.readFileSync("./check_function_code/checkPadOnDimRoundingMode.ts", 'utf-8').toString();
            var eitherStridesOrDilationsAreOne=fs.readFileSync("./check_function_code/eitherStridesOrDilationsAreOne.ts", 'utf-8').toString();
            var stridesOrDilationsArePositive=fs.readFileSync("./check_function_code/stridesOrDilationsArePositive.ts", 'utf-8').toString();
            if(code.includes("checkPadOnDimRoundingMode")){
                code=code+"\n"+checkPadOnDimRoundingMode;
            }
            if (code.includes("eitherStridesOrDilationsAreOne")){
                code=code+"\n"+eitherStridesOrDilationsAreOne;
            }
            if (code.includes("stridesOrDilationsArePositive")){
                code=code+"\n"+stridesOrDilationsArePositive;
            }
            await delay(20000);
            basic_cons.constraints=await gpt_test(code);
            basic_cons.constraints=JSON.parse(basic_cons.constraints);
            var filename="./cons_new/"+operator.split("/").pop().replace(".ts","")+".json";
            fs.writeFileSync(filename,JSON.stringify(basic_cons))

        }


    }

}
get()
