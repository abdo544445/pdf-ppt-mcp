import fs from 'fs';
const pdfParse = require('pdf-parse');

// Custom page render to ensure a deterministic page separator
function render_page(pageData: any): Promise<string> {
    const render_options = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
    };

    return pageData.getTextContent(render_options)
        .then(function (textContent: any) {
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                    text += item.str;
                } else {
                    text += '\n' + item.str;
                }
                lastY = item.transform[5];
            }
            return text + '\n---PAGE_BREAK---\n';
        });
}

export class PdfService {
    static async getDocumentPages(filePath: string): Promise<string[]> {
        const dataBuffer = fs.readFileSync(filePath);

        try {
            const data = await pdfParse(dataBuffer, {
                pagerender: render_page
            });

            // Split by the marker we inserted
            const pages = data.text.split('\n---PAGE_BREAK---\n');
            // Remove empty trailing items
            return pages.filter((p: string) => p.trim() !== '');
        } catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async getPage(filePath: string, pageNumber: number): Promise<{ text: string, totalPages: number }> {
        const pages = await this.getDocumentPages(filePath);
        if (pageNumber < 1 || pageNumber > pages.length) {
            throw new Error(`Page number ${pageNumber} out of range (1 - ${pages.length})`);
        }
        return {
            text: pages[pageNumber - 1].trim(),
            totalPages: pages.length
        };
    }
}
