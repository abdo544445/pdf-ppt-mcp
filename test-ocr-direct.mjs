import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import Tesseract from 'tesseract.js';
import { createCanvas } from 'canvas';

export class NodeCanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return {
            canvas,
            context,
        };
    }

    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

const require2 = createRequire(import.meta.url);
const workerPath = require2.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
console.log('Worker src set to:', pdfjsLib.GlobalWorkerOptions.workerSrc);

const data = new Uint8Array(readFileSync('test.pdf'));
const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
console.log('Total pages:', doc.numPages);

const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 2.0 });
const width = Math.floor(viewport.width);
const height = Math.floor(viewport.height);
console.log('Page 1 viewport:', width, 'x', height);

const canvasFactory = new NodeCanvasFactory();
const canvasAndContext = canvasFactory.create(width, height);

console.log('Rendering page...');
await page.render({ canvasContext: canvasAndContext.context, viewport, canvasFactory }).promise;
console.log('Page rendered. Running OCR...');

// Extracted buffer to pass to Tesseract
const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');

const worker = await Tesseract.createWorker('eng');
const result = await worker.recognize(imageBuffer);
console.log('OCR text:', result.data.text.substring(0, 200));

await worker.terminate();
doc.destroy();
console.log('DONE');
