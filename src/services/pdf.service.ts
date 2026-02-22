import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export class PdfService {
    static async getDocumentPages(filePath: string): Promise<string[]> {
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: buffer });

        try {
            const info = await parser.getInfo({ parsePageInfo: true });
            const totalPages = info.total;

            const pages: string[] = [];
            // Extract each page individually to stay aligned with the API contract 
            // array of strings for each page.
            for (let i = 1; i <= totalPages; i++) {
                const result = await parser.getText({ partial: [i] });
                pages.push(result.text.trim());
            }
            return pages;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            await parser.destroy();
        }
    }

    static async getPage(filePath: string, pageNumber: number): Promise<{ text: string, totalPages: number }> {
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: buffer });

        try {
            const info = await parser.getInfo({ parsePageInfo: true });
            const totalPages = info.total;

            if (pageNumber < 1 || pageNumber > totalPages) {
                throw new Error(`Page number ${pageNumber} out of range (1 - ${totalPages})`);
            }

            const result = await parser.getText({ partial: [pageNumber] });

            return {
                text: result.text.trim(),
                totalPages
            };
        } finally {
            await parser.destroy();
        }
    }
}
