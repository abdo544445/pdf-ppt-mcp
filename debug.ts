import fs from 'fs';
import { PdfService } from './src/services/pdf.service';

async function main() {
    try {
        const pages = await PdfService.getDocumentPages('./test.pdf');
        console.log("Pages:", pages);
    } catch (err) {
        console.error("DEBUG ERROR:", (err as Error).stack || err);
    }
}
main();
