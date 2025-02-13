const ts=require("typescript")
const {OpenAI}=require("openai")
const {HttpsProxyAgent} = require("https-proxy-agent")
const fs= require("fs")
const path = require('path');
var exec = require('child_process').exec;

// async function count_bug(){
//     var diff_file = await fs.readFileSync("our_bug.csv", 'utf-8');
//     const lines = diff_file.split(/\r?\n/);
//
//     for (var  line of lines){
//         var cmdStr = 'cp '+line.replace(".d",".p")+' ./diff_file/';
//
//         exec(cmdStr, function (err, stdout, srderr) {
//
//             if(err) {
//
//                 console.log(srderr);
//
//             } else {
//
//                 console.log(stdout);
//
//             }
//
//         });
//     }
// }
// count_bug()


async function count_bug(){
    var diff_file = await fs.readFileSync("our_bug2.txt","utf-8");
    const lines = diff_file.split(/\r?\n/);
var bug=new Set();
try {
    for (var line of lines) {
        var data = await fs.readFileSync("./" + line.replace("﻿", ""), "utf-8")
        var diff_info = JSON.parse(data);
        var operator = diff_info.operator;
        var cpu_error = diff_info.error[0].replace(/0x[sp 0x[0-9a-fA-F]/g, "").replace(/\d+,\s*|\d+\s*|,\s*/g, "").replace(/\[.*?\]/g,'').replace(/-/g,"").replace("undefined",'');
        var tf_error = diff_info.error[1].replace(/0x[sp 0x[0-9a-fA-F]/g, "").replace(/\d+,\s*|\d+\s*|,\s*/g, "").replace(/-/g,).replace(/\[.*?\]/g,'').replace("undefined",'');
        var wasm_error = diff_info.error[2].replace(/0x[sp 0x[0-9a-fA-F]/g, "").replace(/\d+,\s*|\d+\s*|,\s*/g, "").replace(/-/g,).replace(/\[.*?\]/g,'').replace("undefined",'');
        var webgl_error = diff_info.error[3].toString().replace(/0x[sp 0x[0-9a-fA-F]/g, "").replace(/\d+,\s*|\d+\s*|,\s*/g, "").replace(/-/g,).replace(/\[.*?\]/g,'').replace(/undefined|e\+|\./g,'');
        if (cpu_error !== "") {
            bug.add(operator + "_" + cpu_error);
            // console.log(cpu_error)
        }
        if (tf_error !== "" && !tf_error.includes("not registered for backend")) {
            bug.add(operator + "_" + tf_error);
        }
        if (wasm_error !== "" && !wasm_error.includes("not registered for backend")) {
            bug.add(operator + "_" + wasm_error);
        }
        if (webgl_error !== "") {
            bug.add(operator + "_" + webgl_error);
        }
    }
}catch (e) {
    console.log(e.message)
}
    // 将Set转换为数组，因为JSON.stringify不支持Set
    const setArray = Array.from(bug);

// 将数组转换为JSON字符串
    const jsonString = JSON.stringify(setArray);
    console.log(setArray)
console.log(setArray.length)
// 将JSON字符串写入文件
    fs.writeFileSync('set_data.json', jsonString);
}
count_bug()
