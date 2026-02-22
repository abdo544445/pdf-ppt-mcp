#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs";

import { PdfService } from "./services/pdf.service.js";
import { WordService } from "./services/word.service.js";
import { ExcelService } from "./services/excel.service.js";
import { PptService } from "./services/ppt.service.js";

// Define the server
const server = new Server(
    { name: "document-reader", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// Define tools
const GET_DOCUMENT_INFO_TOOL: Tool = {
    name: "get_document_info",
    description: "Get metadata about a document, such as the total number of pages/chunks or available Excel sheets. Always use this first to understand the document's size before reading.",
    inputSchema: {
        type: "object",
        properties: {
            filePath: { type: "string", description: "Absolute path to the document file (.pdf, .docx, .xlsx, .pptx)" }
        },
        required: ["filePath"]
    }
};

const READ_DOCUMENT_PAGE_TOOL: Tool = {
    name: "read_document_page",
    description: "Read a specific page, chunk, or sheet from a document. This prevents loading the entire document into context at once.",
    inputSchema: {
        type: "object",
        properties: {
            filePath: { type: "string", description: "Absolute path to the document file" },
            pageOrSheet: { type: "string", description: "For PDF/Word/PPT: The page or chunk number (e.g., '1'). For Excel: The exact sheet name (e.g., 'Sheet1')" }
        },
        required: ["filePath", "pageOrSheet"]
    }
};

const SEARCH_DOCUMENT_TOOL: Tool = {
    name: "search_document",
    description: "Search for a specific query string within a document. Returns matched pages/chunks and the surrounding context.",
    inputSchema: {
        type: "object",
        properties: {
            filePath: { type: "string", description: "Absolute path to the document file" },
            query: { type: "string", description: "The string to search for" }
        },
        required: ["filePath", "query"]
    }
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [GET_DOCUMENT_INFO_TOOL, READ_DOCUMENT_PAGE_TOOL, SEARCH_DOCUMENT_TOOL]
    };
});

function getFileType(filePath: string): string {
    return path.extname(filePath).toLowerCase();
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args || typeof args.filePath !== 'string') {
        throw new Error("Missing or invalid filePath argument");
    }

    const filePath = args.filePath;
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = getFileType(filePath);

    try {
        if (name === "get_document_info") {
            let info = "";
            if (ext === '.pdf') {
                const pages = await PdfService.getDocumentPages(filePath);
                info = `PDF Document with ${pages.length} pages.`;
            } else if (ext === '.docx') {
                const chunks = await WordService.getDocumentChunks(filePath);
                info = `Word Document divided into ${chunks.length} readable chunks.`;
            } else if (ext === '.xlsx' || ext === '.xls') {
                const sheets = await ExcelService.getSheets(filePath);
                info = `Excel Document with sheets: ${sheets.join(', ')}.`;
            } else if (ext === '.pptx' || ext === '.ppt') {
                const chunks = await PptService.getDocumentChunks(filePath);
                info = `PowerPoint Document divided into ${chunks.length} readable chunks.`;
            } else {
                throw new Error(`Unsupported file type: ${ext}`);
            }
            return { content: [{ type: "text", text: info }] };

        } else if (name === "read_document_page") {
            if (typeof args.pageOrSheet !== 'string' && typeof args.pageOrSheet !== 'number') {
                throw new Error("Missing or invalid pageOrSheet argument");
            }

            const pageOrSheetStr = String(args.pageOrSheet);
            let resultText = "";
            let remaining = "";

            if (ext === '.pdf') {
                const pageNum = parseInt(pageOrSheetStr, 10);
                const res = await PdfService.getPage(filePath, pageNum);
                resultText = res.text;
                remaining = `Page ${pageNum} of ${res.totalPages}`;
            } else if (ext === '.docx') {
                const chunkNum = parseInt(pageOrSheetStr, 10);
                const res = await WordService.getChunk(filePath, chunkNum);
                resultText = res.text;
                remaining = `Chunk ${chunkNum} of ${res.totalChunks}`;
            } else if (ext === '.xlsx' || ext === '.xls') {
                resultText = await ExcelService.getSheetData(filePath, pageOrSheetStr);
                remaining = `Sheet: ${pageOrSheetStr}`;
            } else if (ext === '.pptx' || ext === '.ppt') {
                const chunkNum = parseInt(pageOrSheetStr, 10);
                const res = await PptService.getChunk(filePath, chunkNum);
                resultText = res.text;
                remaining = `Chunk ${chunkNum} of ${res.totalChunks}`;
            } else {
                throw new Error(`Unsupported file type: ${ext}`);
            }

            return { content: [{ type: "text", text: `--- ${remaining} ---\n${resultText}` }] };

        } else if (name === "search_document") {
            if (typeof args.query !== 'string') {
                throw new Error("Missing or invalid query argument");
            }

            const query = args.query.toLowerCase();
            let matches: string[] = [];

            if (ext === '.pdf') {
                const pages = await PdfService.getDocumentPages(filePath);
                pages.forEach((page, i) => {
                    if (page.toLowerCase().includes(query)) {
                        matches.push(`[Page ${i + 1}]:\n...${getSnippet(page, query)}...`);
                    }
                });
            } else if (ext === '.docx') {
                const chunks = await WordService.getDocumentChunks(filePath);
                chunks.forEach((chunk, i) => {
                    if (chunk.toLowerCase().includes(query)) {
                        matches.push(`[Chunk ${i + 1}]:\n...${getSnippet(chunk, query)}...`);
                    }
                });
            } else if (ext === '.xlsx' || ext === '.xls') {
                const sheets = await ExcelService.getSheets(filePath);
                for (const sheet of sheets) {
                    const data = await ExcelService.getSheetData(filePath, sheet);
                    if (data.toLowerCase().includes(query)) {
                        matches.push(`[Sheet ${sheet}]:\n...${getSnippet(data, query)}...`);
                    }
                }
            } else if (ext === '.pptx' || ext === '.ppt') {
                const chunks = await PptService.getDocumentChunks(filePath);
                chunks.forEach((chunk, i) => {
                    if (chunk.toLowerCase().includes(query)) {
                        matches.push(`[Chunk ${i + 1}]:\n...${getSnippet(chunk, query)}...`);
                    }
                });
            } else {
                throw new Error(`Unsupported file type: ${ext}`);
            }

            if (matches.length === 0) {
                return { content: [{ type: "text", text: `No matches found for "${args.query}".` }] };
            }
            return { content: [{ type: "text", text: matches.join('\n\n') }] };

        } else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        throw new Error(`Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
});

function getSnippet(text: string, query: string, padding: number = 100): string {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query.toLowerCase());
    if (index === -1) return "";

    const start = Math.max(0, index - padding);
    const end = Math.min(text.length, index + query.length + padding);
    return text.substring(start, end).replace(/\n/g, ' ');
}

// Start server
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Document Reader MCP Server running on stdio");
}

run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
