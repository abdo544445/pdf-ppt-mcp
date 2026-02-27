// test-pdfjs2.cjs - Test resolving from CJS context like the built ocr.service.js
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

async function main() {
    // This is what happens in the built CJS output
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    console.log('Worker resolved to:', workerPath);
    console.log('Worker URL:', pathToFileURL(workerPath).href);

    // Check the version in the worker file
    const content = fs.readFileSync(workerPath, 'utf-8');
    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    console.log('Worker file version:', versionMatch ? versionMatch[1] : 'not found');

    // Also check API version
    const apiPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    const apiContent = fs.readFileSync(apiPath, 'utf-8');
    const apiMatch = apiContent.match(/version\s*=\s*"([^"]+)"/);
    console.log('API file version:', apiMatch ? apiMatch[1] : 'not found');

    // Now actually load and test
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

    const data = new Uint8Array(fs.readFileSync('test.pdf'));
    try {
        const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
        console.log('SUCCESS - Pages:', doc.numPages);
        doc.destroy();
    } catch (e) {
        console.log('ERROR:', e.message);
    }
}

main();
