// test-pdfjs.mjs
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const require2 = createRequire(import.meta.url);

// Set worker to local file using file:// URL
const workerPath = require2.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
console.log('Worker path:', workerPath);
console.log('Worker URL:', pathToFileURL(workerPath).href);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const data = new Uint8Array(readFileSync('test.pdf'));
const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
console.log('Pages:', doc.numPages);
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1.0 });
console.log('Page 1 size:', viewport.width, 'x', viewport.height);
doc.destroy();
console.log('SUCCESS');
