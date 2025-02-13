#!/usr/bin/env node
"use strict";
// Object.defineProperty(exports, "__esModule", { value: true });
var fs=require("fs")
var path = require("path")
var child_process=require('child_process')
const util = require("./util");
const FuzzerConfig = require("./fuzzer_config");
const Fuzzer = require("./fuzzer");
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
// 递归创建目录 同步方法
function mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}
function save_config(config_data){
    util.save_json(config_data['workdir']+'/fuzzing_config.json',config_data)
}

async function run_fuzzer(config){
    var test_package="tensorflowjs";
    var constraints_folder="./extracted_constraints";
    var config_path="./config/ci.config";
    // var record_work=[];
    var subdir=config["mode"];
    if (config["constr"]==="yes")
        subdir+="_constr";
    else
        subdir+="_noconstr";
    var WORKDIR="workdir/"+test_package+"/"+subdir;
    var ok_seed=0;
    for (var c of listFile(constraints_folder)){
        var workdir=`${WORKDIR}/${c}_workdir`;
        mkdirsSync(workdir);
        var args={"target_config":constraints_folder+"/"+c,
            "dtype_config":"dtype_config/dtype_config.json",
            "data_construct":null,
            "fuzz_optional_p":1,
            "model_test":false,
            "check_nan":false,
            "mutate_p":0,
            "guided_mutate":false,
            "special_value":false,
            "gen_script":false,
            "save":true,
            "ignore":false,
            "max_iter":1,
            "max_time":0,
            "conform":false,
            "timeout":5,
            "verbose":false,
            "workdir":"./seed"
        }
        args.workdir=workdir;
        args.fuzz_optional_p=config.fuzz_optional_p;
        args.mutate_p=config.mutate_p;
        args.timeout=config.timeout;
        args.max_iter=config.max_iter;
        if (config.constr==="no")
            args.ignore=true;
        if (config.mode==="conform")
            args.conform=true;
        if (config.save_script==="yes")
            args["save"]=true;
        save_config(args);    //save config
        // args.data
        args['target_config'] = await util.read_json(path.resolve(__dirname,args.target_config));
        // console.log(configs['target_config']);
        args['dtype_config'] = await util.read_json(path.resolve(__dirname,args.dtype_config));
        var fuzzer_config = await new FuzzerConfig(args);
        var fuzzer = await new Fuzzer(fuzzer_config, args.data_construct);
        await fuzzer.run(args.conform, args.max_iter, args.max_time, args.gen_script);
        ok_seed=ok_seed+fuzzer.ok_seed_num;
        await fs.appendFileSync("ok_seed_num.csv",c+","+JSON.stringify(fuzzer.ok_seed_num)+"\n")

    }
    console.log("Finished fuzzing all APIs");
    await fs.appendFileSync("ok_seed_num_2.csv","total,"+JSON.stringify(ok_seed)+"\n")

}



var config={
    "mode":"conform",
    "constr":"yes",
    "fuzz_optional_p":0.2,
    "mutate_p":0.4,
    "max_iter":1000,
    "timeout":50,
    "save_script":"no"
}
run_fuzzer(config)