const fs=require("fs");
// var tf=require("@tensorflow/tfjs");
// // require("@tensorflow/tfjs-backend-cpu")
// const crypto=require("crypto");
// // const kwargs_gen=require("./kwargs_gen.js");
// // const wasm=require("@tensorflow/tfjs-backend-wasm");
// require("@tensorflow/tfjs-node");
const log = require('@vladmandic/pilogger');
const puppeteer_browser_execute=require("./puppeteer_browser_execute")
var tf=require("/home/quanlili/tfjs_source_code/tfjs/tfjs-4.2.0/tfjs-core/tfjs-core_pkg");
require("/home/quanlili/tfjs_source_code/tfjs/tfjs-backend-wasm/tfjs-backend-cpu_pkg");
// // var tf=require("@tensorflow/tfjs-core");
// require("/home/quanlili/tfjs_source_code/tfjs/tfjs-backend-wasm/tfjs-backend-cpu_pkg");
// var tf=require("/home/quanlili/tfjs_source_code/tfjs-4.4.0/tfjs/tfjs-core/tfjs-core-instru/tfjs-core_pkg");
// var tf=require("@tensorflow/tfjs-core");
// require("/home/quanlili/tfjs_source_code/tfjs-4.4.0/tfjs/tfjs-backend-wasm/tfjs-backend-cpu_pkg");
// var wasm=require("/home/quanlili/tfjs_source_code/tfjs/tfjs-backend-wasm/tfjs-backend-wasm_pkg");
require("/home/quanlili/tfjs_source_code/tfjs/tfjs-node")
var _ = require('lodash');
const {abs} = require("mathjs");
const Bytes2Str = (arr) => {
    var str = "";
    for (var i=0; i<arr.length; i++) {
        var tmp;
        var num = arr[i];
        if (num < 0) {
            //此处填坑，当byte因为符合位导致数值为负时候，需要对数据进行处理
            tmp = (255+num+1).toString(16);
        } else {
            tmp = num.toString(16);
        }
        if (tmp.length == 1) {
            tmp = "0" + tmp;
        }
        str += tmp;
    }
    return str;
}
// function toArrayBuffer(buf) {
//     const hex = Bytes2Str(buf);
//     const u8array = new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
//     var input=new Float32Array(u8array.buffer);
//     return input;
// }


function array_sub(arr1,arr2){
    var result =[];
    var arr3=arr1.flat(10);
    var arr4=arr2.flat(10);
    arr3.map(function(value, index) {
        result[index] = Math.abs(arr4[index]-value);
    })
    return result;
}

function item_sum(arr) {
    return eval(arr.join("+"));
}

function have_diff(arr1,arr2){
    var yuzhi=50;
    var diff=false;
    var itemsum;
    if (Array.isArray(arr1) && Array.isArray(arr2)){
        itemsum =item_sum(array_sub(arr1,arr2));
    }
    else itemsum = Math.abs(arr1-arr2)
    if(itemsum>yuzhi){
        diff=true;
    }
    return[diff,itemsum];
}
function have_not_number(arr){
    if (arr.includes(null) || arr.includes(NaN) || arr.includes(Infinity)){
        return true;
    }
    return false;
}
function isAllEqual(array){
    if(array.length>0){
        return !array.some(function(value,index){
            return value !== array[0];
        });
    }else{
        return true;
    }
}

async function operator_exec(seed,operator,convert_tensor,dtype,varshape,backend_name){
    console.log("in operator_exec");
    try{
        await tf.setBackend(backend_name);
        // if(backend_name==="wasm") {
        //     await wasm.setWasmPaths('/home/quanlili/Downloads/web_DL_framework_testing/node_modules/@tensorflow/tfjs-backend-wasm/dist/');
        // }
        await tf.ready();
        var result={"error":"","state":0,shape:""};

        var seed_copy = _.cloneDeep(seed);
        console.log("cloneDeep done");

        for (var i=0;i<seed_copy.length;i++){
            if (seed[i]==="undefined" || seed[i]===null){
                seed_copy[i] = undefined;
            }
            if (convert_tensor[i]===true && dtype[i]==="Int"){
                seed_copy[i] = tf.tensor(seed_copy[i],varshape[i],dtype="int32");
            }else if (convert_tensor[i]===true && dtype[i]==="number"){
                seed_copy[i] = tf.tensor(seed_copy[i],varshape[i],dtype="float32");
            }
        }
        var prediction=await tf[operator](...seed_copy);
        console.log("prediction done");
        if (prediction instanceof tf.Tensor){
            if (prediction.dtype==="string"){
                result.prediction= [0,0];
                result.shape=[2];
            }else {
                result.prediction=prediction.arraySync();
                result.shape=prediction.shape;
            }

            await prediction.dispose();
        }else if (prediction instanceof tf.TensorBuffer){
            result.prediction=prediction.values;
            result.shape=prediction.shape;
        }else if (prediction instanceof Object){
            if (operator==="moments"){
                result.prediction=prediction["mean"].arraySync();
                result.shape=prediction["mean"].shape;
            }else {
                result.prediction=prediction["result"].arraySync();
                result.shape=prediction["result"].shape;
            }
            tf.dispose(Object.values(prediction));
        }else {
            console.log("return value type is non-tensor");
        }
    }
    catch(err){
        result.error=err.message;
        result.state=1;
        result.prediction="";
    }
    for (i=0;i<seed_copy.length;i++)
        if (convert_tensor[i]===true){
            await tf.dispose(seed_copy[i]);
        }
    return result;
}

async function diff_test(seed,operator,convert_tensor,dtype,varshape,count = null, obey = true, gen_script = false, save = false) {
    // console.log(tf.version)
    var diff={};
    var save_info={};
    var weights_dict={};
    var input_array;

    // var res_cpu_tmp=await operator_exec(seed,convert_tensor,operator,"cpu");
    // log.data("platform: nodejs", "operator:",operator, ";backend:cpu", ";result_state:",res_cpu.state,"result_error:",res_cpu.error);
    // var res_wasm=await operator_exec(seed,convert_tensor,operator,"wasm");
    // console.log(tf.cons_value);

    var res_cpu=await operator_exec(seed,operator,convert_tensor,dtype,varshape,"cpu");
    log.data("platform: nodejs", "operator:",operator, ";backend:cpu", ";result_state:",res_cpu.state,"result_error:",res_cpu.error);

    var res_node=await operator_exec(seed,operator,convert_tensor,dtype,varshape,"tensorflow");
    log.data("platform: nodejs", "operator:",operator, ";backend:tensorflow", ";result_state:",res_node.state,";result_error:",res_node.error);
    // for (var i=0;i<seed.length;i++)
    //     if (seed[i] instanceof Array){
    //         seed[i] = tf.tensor(seed[i],seed[i].shape,"int32");
    //     }
    var browser_config0=[{ backend: 'wasm' }, { msg: 'initial' },{seed:seed},{operator:operator},{convert_tensor:convert_tensor},{dtype:dtype},{varshape:varshape}];
    var browser_wasm_result = await puppeteer_browser_execute.puppeteer_browser_execute(browser_config0);
//    log.data("platform: browser", "operator:",operator, ";backend:", "wasm", ";result_state:",browser_wasm_result.state,";result_error:",browser_wasm_result.error);

    let browser_config1=[{ backend: 'webgl' }, { msg: 'initial' },{seed:seed},{operator:operator},{convert_tensor:convert_tensor},{dtype:dtype},{varshape:varshape}];
    var browser_webgl_result = await puppeteer_browser_execute.puppeteer_browser_execute(browser_config1);
    //log.data("platform: browser", "operator:",operator, ";backend:", "webgl", ";result_state:",browser_webgl_result.state,";result_error:",browser_webgl_result.error);

    // let browser_config2=[{ backend: 'webgpu' }, { msg: 'initial' },{seed:seed},{convert_tensor:convert_tensor},{operator:operator}];
    // var browser_webgpu_result = await puppeteer_browser_execute(browser_config2);
    // log.data("platform: browser", "operator:",operator, ";backend:", "webgpu", ";result_state:",browser_webgpu_result.state,";result_error:",browser_webgpu_result.error);

    // // add webgpu
    // var states=[res_cpu.state,res_node.state,browser_wasm_result.state,browser_webgl_result.state];
    // var result=[res_cpu.prediction,res_node.prediction,browser_wasm_result.prediction,browser_webgl_result.prediction];
    // var error=[res_cpu.error,res_node.error,browser_wasm_result.error,browser_webgl_result.error];
    // var shape=[res_cpu.shape,res_node.shape,browser_wasm_result.shape,browser_webgl_result.shape];
    // add webgpu
    var states=[res_cpu.state,res_node.state,browser_wasm_result.state,browser_webgl_result.state];
    var result=[res_cpu.prediction,res_node.prediction,browser_wasm_result.prediction,browser_webgl_result.prediction];
    var error=[res_cpu.error,res_node.error,browser_wasm_result.error,browser_webgl_result.error];
    var shape=[res_cpu.shape,res_node.shape,browser_wasm_result.shape,browser_webgl_result.shape];

    diff.states=states;
    diff.error=error;
    diff.operator=operator;
    diff.shape=shape;
    diff.wasm_memory_bug=false;
    diff.error_stack="";
    // if (browser_wasm_result.state===1 && browser_wasm_result.error.includes("Program terminated with exit")){
    //     diff.wasm_memory_bug=true;
    //     diff.error_stack=browser_wasm_result.warn_message;
    // }
    // var x2=JSON.stringify(save_info);
    if(!states.includes(0) && (obey===true)){
        diff.type="all crash---expected ok but exception";
        log.data(states);
    }else if (!states.includes(0) && (obey===false)){
        diff.type="no diff";
        log.data(states);
    }
    else if(states.includes(1) && states.includes(0)){
        diff.type="crash diff";
        // await fs.writeFileSync(path_crash, JSON.stringify(save_info));
        log.data(states);
    }else if (!states.includes(1)){
        if (isAllEqual(shape)){
            diff.type="shape diff";
        }
        else {
            var is_not_number = [];
            result.map(function (value, index) {
                // console.log(value);
                if (Array.isArray(value))
                    is_not_number[index]=have_not_number(value.flat(10));
            });
            if (is_not_number.includes(true)) {
                diff.type = "Not number diff";
                diff.nan=is_not_number;
                log.data(states);
            }else {
                var num_diff=[];
                diff.result=[];
                var i=0;
                for (var indexi=0;indexi<result.length-1;indexi++){
                    for (var indexj=indexi+1;indexj<result.length;indexj++){
                        [num_diff[i],diff.result[i]]=have_diff(result[indexi],result[indexj]);
                        i=i+1;
                    }
                }
                if (num_diff.includes(true)) {
                    diff.type = "Function err diff";
                    // await fs.writeFileSync(path_func, JSON.stringify(save_info));
                    log.data(states);
                    log.data(diff.type);
                } else if (obey===false){
                    diff.type="all ok---expected exception but ok";
                    log.data(states);
                }else {
                    diff.type="no diff";
                    log.state("no diff");
                    //save(save_info,layer_cls+".json");
                }
            }
        }

    }
    // console.log("==========diff=============");
    // console.log(diff)
    return diff;
}

module.exports = {
    diff_test,
    log
};

// var seed=[[[[[3]]]],[[[[1]]]],1,"same"];
// var convert_tensor=[false,false,false,false];
// diff_test(seed,convert_tensor,"conv2d");
