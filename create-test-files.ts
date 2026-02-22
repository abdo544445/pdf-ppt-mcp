import * as xlsx from 'xlsx';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

// --- Create test.xlsx ---
async function createExcel() {
    const wb = xlsx.utils.book_new();

    // Sheet 1
    const ws1Data = [
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'New York'],
        ['Bob', 25, 'London'],
        ['Charlie', 35, 'Tokyo'],
    ];
    const ws1 = xlsx.utils.aoa_to_sheet(ws1Data);
    xlsx.utils.book_append_sheet(wb, ws1, 'Employees');

    // Sheet 2 
    const ws2Data = [
        ['Product', 'Price', 'Stock'],
        ['Widget', 9.99, 100],
        ['Gadget', 19.99, 50],
        ['Doohickey', 4.99, 200],
    ];
    const ws2 = xlsx.utils.aoa_to_sheet(ws2Data);
    xlsx.utils.book_append_sheet(wb, ws2, 'Products');

    xlsx.writeFile(wb, 'test.xlsx');
    console.log('✅ Created test.xlsx with 2 sheets: Employees, Products');
}

// --- Create test.docx using JSZip + raw XML ---
async function createWord() {
    // We'll use a minimal valid docx structure
    const JSZip = require('jszip');
    const zip = new JSZip();

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>This is the first paragraph of the test Word document.</w:t></w:r></w:p>
    <w:p><w:r><w:t>This is the second paragraph. It contains information about testing the MCP server.</w:t></w:r></w:p>
    <w:p><w:r><w:t>The Document Reader MCP server can read Word, Excel, PDF, and PowerPoint files.</w:t></w:r></w:p>
    <w:p><w:r><w:t>This is the final paragraph. Search for the word 'testing' to find this chunk.</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rels);
    zip.file('word/_rels/document.xml.rels', wordRels);
    zip.file('word/document.xml', document);

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync('test.docx', content);
    console.log('✅ Created test.docx');
}

// --- Create test.pptx using JSZip + raw XML ---
async function createPptx() {
    const JSZip = require('jszip');
    const zip = new JSZip();

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

    const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`;

    const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="257" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
</p:presentation>`;

    const slide1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Slide 1: Introduction to the MCP Document Reader</a:t></a:r></a:p>
          <a:p><a:r><a:t>This server reads PDFs, Word, Excel, and PowerPoint documents.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    const slide2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Slide 2: Features and Benefits</a:t></a:r></a:p>
          <a:p><a:r><a:t>Context-efficient reading by page, chunk, or sheet. Search across the entire document.</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    const slide1Rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rootRels);
    zip.file('ppt/presentation.xml', presentation);
    zip.file('ppt/_rels/presentation.xml.rels', presRels);
    zip.file('ppt/slides/slide1.xml', slide1);
    zip.file('ppt/slides/slide2.xml', slide2);
    zip.file('ppt/slides/_rels/slide1.xml.rels', slide1Rels);
    zip.file('ppt/slides/_rels/slide2.xml.rels', slide1Rels);

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync('test.pptx', content);
    console.log('✅ Created test.pptx with 2 slides');
}

async function main() {
    await createExcel();
    await createWord();
    await createPptx();
    console.log('\n✅ All test files created successfully!');
}

main().catch(console.error);
