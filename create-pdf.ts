import PDFDocument from 'pdfkit';
import fs from 'fs';

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('test.pdf'));
doc.fontSize(25).text('This is page 1 of the test PDF.', 100, 100);
doc.addPage();
doc.fontSize(25).text('This is page 2. We are testing the document reader MCP.', 100, 100);
doc.end();
console.log("PDF created successfully as test.pdf");
