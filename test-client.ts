import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

const ROOT = __dirname;
const serverPath = path.join(ROOT, "build/index.js");

async function test(client: Client, toolName: string, args: Record<string, unknown>) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔧 Tool: ${toolName}`);
    console.log(`📦 Args: ${JSON.stringify(args, null, 2)}`);
    console.log('─'.repeat(60));
    try {
        const res = await client.callTool({ name: toolName, arguments: args });
        const content = (res.content as any[])[0]?.text ?? "(no output)";
        console.log(content);
    } catch (err: any) {
        console.error(`❌ ERROR: ${err.message}`);
    }
}

async function main() {
    console.log("🚀 Starting MCP Document Reader Test Suite...\n");

    const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("✅ Connected to MCP server\n");

    // ── PDF Tests ────────────────────────────────────────────────────────────
    console.log("\n📄 ===== PDF TESTS =====");
    const pdf = path.join(ROOT, "test.pdf");

    await test(client, "get_document_info", { filePath: pdf });
    await test(client, "read_document_page", { filePath: pdf, pageOrSheet: "1" });
    await test(client, "read_document_page", { filePath: pdf, pageOrSheet: "2" });
    await test(client, "search_document", { filePath: pdf, query: "testing" });

    // ── Word Tests ───────────────────────────────────────────────────────────
    console.log("\n📝 ===== WORD TESTS =====");
    const docx = path.join(ROOT, "test.docx");

    await test(client, "get_document_info", { filePath: docx });
    await test(client, "read_document_page", { filePath: docx, pageOrSheet: "1" });
    await test(client, "search_document", { filePath: docx, query: "testing" });

    // ── Excel Tests ──────────────────────────────────────────────────────────
    console.log("\n📊 ===== EXCEL TESTS =====");
    const xlsx = path.join(ROOT, "test.xlsx");

    await test(client, "get_document_info", { filePath: xlsx });
    await test(client, "read_document_page", { filePath: xlsx, pageOrSheet: "Employees" });
    await test(client, "read_document_page", { filePath: xlsx, pageOrSheet: "Products" });
    await test(client, "search_document", { filePath: xlsx, query: "Alice" });

    // ── PPT Tests ────────────────────────────────────────────────────────────
    console.log("\n🖥️  ===== POWERPOINT TESTS =====");
    const pptx = path.join(ROOT, "test.pptx");

    await test(client, "get_document_info", { filePath: pptx });
    await test(client, "read_document_page", { filePath: pptx, pageOrSheet: "1" });
    await test(client, "search_document", { filePath: pptx, query: "MCP" });

    // ── list_directory ───────────────────────────────────────────────────────
    console.log("\n📁 ===== LIST DIRECTORY TEST =====");
    await test(client, "list_directory", { directoryPath: ROOT });

    // ── read_full_document (small PDF) ───────────────────────────────────────
    console.log("\n📖 ===== READ FULL DOCUMENT (PDF) =====");
    await test(client, "read_full_document", { filePath: pdf, maxChunks: 5 });

    console.log(`\n${'='.repeat(60)}`);
    console.log("✅ All tests complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
