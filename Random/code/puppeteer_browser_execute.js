const child = require('child_process');
const puppeteer = require('puppeteer');
// const pti = require('puppeteer-to-istanbul');
const log = require('@vladmandic/pilogger');
const test = require('./test');

const options = {
    default: 'launch',
    launch: {
        // launch is preferred but not working in wsl2 as puppeteer tries to connect to same address specified in remote-debugging
        // executablePath: '/opt/google/chrome/google-chrome',
        userDataDir: '/home/quanlili/Downloads/browserdata_random', // C:\BrowserData
        ignoreHTTPSErrors: true,
        headless: true,
        devtools: true,
        // args: ['--remote-debugging-port=9222', '--enable-unsafe-webgpu', '--use-gl=swiftshader','--disable-dawn-features=disallow_unsafe_apis','--disable-dev-shm-usage','--shm-size=3gb'],
        args: ['--remote-debugging-port=9222 ', 'enable-unsafe-webgpu', '--enable-webgl', '--use-gl=angle','--use-angle=swiftshader', '--shm-size=3gb','--disable-dev-shm-usage','--enable-features=Vulkan'],
    },
    launch_firefox:
        {
            product: 'firefox',
            userDataDir: '/home/quanlili/Downloads/web_DL_framework_testing/', // C:\BrowserData
            ignoreHTTPSErrors: true,
            headless: false,
        },
    connect: {
        // connect workaround using child.exec to start browser and then connect to it
        // executablePath: '"/Applications/Google Chrome.app" --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --headless --use-gl=desktop --enable-unsafe-webgpu',
        executablePath: '" ~/.cache/puppeteer/chrome/linux-117.0.5938.149/chrome-linux64/chrome" --remote-debugging-address=0.0.0.0 --headless --use-gl --enable-webgl --enable-unsafe-webgpu',
        ignoreHTTPSErrors: true,
        browserURL: 'http://127.0.0.1:9222',
    },
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logStdIO(ok, buffer) {
    const lines = buffer.toString().split(/\r\n|\n\r|\n|\r/);
    for (const line of lines) {
        if (line.length < 2) continue;
        if (ok) log.data('stdout:', line);
        else log.warn('stderr:', line);
    }
}

async function launchBrowser() {
    log.info('launching browser');
    let browser;
    try {
        browser = await puppeteer.launch(options.launch);
    } catch (err) {
        log.error(err);
        //browser = await connectBrowser();
        browser = await puppeteer.launch(options.launch);
    }
    return browser;
}

async function connectBrowser() {
    log.info('launching browser');
    await child.exec(options.connect.executablePath, (error, stdout, stderr) => {
        if (error) log.error('exec:', error);
        logStdIO(true, stdout);
        logStdIO(false, stderr);
    });
    await delay(600);
    let browser;
    try {
        browser = await puppeteer.connect(options.connect);
    } catch (err) {
        log.error(err);
        process.exit(1);
    }
    return browser;
}

async function browserConsole(msg) {
    // const describe = (jsHandle) => jsHandle.executionContext().evaluate((obj) => `<${typeof obj}>${obj}`, jsHandle);
    // const describe = (jsHandle) => jsHandle.executionContext().evaluate((obj) => (typeof obj === 'object' || Array.isArray(obj) ? obj : ''), jsHandle);
    const describe = (jsHandle) => jsHandle.evaluate((obj) => (typeof obj === 'object' || Array.isArray(obj) ? obj : ''), jsHandle);
    const args = await Promise.all(msg.args().map((arg) => describe(arg)));
    const filtered = args.filter((arg) => arg !== '');
    log.data(msg.type(), msg.text(), ...filtered);
}

async function startBrowser() {
    /** @type puppeteer.Browser */
    const browser = (options.default === 'launch') ? await launchBrowser() : await connectBrowser();
    return browser;
}

async function getPage(browser) {
    /** @type puppeteer.Page */
        // Create a new incognito browser context.
        // const context = await browser.createIncognitoBrowserContext();
        // Create a new page in a pristine context.
        // const page = await context.newPage();
    const page = await browser.newPage();

    // Enable both JavaScript and CSS coverage
    await Promise.all([
        page.coverage.startJSCoverage(),
        page.coverage.startCSSCoverage()
    ]);
    // await page.emulate(puppeteer.devices['iPhone 13']);
    // await page.goto("file:///home/quanlili/Downloads/web_DL_framework_testing/webgpu_test.html");
    await page.goto(`file://${__dirname}/test.html`);
    // await page.goto(`http://127.0.0.1:8080/test.html`);

    await page.setDefaultTimeout(2000);
    page.on('domcontentloaded', () => log.state('dom ready'));
    page.on('load', () => log.state('load complete'));
    page.on('console', (msg) => browserConsole(msg));
    page.on('error', (error) => log.error(error));
    page.on('pageerror', (error) => log.error(error));
    return page;
}

async function run(page, func, env) {
    try {

        const result = await page.evaluate(func,env);
        await result;
        // await console.log("result:",JSON.stringify(result));
        await page.waitForFunction('!!window.DONE');
        return result;
    } catch (err) {
        log.state('eval:', err.message);
    }
}
function getTotalCoverage(coverage) {
    let total = 0;
    for (const filePath in coverage) {
        for (const s in coverage[filePath].s) {
            total += coverage[filePath].s[s] ? 1 : 0;
        }
        for (const f in coverage[filePath].f) {
            total += coverage[filePath].f[f] ? 1 : 0;
        }
        for (const b in coverage[filePath].b) {
            for (const i of coverage[filePath].b[b]) {
                total += i ? 1 : 0;
            }
        }
    }

    return total
}
async function puppeteer_browser_execute(config) {
    log.header();
    let browser;
    let page0;
    let page1;
    // wasm default
    browser = await startBrowser();
    page0 = await getPage(browser);
    // await page0.emulate(puppeteer.devices['iPhone 13']);
    await delay(300);
    let result=await run(page0, test, config);
    // console.log("result ",JSON.stringify(result));
    await delay(500);
    // const [jsCoverage, cssCoverage] = await Promise.all([
    //     page0.coverage.stopJSCoverage(),
    //     page0.coverage.stopCSSCoverage(),
    // ]);


    // pti.write([...jsCoverage, ...cssCoverage], { includeHostname: true , storagePath: './.nyc_output' })
    // let total_coverage=getTotalCoverage(jsCoverage);
    await browser.close();
    return result;
    // // webgl default
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, config);
    // // await run(page0, test, [{ backend: 'webgl' }, { msg: 'initial' },{input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}]);
    // // page1 = await getPage(browser);
    // // await run(page1, test, [{ backend: 'webgl' }, { msg: 'cached' },{input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}]);
    // await browser.close();

    // webgl with enabled uniforms and disabled depthwiseconv
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgl' }, { MSG: 'initial' }, {input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}, { WEBGL_PACK_DEPTHWISECONV: false }, { WEBGL_USE_SHAPES_UNIFORMS: true }]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgl' }, { MSG: 'cached' }, {input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}, { WEBGL_PACK_DEPTHWISECONV: false }, { WEBGL_USE_SHAPES_UNIFORMS: true }]);
    // await browser.close();

    // webgpu default
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgpu' }, { msg: 'initial' },{input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgpu' }, { msg: 'cached' },{input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}]);
    // await browser.close();

    // // webgpu with gsls
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgpu' }, { MSG: 'initial' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGPU_USE_GLSL: true }]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgpu' }, { MSG: 'cached' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGPU_USE_GLSL: true }]);
    // await browser.close();

    // // webgl with enabled uniforms and disabled depthwiseconv
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgl' }, { MSG: 'initial' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGL_PACK_DEPTHWISECONV: false }, { WEBGL_USE_SHAPES_UNIFORMS: true }]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgl' }, { MSG: 'cached' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGL_PACK_DEPTHWISECONV: false }, { WEBGL_USE_SHAPES_UNIFORMS: true }]);
    // await browser.close();

    // // webgpu default
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgpu' }, { msg: 'initial' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgpu' }, { msg: 'cached' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }]);
    // await browser.close();
    //
    // // webgl with gsls
    // browser = await startBrowser();
    // page0 = await getPage(browser);
    // await run(page0, test, [{ backend: 'webgpu' }, { MSG: 'initial' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGPU_USE_GLSL: true }]);
    // page1 = await getPage(browser);
    // await run(page1, test, [{ backend: 'webgpu' }, { MSG: 'cached' }, { model: options.modelUrl }, { input: options.imageUrl }, { size: options.inputSize }, { WEBGPU_USE_GLSL: true }]);
    // await browser.close();
}
// let config=[{ backend: 'webgl' }, { msg: 'initial' },{input:[[[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]],[[3,3,3],[3,3,3],[3,3,3]]]]}, {size:[1,3,3,3]}, {operator:"conv2d"}, {kwargs:{"filters":1,"kernelSize":2,"strides":2}}];
// puppeteer_browser_execute(config);
async function puppeteer_browser_execute_(browser,config) {
    let page0;
    let page1;
    page0 = await getPage(browser);
    // await page0.emulate(puppeteer.devices['iPhone 13']);
    // await delay(100);
    let result = await run(page0, test, config);
    // console.log("result ",JSON.stringify(result));
    // await delay(300);
    return result;
}
module.exports = {
    puppeteer_browser_execute,
    startBrowser
};

// async function mytest(){
//     let browser;
//     let page0;
//     let page1;
// // wasm default
//     browser = await startBrowser();
// await delay(500);
//     page0 = await getPage(browser);
//     let browser_config1=[{ backend: 'webgl' }, { msg: 'initial' },{seed:[[[[[3]]]],[[[[3]]]],1,"same"]},{convert_tensor:[false,false,false,false]},{operator:"conv2d"}];
//     let result=await run(page0, test, browser_config1);
//     console.log(result)
//     return
// }
// mytest()
