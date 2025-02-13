var fs=require("fs")
var path=require("path")
var crypto=require("crypto")
var mathjs=require("mathjs")
function read_json(path){
    var data=JSON.parse(fs.readFileSync(path));
    console.log("read file success");
    return data;
}

function save_seed(fpath, seed){
    // DEBUG('Size of seed: '+str(get_obj_size(seed)))
    // if get_obj_size(seed) > MAX_SEED_SIZE:  # to avoid OverflowError
    // DEBUG('Failed to save seed to %s. File too large.'%fpath)
    // return
    var fd=fs.openSync(fpath,'w');
    fs.writeFileSync(fd,JSON.stringify(seed));
}


function random_prob(threshold){

    // # random.random() generates float within [0.0, 1.0)
    if (threshold ===  0 )
        return false;
    if (threshold  === 1)
        return true;
    if (Math.random() >= threshold)
        return false;
    return true;     //# <=
}


function check_file_dup(record_fpath, file_path){
    // if (fs.existsSync(record_fpath)) {
    //     console.log('Directory exists!')
    // } else {
    //     console.log('Directory not found.')
    // }
    if (fs.existsSync(record_fpath)){
        var content = fs.readFileSync(record_fpath).toString();
        var file_list = [];
        content=content.split("\n");
        for(var x of content){
            file_list.push(x.split(',')[0]);
        }
        if (file_list.includes(file_path))
            return true;
    }

    return false;
}

function save_seed_to_file(seed,workdir,target_op,save_to_file='gen_order',gen_id,save=false){
    var fname=crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex')+'.p';
    var is_dup=false;
    var save_file = path.join(workdir, save_to_file);
    var fpath=workdir+'/'+target_op+'_'+fname;
    is_dup=check_file_dup(save_file, fpath);
    if (is_dup){
        return {"fpath":fpath,"is_dup":is_dup};
    }
    if (save){
        save_seed(fpath,seed);
    }
    return {"fpath":fpath,"is_dup":is_dup};
}

function save_json(path,data){
    fs.writeFile(path, JSON.stringify(data),  function(err) {
        if (err) {
            return console.error(err);
        }
        console.log("save config success");
    });
}

function add_to_file(fpath, content, mode){
    var fd=fs.openSync(fpath,mode);
    fs.writeFileSync(fd,content);
    fs.close(fd);
}

function write_record(f_path, line){
    if (fs.existsSync(f_path))
        add_to_file(f_path, line, 'a');
    else
        add_to_file(f_path, line, 'w');
}



function is_float(num){
    if(num.toString().indexOf(".") != -1){
        return true;
    }else return false;
}
function gobble_until(start_idx, text, chars=''){
    if (text.length<=start_idx)
        console.log(`unable to process ${text}; likely an incorrect input format.`);
    var s='';
    for (var i=start_idx;i<text.length;i++){
        if (text[i]===' ')
            continue;
        if (chars.includes(text[i]))
            break;
        s+=text[i];
    }
    return [s,i+1];
}
function gobble_var_dep(tok, sp_str=''){
    /*
    the shape of a variable is dependent on the length of another variable
e.g. [len:&dim] means the shape should be the length of the var 'dim'
the preceeding '&' before a name means that name is a var
    Also could be [len:dim] means 'dim' is not an input variable
    :param tok: the token to be parsed
    :param sp_str: special string for delimiter
    :return:
     */
    var sp_index;
    var zg=/^[0-9a-zA-Z]*$/;
    if (sp_str != ''){
        sp_index = tok.indexOf(sp_str)+sp_str.length;
        tok=tok.slice(sp_index);
    }

    var is_var = false;
    var ret_ref = '';
    for (var i=0;i<tok.length;i++){
        if (tok[i]==='&'){
            is_var=true;
            continue;
        }
        else if ('+-*/'.includes(tok[i])){
            i-=1;
            break;
        }
        else if ('_()'.includes(tok[i])){
            break;
        }
        // else if (tok[i]==='_')
        //     var s='pass';
        else if(!zg.test(tok[i]))
            console.error(`invalid spec ${tok}`);
        ret_ref+=tok[i];
    }
    tok=tok.slice(i+1);
    return[tok,ret_ref,is_var];
}

function gobble_unequal_sign(tok){
    /*
    parse the >, >=, <, <= signs
    e.g. [>=5] means a list with min length 5
    NOTE: does not support composition of other operators
    such as [>=len:&a]
    :param tok: the token to be parsed, e.g. '>=5'
    :return:
    */
    var num,_,ref,is_var;
    if (!tok || tok.length<2){
        console.log(`invalid spec${tok}`);
    }
    if (tok[1]==="="){
        if (tok.length<=2)
            console.error(`expect a number after ${tok} but none was provided`);
        [num,_]=gobble_until(2,tok);
    }else
        [num,_]=gobble_until(1,tok);
    if (isNaN(num))
        [_,ref,is_var]=gobble_var_dep(num);
    else [ref,is_var]=[null,false];
    return[ref,is_var];
}

function str_is_int(s){
        if(/^\d+$/.test(s))
            return true;
        else
            return false;

}

function str_is_float(s){
    if (str_is_int(s))
    return false;
    return !isNaN(s.replace('-', '').replace('.', '', 1));
}

function str_is_inf(s){
    return ['inf', '-inf'].includes(s);
}

function str_is_number(s){
    return (str_is_int(s) || str_is_float(s) || str_is_inf(s));
}

function str_is_bool(s){
    return ['true', 'false'].includes(s);

}

function convert_to_num(s){
    if (str_is_int(s))
    return parseInt(s);
    else if(str_is_float(s))
    return parseFloat(s);
    else if(s === 'inf')
    return Infinity;
    else if (s === '-inf')
    return -Infinity;
    else
    console.error(`failed to convert ${s} to a number`);
}


function infer_type_from_str(s){
    if (str_is_int(s))
        return 'int';
    else if (str_is_float(s))
        return 'float';
    else if (str_is_bool(s))
        return 'bool';
    return 'string'
}

// 生成 size个 [min,max]范围内的整数
function randInt(min,max,size){
    var number = new Array(size);
    for (var i=0; i<size ; i++){
        number[i]=~~(Math.random()*(max-min+1)+min);
    }
    return number;
}

function check_shape_validity(shape){
    for (var value of shape){
        if (!(value%1===0) || (value < 0))
        console.log(`value ${value.toString()} in shape  ${shape.toString()} is invalid`);
    }

    return shape.length;
}
function random_choice(array){
    var index=Math.floor((Math.random()*array.length));
    return array[index];
}

function random_uniform_int(low,high,...dimensions) {
    // 取首元素,创建数组
    const length = dimensions.shift();
    var arr = new Array(length);
    if (dimensions.length === 0) {
        // arr=new Int32Array(length);
        // 一维数组 赋值
        for (let i = 0; i < length; i++) {
            arr[i] = ~~(Math.random()*(high -low+1)+low);

        }
    } else {
        // 多维数组 递归创建
        for (let i = 0; i < length; i++) {
            arr[i] = random_uniform_int(low,high, ...dimensions);
        }
    }
    return arr;
}

function set_array_value_1(array){
    if (!(array[0] instanceof Array)){
        array.fill(1);
        return array;
    }
    else {
        for(var i=0;i<array.length;i++)
            set_array_value_1(array[i])
    }
    return array;
}

function randomFloat32() {
    // 生成一个 32 位二进制数的随机整数
    const randomInt32 = Math.floor(Math.random() * 2 ** 32);

    // 将随机整数转换成二进制字符串
    const binaryString = randomInt32.toString(2);

    // 如果字符串长度不足 32 位，则在前面补充 0
    const paddedBinaryString = '0'.repeat(32 - binaryString.length) + binaryString;

    // 将二进制字符串转换成符号位、指数位和尾数位
    const sign = paddedBinaryString.charAt(0) === '1' ? -1 : 1;
    const exponent = parseInt(paddedBinaryString.substring(1, 9), 2) - 127;
    const mantissa = parseInt(paddedBinaryString.substring(9), 2) / 2 ** 23 + 1;

    // 计算浮点数值并返回
    return sign * mantissa * 2 ** exponent;
}


function random_uniform(low,high,...dimensions) {
    // 取首元素,创建数组
    const length = dimensions.shift();
    const arr = new Array(length);
    if (dimensions.length === 0) {
        // 一维数组 赋值
        for (let i = 0; i < length; i++) {
            arr[i] = Math.random()*(high -low)+low;
        }
    } else {
        // 多维数组 递归创建
        for (let i = 0; i < length; i++) {
            arr[i] = random_uniform(low,high, ...dimensions);
        }
    }
    return arr;
}

function random_uniform_float32(low,high,...dimensions) {
    // 取首元素,创建数组
    const length = dimensions.shift();
    const arr = new Array(length);
    if (dimensions.length === 0) {
        // 一维数组 赋值
        for (let i = 0; i < length; i++) {
            arr[i] =randomFloat32();
        }
    } else {
        // 多维数组 递归创建
        for (let i = 0; i < length; i++) {
            arr[i] = random_uniform_float32(low,high, ...dimensions);
        }
    }
    return arr;
}

function is_type_numeric(dtype){
    var pat = /^Number([0-9]*)|^int([0-9]*)|^uint([0-9]*)|^float([0-9]*)|^complex([0-9]*)/
    if (pat.exec(dtype))
        return true;
    return false;
}

function get_default_range(np_dtype){
    var high,low;
    if (np_dtype.includes('number')|| np_dtype.includes('float')){
        // low = Number.MIN_VALUE;
        // high = Number.MAX_VALUE;

        low = -2147483647;
        high = 2147483647;
        // # NOTE: if it's 64 bits, we have to half the low and high to have a representable range (high - low) w/ float64
        // if (n_bits === '64'){
        //     low /= 2
        //     high /= 2
        // }
    }else if (np_dtype.includes('Int')){
        // low = Number.MIN_SAFE_INTEGER;
        // high = Number.MAX_SAFE_INTEGER;
        // low = -2147483647;
        // high = 2147483647;
        low = 1;
        high = 10;

    }else {
        console.log(`Error: cannot get range for dtype ${np_dtype}` );
        system.exit(1);
    }
    return [low, high]
}

function choose_epsilon(np_dtype){
    if (np_dtype.includes('float') || np_dtype.includes('Number'))
        return Number.EPSILON;
    else if (np_dtype.includes('int'))
        return 1;
    console.log(`Error: cannot get epsilon for dtype: ${np_dtype}`);
}

function np_random_choice(array,size,replace){
    var choice=[];
    if (replace===true){
        for (var s=0;s<size;s++){
            var index=Math.floor((Math.random()*array.length));
            choice.push(array[index]);
        }

    }
    else {
        while (true){
            index=Math.floor((Math.random()*array.length));
            if (!(choice.includes(array[index])))
                choice.push(array[index]);
            if (choice.length===size)
                break;
        }
        return choice;
    }


    return array[index];

}



function try_cast(val, cast_type){
    var cast_value;
    if (cast_type === 'int')
        cast_value=parseInt(val);
    else if(cast_type === 'float')
        cast_value=parseFloat(val);
    else if (cast_type === 'complex')
        cast_value=mathjs.complex(val);
    else if (cast_type === 'string')
        cast_value=val.toString();
    else if(cast_type === 'number')
        cast_value=val.toNumber();
    else if(cast_type === 'bool')
        cast_value=val.toBool();
    else{
        console.log(`unknown cast type ${cast_type}`);
    }
    try{
        return cast_value;
    }catch (e){
        console.log(`unable to cast value ${val.toString()} to type ${cast_type}`);
    }

}


function str_mutation(s, max_edit_dist=1){
    function _random_letter(){
        var letters = [];
        for (var s="0";s<"9";s++)
            letters.push(s);
        for (s="a";s<"z";s++)
            letters.push(s);
        for (s="A";s<"Z";s++)
            letters.push(s);
        return random_choice(letters);
    }

    function _deletion(chars, idx){
        chars[idx]='';
        return chars;
    }


    function _insertion(chars, idx){
        var new_char = _random_letter();
        chars.splice(idx, new_char);
        return chars;
    }

    function _substitute(chars, idx){
        var new_char = _random_letter();
        if (chars.length === 0){
            return new_char;
        }
        chars[idx] = new_char;
        return chars;
    }
    var k = randInt(1, max_edit_dist,1)[0];  //# selected edit distance
    var chars=s.split("");
    for (var i=0;i<k;i++){
        // # mutate k times
        // var chars = list(s) if s else []
        if (chars.length===0){
            var idx = 0
            var mutate_op = random_choice([_insertion, _substitute]);
        }else {
            mutate_op = random_choice([_deletion, _insertion, _substitute]);
            idx = randInt(0,chars.length-1,1)[0];
        }
        chars=mutate_op(chars, idx);
    }
    return chars.join("");

}



module.exports = {
    save_json,
    read_json,
    is_float,
    gobble_unequal_sign,
    gobble_until,
    gobble_var_dep,
    str_is_number,
    str_is_bool,
    str_is_int,
    convert_to_num,
    save_seed_to_file,
    save_seed,
    random_prob,
    write_record,
    infer_type_from_str,
    randInt,
    check_shape_validity,
    random_choice,
    random_uniform,
    random_uniform_int,
    random_uniform_float32,
    is_type_numeric,
    get_default_range,
    choose_epsilon,
    np_random_choice,
    try_cast,
    str_mutation,
    set_array_value_1
};

// console.log(is_float("13"));
// var _,ref;
// [_,ref]=[1,3];
// console.log(_,ref);
//
// var zg=/^[0-9a-zA-Z]*$/;
// console.log(zg.test('_'));

// var s={"a":"b","1":"2"}
// console.log("2"in s)

// var  x=random_uniform(1,2,...[1,1,1]);
// console.log(x);
// var math=require("mathjs")
// var x=math.complex(2,3)
// console.log(x.re)
// var arr=new Array(2,)
// console.log(arr)
// console.log(parseInt("valid"))
// for(var i=0;i<100;i++){
//     console.log(Math.floor(Math.random()*4))
// }



// var x=convert_typedarray([[[3]]],Int8Array,3)
// console.log(x)
// fs.writeFile("e_fpath", "jjjjj", function (err) {
//     if (err) {
//         return console.error(err);
//     }
// });




function convert_typedarray(data,array_dtype,pick_ndim){

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

// var data={}
// data.x=convert_typedarray([[[3]],[[3]],[[3]]],Int8Array,3)
// console.log(data.x)
// fs.writeFileSync("./typedarray",JSON.stringify(data.x))
// var read_content=JSON.parse(fs.readFileSync("./typedarray"))
// console.log(read_content)
// console.log(randInt(0,7,13))
// console.log(random_uniform_int(1,10,...[3,4,5]))
// console.log(str_mutation("abcdef"));
//
// var s="abcd".split("");
// s[0]="e";
// console.log(Number.MAX_SAFE_INTEGER)
// console.log(Number.EPSILON)

// var  x=new Set([[[1],[2],[3]]]);
// console.log(x);
// console.log([1,2,3]===[2,3])

// console.log(randomFloat32())