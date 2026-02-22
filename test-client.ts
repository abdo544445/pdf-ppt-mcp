import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

async function testServer() {
    console.log("Starting MCP Test Client...");
    const serverPath = path.resolve(__dirname, "./build/index.js");
    const testPdfPath = path.resolve(__dirname, "./test.pdf");

    const transport = new StdioClientTransport({
        command: "node",
        args: [serverPath],
    });

    const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} }
    );

    await client.connect(transport);
    console.log("Connected to MCP Server!");

    console.log("\n--- Testing: get_document_info ---");
    const infoRes = await client.callTool({
        name: "get_document_info",
        arguments: { filePath: testPdfPath }
    });
    console.dir(infoRes, { depth: null });

    console.log("\n--- Testing: read_document_page (Page 1) ---");
    const page1Res = await client.callTool({
        name: "read_document_page",
        arguments: { filePath: testPdfPath, pageOrSheet: "1" }
    });
    console.dir(page1Res, { depth: null });

    console.log("\n--- Testing: search_document (Search for 'testing') ---");
    const searchRes = await client.callTool({
        name: "search_document",
        arguments: { filePath: testPdfPath, query: "testing" }
    });
    console.dir(searchRes, { depth: null });

    console.log("\n--- Tests completed! Closing client ---");
    process.exit(0);
}

testServer().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
