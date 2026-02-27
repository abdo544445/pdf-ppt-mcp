import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export class PdfService {
    static async getDocumentPages(filePath: string, password?: string): Promise<string[]> {
        const buffer = fs.readFileSync(filePath);
        const opts: any = { data: buffer };
        if (password) opts.password = password;
        const parser = new PDFParse(opts);

        try {
            const info = await parser.getInfo({ parsePageInfo: true });
            const totalPages = info.total;

            const pages: string[] = [];
            for (let i = 1; i <= totalPages; i++) {
                const result = await parser.getText({ partial: [i] });
                pages.push(result.text.trim());
            }
            return pages;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('password') || msg.includes('encrypted')) {
                throw new Error('This PDF is password-protected. Please provide the password using the "password" parameter.');
            }
            throw new Error(`Failed to read PDF: ${msg}`);
        } finally {
            await parser.destroy();
        }
    }

    static async getPage(filePath: string, pageNumber: number, password?: string): Promise<{ text: string, totalPages: number }> {
        const buffer = fs.readFileSync(filePath);
        const opts: any = { data: buffer };
        if (password) opts.password = password;
        const parser = new PDFParse(opts);

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
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('password') || msg.includes('encrypted')) {
                throw new Error('This PDF is password-protected. Please provide the password using the "password" parameter.');
            }
            throw error;
        } finally {
            await parser.destroy();
        }
    }
}
