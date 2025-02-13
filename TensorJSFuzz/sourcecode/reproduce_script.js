const diff_test=require("./diff_test_canary")
const fs=require("fs")

async function test(filename){
    var seed=JSON.parse(fs.readFileSync(filename).toString());
    var inputs=Object.values(seed.gen_inputs);
    var convert_tensor=Object.values(seed.convert_tensor);
    var dtype=Object.values(seed.dtype);
    var varshape=Object.values(seed.varshape);
    var operator="conv2d";
    var diff=await diff_test.diff_test(inputs,operator,convert_tensor,dtype,varshape)
    console.log(diff)
}
// console.log(tf.version)
test("workdir/tensorflowjs/conform_constr/concat_1d.json_workdir/concat1d_0aa97065b7cd2271ad14cc0dd27d7d9345a9aa498f08c775ef43d8abdc12ad5a.p")