import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Lazy-loaded modules (ESM imports in CJS context)
let pdfjsLib: any = null;
let Tesseract: any = null;

async function loadPdfjs() {
    if (!pdfjsLib) {
        pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // Resolve the worker from the locally installed package to avoid version mismatch
        const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    }
    return pdfjsLib;
}

async function loadTesseract() {
    if (!Tesseract) {
        Tesseract = await import('tesseract.js');
    }
    return Tesseract;
}

let CanvasGlobal: any = null;

async function loadCanvas() {
    if (!CanvasGlobal) {
        CanvasGlobal = await import('canvas');
    }
    return CanvasGlobal;
}

class NodeCanvasFactory {
    private canvasModule: any;

    constructor(canvasModule: any) {
        this.canvasModule = canvasModule;
    }

    create(width: number, height: number) {
        const canvas = this.canvasModule.createCanvas(width, height);
        const context = canvas.getContext('2d');
        return {
            canvas,
            context,
        };
    }

    reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

export class OcrService {
    /**
     * Get total number of pages in a PDF (for OCR context).
     */
    static async getPageCount(filePath: string): Promise<number> {
        const pdfjs = await loadPdfjs();
        const data = new Uint8Array(fs.readFileSync(filePath));
        const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
        const count = doc.numPages;
        doc.destroy();
        return count;
    }

    /**
     * OCR a single page of a PDF.
     * Renders the page to a pixel buffer, then runs Tesseract OCR on it.
     */
    static async ocrPage(filePath: string, pageNumber: number): Promise<{ text: string; totalPages: number }> {
        const pdfjs = await loadPdfjs();
        const tesseract = await loadTesseract();

        const data = new Uint8Array(fs.readFileSync(filePath));
        const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
        const totalPages = doc.numPages;

        if (pageNumber < 1 || pageNumber > totalPages) {
            doc.destroy();
            throw new Error(`Page ${pageNumber} out of range (1 - ${totalPages})`);
        }

        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR
        const width = Math.floor(viewport.width);
        const height = Math.floor(viewport.height);

        const canvasModule = await loadCanvas();
        const canvasFactory = new NodeCanvasFactory(canvasModule);
        const canvasAndContext = canvasFactory.create(width, height);

        await page.render({
            canvasContext: canvasAndContext.context as any,
            viewport,
            canvasFactory,
        }).promise;

        const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');

        const { createWorker } = tesseract;
        const worker = await createWorker('eng');

        const result = await worker.recognize(imageBuffer);

        const text = result.data.text.trim();
        await worker.terminate();
        doc.destroy();

        return { text, totalPages };
    }

    /**
     * OCR all pages of a PDF and return them as an array.
     */
    static async ocrAllPages(filePath: string, maxPages = 20): Promise<string[]> {
        const totalPages = await this.getPageCount(filePath);
        const limit = Math.min(totalPages, maxPages);
        const results: string[] = [];

        for (let i = 1; i <= limit; i++) {
            const { text } = await this.ocrPage(filePath, i);
            results.push(text);
        }

        return results;
    }
}
