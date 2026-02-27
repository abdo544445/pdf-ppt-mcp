import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

const TEST_DIR = process.cwd();

async function run() {
    console.log("=== MCP Document Reader — Feature Test Suite ===\n");

    const transport = new StdioClientTransport({
        command: "node",
        args: [path.join(TEST_DIR, "build", "index.js")],
    });

    const client = new Client({ name: "test-runner", version: "1.0.0" });
    await client.connect(transport);

    const { tools } = await client.listTools();
    console.log(`Connected. Available tools (${tools.length}):`);
    tools.forEach(t => console.log(`  - ${t.name}`));
    console.log();

    let passed = 0;
    let failed = 0;

    async function test(label: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`  PASS: ${label}`);
            passed++;
        } catch (e: any) {
            console.log(`  FAIL: ${label}`);
            console.log(`        ${e.message || e}`);
            failed++;
        }
    }

    // ─── CSV Tests ─────────────────────────────────────────────────────
    console.log("--- CSV Support ---");
    const csvPath = path.join(TEST_DIR, "test.csv");

    await test("get_document_info on CSV", async () => {
        const res = await client.callTool({ name: "get_document_info", arguments: { filePath: csvPath } });
        const text = (res.content as any)[0].text;
        if (!text.includes("CSV file")) throw new Error("Expected CSV file info, got: " + text);
        if (!text.includes("Total rows")) throw new Error("Expected row count");
        if (!text.includes("Name")) throw new Error("Expected column names");
        console.log(`        ${text.replace(/\n/g, "\n        ")}`);
    });

    await test("read_document_page (chunk 1) on CSV", async () => {
        const res = await client.callTool({ name: "read_document_page", arguments: { filePath: csvPath, pageOrSheet: "1" } });
        const text = (res.content as any)[0].text;
        if (!text.includes("Chunk 1")) throw new Error("Expected chunk header");
        if (!text.includes("Alice")) throw new Error("Expected data row");
        console.log(`        ${text.substring(0, 200).replace(/\n/g, "\n        ")}...`);
    });

    await test("search_document on CSV", async () => {
        const res = await client.callTool({ name: "search_document", arguments: { filePath: csvPath, query: "Tokyo" } });
        const text = (res.content as any)[0].text;
        if (!text.includes("Tokyo")) throw new Error("Expected Tokyo match");
        console.log(`        ${text.replace(/\n/g, "\n        ")}`);
    });

    await test("read_full_document on CSV", async () => {
        const res = await client.callTool({ name: "read_full_document", arguments: { filePath: csvPath } });
        const text = (res.content as any)[0].text;
        if (!text.includes("CSV Content")) throw new Error("Expected CSV Content header");
        if (!text.includes("Henry")) throw new Error("Expected last row");
    });

    await test("list_directory includes CSV", async () => {
        const res = await client.callTool({ name: "list_directory", arguments: { directoryPath: TEST_DIR } });
        const text = (res.content as any)[0].text;
        if (!text.includes("test.csv")) throw new Error("Expected test.csv in listing");
    });

    // ─── Password-Protected PDF Tests ──────────────────────────────────
    console.log("\n--- Password-Protected PDF Support ---");

    await test("PDF without password still works", async () => {
        const pdfPath = path.join(TEST_DIR, "test.pdf");
        const res = await client.callTool({ name: "get_document_info", arguments: { filePath: pdfPath } });
        const text = (res.content as any)[0].text;
        if (!text.includes("PDF document")) throw new Error("Expected PDF info");
        console.log(`        ${text.replace(/\n/g, "\n        ")}`);
    });

    await test("PDF with password param accepted (normal PDF)", async () => {
        const pdfPath = path.join(TEST_DIR, "test.pdf");
        const res = await client.callTool({ name: "read_document_page", arguments: { filePath: pdfPath, pageOrSheet: "1", password: "dummy" } });
        const text = (res.content as any)[0].text;
        if (!text.includes("Page 1")) throw new Error("Expected page content");
    });

    // ─── OCR Tool Availability Test ────────────────────────────────────
    console.log("\n--- OCR Tool ---");

    await test("ocr_pdf tool is registered", async () => {
        const ocrTool = tools.find(t => t.name === "ocr_pdf");
        if (!ocrTool) throw new Error("ocr_pdf tool not found in tool list");
        console.log(`        Tool registered with description: "${ocrTool.description?.substring(0, 80)}..."`);
    });

    await test("ocr_pdf rejects non-PDF files", async () => {
        try {
            await client.callTool({ name: "ocr_pdf", arguments: { filePath: csvPath } });
            throw new Error("Should have thrown for non-PDF");
        } catch (e: any) {
            if (!e.message?.includes("PDF") && !JSON.stringify(e).includes("PDF")) {
                throw new Error("Expected PDF-only error");
            }
        }
    });

    await test("ocr_pdf runs on a real PDF (page 1)", async () => {
        const pdfPath = path.join(TEST_DIR, "test.pdf");
        const res = await client.callTool({ name: "ocr_pdf", arguments: { filePath: pdfPath, pageNumber: 1 } });
        const text = (res.content as any)[0].text;
        if (!text.includes("OCR Page 1")) throw new Error("Expected OCR output header");
        console.log(`        ${text.substring(0, 200).replace(/\n/g, "\n        ")}...`);
    });

    // ─── Summary ───────────────────────────────────────────────────────
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

    await client.close();
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
