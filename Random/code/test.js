// executed in managed browser context
const {typeOf} = require("mathjs");

function test(args) {
    // eslint-disable-next-line no-console
    const log = (...msg) => console.log(...msg);
    let tf;
    let message = '';
    const env = [];
    const loadScript = (url) => new Promise((resolve) => {
        const el = document.createElement('script');
        el.src = url;
        el.onload = resolve;
        document.body.appendChild(el);
    });

    async function main() {
        // await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.1.0/dist/tf.js");
        // await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.1.0/dist/tf-backend-wasm.js");
        // await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgpu/dist/tf-backend-webgpu.js");
//         <script src="tfjs-4.2.0/tfjs-core/tfjs-core_pkg/dist/tf-core.js"> </script>
//         <script src="tfjs-4.2.0/tfjs-layers/tfjs-layers_pkg/dist/tf-layers.js"> </script>
// <!-- <script src="tfjs-4.2.0/tfjs-backend-cpu_pkg/dist/tf-backend-cpu.js"> </script> -->
//         <!-- <script src="tfjs-4.2.0/tfjs-backend-webgl/dist/tf-backend-webgl.js"> </script> -->
//         <script src="tfjs-4.2.0-fsantize/tfjs-backend-wasm/tfjs-backend-wasm_pkg/dist/tf-backend-wasm.js"></script>
//         await loadScript("http://127.0.0.1:8080/tfjs-4.2.0/tfjs-core/tfjs-core_pkg/dist/tf-core.js");
//         await loadScript("http://127.0.0.1:8080/tfjs-4.2.0-opt/tfjs-backend-wasm/tfjs-backend-wasm_pkg/dist/tf-backend-wasm.js");
//         await loadScript("http://127.0.0.1:8080/tfjs-4.2.0/tfjs-backend-webgl/tfjs-backend-webgl_pkg/dist/tf-backend-webgl.js");

        await loadScript("http://127.0.0.1:8080/tfjs-4.2.0/tfjs-core/tfjs-core_pkg/dist/tf-core.js");
        await loadScript("http://127.0.0.1:8080/tfjs-4.2.0-fsantize/tfjs-backend-wasm/tfjs-backend-wasm_pkg/dist/tf-backend-wasm.js");
        await loadScript("http://127.0.0.1:8080/tfjs-4.2.0/tfjs-backend-webgl/tfjs-backend-webgl_pkg/dist/tf-backend-webgl.js");
        await window['tf'];
        tf = window['tf'];
        let warnLogs = [];
        const oldWarn = console.warn.bind(console);
        console.warn = function() {
            warnLogs.push(Array.from(arguments).join(' '));
            oldWarn.apply(console, arguments);
        };
        // await tf.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.1.0/dist/');
        await tf.env().set('WASM_HAS_SIMD_SUPPORT', false);
    //     await tf.wasm.setWasmPaths({
    //     'tfjs-backend-wasm.wasm': 'http://127.0.0.1:8080/tfjs-backend-wasm-4.2.0-opt-canary.wasm',
    //         'tfjs-backend-wasm-simd.wasm': 'http://127.0.0.1:8080/tfjs-backend-wasm-simd.wasm',
    //         'tfjs-backend-wasm-threaded-simd.wasm': 'http://127.0.0.1:8080/tfjs-backend-wasm-threaded-simd.wasm'
    // });
            await tf.wasm.setWasmPaths({
            'tfjs-backend-wasm.wasm': 'http://127.0.0.1:8080/tfjs-4.2.0-fsantize/tfjs-backend-wasm/tfjs-backend-wasm_pkg/wasm-out/tfjs-backend-wasm.wasm',
                'tfjs-backend-wasm-simd.wasm': 'http://127.0.0.1:8080/tfjs-4.2.0-fsantize/tfjs-backend-wasm/tfjs-backend-wasm_pkg/wasm-out/tfjs-backend-wasm-simd.wasm',
                'tfjs-backend-wasm-threaded-simd.wasm': 'http://127.0.0.1:8080/tfjs-4.2.0-fsantize/tfjs-backend-wasm/tfjs-backend-wasm_pkg/wasm-out/tfjs-backend-wasm-threaded-simd.wasm'
        });
        var weights_dict;
        var operator;
        var input_array;
        var input_size;
        var backend;
        var operator_kwargs;
        var seed;
        var convert_tensor,dtype,varshape;
        for (const arg of args) {
            const key = Object.keys(arg)[0];
            const val = Object.values(arg)[0];
            if (key === 'backend') {
                await tf.setBackend(val);
                backend=val;
            }
            if (key === 'msg') message = val;
            if (key === 'operator') operator = val;
            if (key === 'seed') seed = val;
            if (key==='convert_tensor') convert_tensor=val;
            if (key==='dtype') dtype=val;
            if (key==='varshape') varshape=val;
            if (key === 'input') input_array = Object.values(val);
            if (key === 'size') input_size = val;
            if (key === 'kwargs') operator_kwargs = val;
            if (key === 'weight') weights_dict=val;
            if (key.startsWith('WEB')) {
                tf.ENV.set(key, val);
                env.push(arg);
            }
        }
        await tf.ready();
        await log(tf.getBackend(),"ready");
        var layer;
        var prediction;
        var result={"error":"","state":0,"shape":""};
        // console.log(input_array);
console.log(typeof seed[1])
        //layer function
        // var input_tensor = await tf.tensor(input_array, input_size, "float32");
        // var weights=await new Array(2);
        // if(weights_dict!="{}"){
        //     weights[0] = await tf.tensor(weights_dict[0]);
        //     weights[1] = await tf.tensor(weights_dict[1]);
        //     operator_kwargs.weights = weights;
        // }else{
        //     log("no weight");
        // }

        try{
            for (var i=0;i<seed.length;i++){
                if (seed[i]==="undefined" || seed[i]===null){
                    seed[i] = undefined;
                }
                if (convert_tensor[i]===true && dtype[i]==="Int"){
                    seed[i] = tf.tensor(seed[i],varshape[i],dtype="int32");
                }else if (convert_tensor[i]===true && dtype[i]==="number"){
                    seed[i] = tf.tensor(seed[i],varshape[i],dtype="float32");
                }
            }
// console.log(seed)
            prediction=await tf[operator](...seed);
            if (prediction instanceof tf.Tensor){
                result.prediction=prediction.arraySync();
                result.shape=prediction.shape;
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
                // tf.dispose(Object.values(prediction));
            }else {
                console.log("return value type is non-tensor");
            }
            // if(backend==="webgpu"){
            //     result.prediction=await prediction.array();
            // }else result.prediction=await prediction.arraySync();
            // result.shape=prediction.shape;
            // await tf.dispose(prediction);
            // for (var i=0;i<seed.length;i++)
            //     if (convert_tensor[i]===true)
            //         await tf.dispose(seed[i]);
        }
        catch(err){
            result.error=err.message;
            result.state=1;
            result.prediction="";
            result.error_stack=err.stack;
            result.warn_message=warnLogs;
        }

        // const agent = await navigator.userAgent.match(/Chrome\/.[0-9]/g);
        // await log({ message, tfjs: tf.version.tfjs, backend: tf.getBackend(), result:result, tensors: tf.memory().numTensors, agent: agent ? agent[0] : 'unknown', env });
        window['DONE'] = true;
        await window['DONE'];
        console.warn=oldWarn;
        return result;
    }

    window.addEventListener('unhandledrejection', (evt) => {
        const msg = evt.reason.message || evt.reason || evt;
        log(msg);
        evt.preventDefault();
        window['DONE'] = true;
    });

    return Promise.resolve(main());
}
module.exports = test;