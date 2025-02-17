This work is composed of three distinct stages. The initial stage involves constraint extraction, where TensorJSFuzz extracts two types of constraints from a DL operator's source code: (1) type information for each parameter, derived from the function signature's abstract syntax tree, and (2) dependency constraints, extracted from the function body using LLMs. The type information encompasses the structure, data type, rank, and enumerated values of each parameter, while dependency constraints pertain to the permissible range of parameter values and their interdependencies.
The subsequent stage, input generation, builds upon these extracted constraints. Initially, TensorJSFuzz generates random inputs that align with the extracted type information, ensuring type consistency. These inputs are then refined and adjusted to meet the dependency constraints, a process that significantly enhances the likelihood of input validity.
The final stage focuses on bug confirmation. TensorJSFuzz employs three test oracles to identify various bug types, including crash, memory-related, and logic bugs. Specifically, logic bugs are detected through differential testing across different TensorFlow.js backends. Additionally, for memory-related bug detection, particularly in the WebAssembly (Wasm) backend, TensorJSFuzz utilizes AddressSanitizer.

We have released the source code for **TensorJSFuzz** and **Baseline Random**. The source code for DocTer can be found at https://github.com/lin-tan/DocTer. The following steps are instructions of constraints extraction and fuzzing.

**Step1: constraints extraction**  

    1.download the source code of Tensorflow.js 4.1.0 from the link: https://github.com/tensorflow/tfjs/tree/dev_tfjs_4.1.0  

    2.extract type information and dependency constraints by the command:
                 
```
                  cd         TensorJSFuzz
                  node   get_cons.js
```  

**Step2: run fuzzer**  

    1.download the source code of Tensorflow.js 4.1.0 from the link: https://github.com/tensorflow/tfjs/tree/dev_tfjs_4.1.0  

    2.compile the Wasm backend of Tensorflow.js using AddressSanitizer:

```
                  git   clone  git@github.com:tensorflow/tfjs.git
                  cd   tfjs
                  npm     install
                  add  "build": "bazel  build -c opt --copt=-fsanitize=address :tfjs-backend-wasm_pkg" to the tfjs-backend-wasm/package.json
                  cd   tfjs-backend-wasm
                  npm run build
```

    3.compile the CPU, WebGL and tesorflow backend of Tensorflow.js:

```
               cd    tfjs-backend-cpu
               npm run build
               cd    tfjs-backend-webgl
               npm run build
               cd    tfjs-node
               npm run build
```   
    4.run fuzzing:
    
```
               cd    TensorJSFuzz
               node     run_fuzzer.js
```   
 Then you can see the bugs/discrepancies of each operators in the  directory  TensorJSFuzz/workdir

**Step3: reproduce a bug**

    In the file diff_record, the first column is the path to the file which takes a record of the buggy inputs. To reproduce a bug, simply modify the variable filename to this buggy input and run reproduce_script.js:

```
                        node         reproduce_script.js
```
