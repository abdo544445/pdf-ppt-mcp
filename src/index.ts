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
import { CsvService } from "./services/csv.service.js";
import { OcrService } from "./services/ocr.service.js";

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
    { name: "document-reader", version: "1.1.0" },
    { capabilities: { tools: {} } }
);

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
    {
        name: "get_document_info",
        description:
            "Get metadata about a document: total pages (PDF), chunks (Word/PPT), or sheet names (Excel). " +
            "ALWAYS call this first before reading to understand the document size.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Absolute path to the file (.pdf, .docx, .xlsx, .xls, .pptx, .ppt, .csv)",
                },
                password: {
                    type: "string",
                    description: "Optional password for encrypted/protected PDF files",
                },
            },
            required: ["filePath"],
        },
    },
    {
        name: "read_document_page",
        description:
            "Read a specific page, chunk, or sheet from a document. " +
            "For PDF: provide the page number (e.g. '1'). " +
            "For Word/PPT/CSV: provide the chunk number (e.g. '1'). " +
            "For Excel: provide the exact sheet name (e.g. 'Sheet1'). " +
            "Use get_document_info first to know valid ranges.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Absolute path to the file",
                },
                pageOrSheet: {
                    type: "string",
                    description:
                        "Page/chunk number (1-indexed) for PDF/Word/PPT/CSV, OR the sheet name for Excel",
                },
                password: {
                    type: "string",
                    description: "Optional password for encrypted/protected PDF files",
                },
            },
            required: ["filePath", "pageOrSheet"],
        },
    },
    {
        name: "search_document",
        description:
            "Search for a query string across an entire document. " +
            "Returns the matched pages/chunks with surrounding context snippets. " +
            "Much more efficient than reading the whole document page by page.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Absolute path to the file",
                },
                query: {
                    type: "string",
                    description: "The text to search for (case-insensitive)",
                },
                password: {
                    type: "string",
                    description: "Optional password for encrypted/protected PDF files",
                },
            },
            required: ["filePath", "query"],
        },
    },
    {
        name: "list_directory",
        description:
            "List all supported document files (.pdf, .docx, .xlsx, .xls, .pptx, .ppt, .csv) in a directory. " +
            "Useful for discovering which files are available to read.",
        inputSchema: {
            type: "object",
            properties: {
                directoryPath: {
                    type: "string",
                    description: "Absolute path to the directory",
                },
            },
            required: ["directoryPath"],
        },
    },
    {
        name: "read_full_document",
        description:
            "Read the ENTIRE content of a document at once. " +
            "WARNING: Only use this for small documents (< 5 pages/chunks). " +
            "For large documents, prefer read_document_page or search_document to preserve context.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Absolute path to the file",
                },
                maxChunks: {
                    type: "number",
                    description: "Maximum number of pages/chunks to read (default: 10, max: 50)",
                },
                password: {
                    type: "string",
                    description: "Optional password for encrypted/protected PDF files",
                },
            },
            required: ["filePath"],
        },
    },
    {
        name: "ocr_pdf",
        description:
            "OCR (Optical Character Recognition) for scanned or image-based PDF files. " +
            "Use this ONLY when read_document_page returns empty or garbled text, " +
            "which indicates the PDF contains scanned images instead of selectable text. " +
            "WARNING: OCR is slow (3-10 seconds per page). Prefer read_document_page first.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Absolute path to the PDF file",
                },
                pageNumber: {
                    type: "number",
                    description: "Page number to OCR (1-indexed). If omitted, OCR all pages (max 20).",
                },
            },
            required: ["filePath"],
        },
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt", ".csv"]);

function getExt(filePath: string): string {
    return path.extname(filePath).toLowerCase();
}

function assertFileExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
}

function assertSupported(filePath: string) {
    const ext = getExt(filePath);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        throw new Error(
            `Unsupported file type: "${ext}". Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`
        );
    }
}

function getSnippet(text: string, query: string, padding = 120): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return "";
    const start = Math.max(0, idx - padding);
    const end = Math.min(text.length, idx + query.length + padding);
    return text.substring(start, end).replace(/\s+/g, " ").trim();
}

// ─── Request Handlers ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // ── list_directory ────────────────────────────────────────────────────────
    if (name === "list_directory") {
        const dirPath = String(args?.directoryPath ?? "");
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        const files = fs.readdirSync(dirPath)
            .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
            .map((f) => {
                const stat = fs.statSync(path.join(dirPath, f));
                const kb = (stat.size / 1024).toFixed(1);
                return `${f}  (${kb} KB)`;
            });
        if (files.length === 0) {
            return { content: [{ type: "text", text: "No supported document files found in this directory." }] };
        }
        return { content: [{ type: "text", text: `Found ${files.length} document(s):\n\n` + files.join("\n") }] };
    }

    // For all other tools, filePath is required
    const filePath = String(args?.filePath ?? "");
    if (!filePath) throw new Error("Missing required argument: filePath");
    assertFileExists(filePath);
    assertSupported(filePath);
    const ext = getExt(filePath);
    const password = args?.password ? String(args.password) : undefined;

    try {
        // ── get_document_info ────────────────────────────────────────────────
        if (name === "get_document_info") {
            let info = "";
            const fileName = path.basename(filePath);

            if (ext === ".pdf") {
                const { totalPages } = await PdfService.getPage(filePath, 1, password);
                info = `📄 **${fileName}** — PDF document\n• Total pages: ${totalPages}`;
            } else if (ext === ".docx") {
                const chunks = await WordService.getDocumentChunks(filePath);
                info = `📝 **${fileName}** — Word document\n• Total chunks: ${chunks.length} (≈2000 chars each)`;
            } else if (ext === ".xlsx" || ext === ".xls") {
                const sheets = ExcelService.getSheets(filePath);
                info = `📊 **${fileName}** — Excel workbook\n• Sheets (${sheets.length}): ${sheets.map(s => `"${s}"`).join(", ")}`;
            } else if (ext === ".pptx" || ext === ".ppt") {
                const slides = await PptService.getSlides(filePath);
                info = `📊 **${fileName}** — PowerPoint presentation\n• Total slides: ${slides.length}`;
            } else if (ext === ".csv") {
                const csvInfo = CsvService.getInfo(filePath);
                info = `📊 **${fileName}** — CSV file\n• Total rows: ${csvInfo.totalRows}\n• Columns: ${csvInfo.columns.join(", ")}`;
            }

            return { content: [{ type: "text", text: info }] };
        }

        // ── read_document_page ───────────────────────────────────────────────
        if (name === "read_document_page") {
            const pageOrSheet = String(args?.pageOrSheet ?? "");
            if (!pageOrSheet) throw new Error("Missing required argument: pageOrSheet");

            let result = "";

            if (ext === ".pdf") {
                const pageNum = parseInt(pageOrSheet, 10);
                if (isNaN(pageNum)) throw new Error("For PDF files, pageOrSheet must be a number.");
                const res = await PdfService.getPage(filePath, pageNum, password);
                result = `--- Page ${pageNum} of ${res.totalPages} ---\n\n${res.text}`;
            } else if (ext === ".docx") {
                const chunkNum = parseInt(pageOrSheet, 10);
                if (isNaN(chunkNum)) throw new Error("For Word files, pageOrSheet must be a number.");
                const res = await WordService.getChunk(filePath, chunkNum);
                result = `--- Chunk ${chunkNum} of ${res.totalChunks} ---\n\n${res.text}`;
            } else if (ext === ".xlsx" || ext === ".xls") {
                const csv = ExcelService.getSheetData(filePath, pageOrSheet);
                result = `--- Sheet: "${pageOrSheet}" ---\n\n${csv}`;
            } else if (ext === ".pptx" || ext === ".ppt") {
                const chunkNum = parseInt(pageOrSheet, 10);
                if (isNaN(chunkNum)) throw new Error("For PPT files, pageOrSheet must be a number.");
                const res = await PptService.getChunk(filePath, chunkNum);
                result = `--- Chunk ${chunkNum} of ${res.totalChunks} ---\n\n${res.text}`;
            } else if (ext === ".csv") {
                const chunkNum = parseInt(pageOrSheet, 10);
                if (isNaN(chunkNum)) throw new Error("For CSV files, pageOrSheet must be a chunk number.");
                const res = CsvService.getChunk(filePath, chunkNum);
                result = `--- Chunk ${chunkNum} of ${res.totalChunks} (${res.totalRows} total rows) ---\n\n${res.text}`;
            }

            return { content: [{ type: "text", text: result }] };
        }

        // ── search_document ──────────────────────────────────────────────────
        if (name === "search_document") {
            const query = String(args?.query ?? "");
            if (!query) throw new Error("Missing required argument: query");

            const matches: string[] = [];

            if (ext === ".pdf") {
                const { totalPages } = await PdfService.getPage(filePath, 1, password);
                for (let i = 1; i <= totalPages; i++) {
                    const { text } = await PdfService.getPage(filePath, i, password);
                    if (text.toLowerCase().includes(query.toLowerCase())) {
                        matches.push(`[Page ${i}]:\n...${getSnippet(text, query)}...`);
                    }
                }
            } else if (ext === ".docx") {
                const chunks = await WordService.getDocumentChunks(filePath);
                chunks.forEach((chunk, i) => {
                    if (chunk.toLowerCase().includes(query.toLowerCase())) {
                        matches.push(`[Chunk ${i + 1}]:\n...${getSnippet(chunk, query)}...`);
                    }
                });
            } else if (ext === ".xlsx" || ext === ".xls") {
                const sheets = ExcelService.getSheets(filePath);
                for (const sheet of sheets) {
                    const csv = ExcelService.getSheetData(filePath, sheet);
                    if (csv.toLowerCase().includes(query.toLowerCase())) {
                        matches.push(`[Sheet "${sheet}"]:\n...${getSnippet(csv, query)}...`);
                    }
                }
            } else if (ext === ".pptx" || ext === ".ppt") {
                const chunks = await PptService.getDocumentChunks(filePath);
                chunks.forEach((chunk, i) => {
                    if (chunk.toLowerCase().includes(query.toLowerCase())) {
                        matches.push(`[Chunk ${i + 1}]:\n...${getSnippet(chunk, query)}...`);
                    }
                });
            } else if (ext === ".csv") {
                const csvMatches = CsvService.search(filePath, query);
                csvMatches.forEach(m => matches.push(m));
            }

            if (matches.length === 0) {
                return { content: [{ type: "text", text: `No matches found for "${query}".` }] };
            }
            return {
                content: [{
                    type: "text",
                    text: `Found ${matches.length} match(es) for "${query}":\n\n` + matches.join("\n\n---\n\n"),
                }],
            };
        }

        // ── read_full_document ───────────────────────────────────────────────
        if (name === "read_full_document") {
            const maxChunks = Math.min(Number(args?.maxChunks ?? 10), 50);
            const parts: string[] = [];

            if (ext === ".pdf") {
                const { totalPages } = await PdfService.getPage(filePath, 1, password);
                const limit = Math.min(totalPages, maxChunks);
                for (let i = 1; i <= limit; i++) {
                    const { text } = await PdfService.getPage(filePath, i, password);
                    parts.push(`--- Page ${i} ---\n${text}`);
                }
                if (totalPages > limit) parts.push(`\n⚠️ Truncated: showing ${limit} of ${totalPages} pages.`);
            } else if (ext === ".docx") {
                const chunks = await WordService.getDocumentChunks(filePath);
                const limit = Math.min(chunks.length, maxChunks);
                chunks.slice(0, limit).forEach((c, i) => parts.push(`--- Chunk ${i + 1} ---\n${c}`));
                if (chunks.length > limit) parts.push(`\n⚠️ Truncated: showing ${limit} of ${chunks.length} chunks.`);
            } else if (ext === ".xlsx" || ext === ".xls") {
                const sheets = ExcelService.getSheets(filePath);
                for (const sheet of sheets) {
                    const csv = ExcelService.getSheetData(filePath, sheet);
                    parts.push(`--- Sheet: "${sheet}" ---\n${csv}`);
                }
            } else if (ext === ".pptx" || ext === ".ppt") {
                const chunks = await PptService.getDocumentChunks(filePath);
                const limit = Math.min(chunks.length, maxChunks);
                chunks.slice(0, limit).forEach((c, i) => parts.push(`--- Chunk ${i + 1} ---\n${c}`));
                if (chunks.length > limit) parts.push(`\n⚠️ Truncated: showing ${limit} of ${chunks.length} chunks.`);
            } else if (ext === ".csv") {
                const content = CsvService.getFullContent(filePath);
                parts.push(`--- CSV Content ---\n${content}`);
            }

            return { content: [{ type: "text", text: parts.join("\n\n") }] };
        }

        // ── ocr_pdf ──────────────────────────────────────────────────────────
        if (name === "ocr_pdf") {
            if (getExt(filePath) !== ".pdf") throw new Error("ocr_pdf only works with PDF files.");
            const pageNumber = args?.pageNumber ? Number(args.pageNumber) : undefined;

            if (pageNumber) {
                const { text, totalPages } = await OcrService.ocrPage(filePath, pageNumber);
                return {
                    content: [{
                        type: "text",
                        text: `--- OCR Page ${pageNumber} of ${totalPages} ---\n\n${text || "(No text detected on this page)"}`,
                    }],
                };
            } else {
                const pages = await OcrService.ocrAllPages(filePath);
                const parts = pages.map((text, i) =>
                    `--- OCR Page ${i + 1} ---\n${text || "(No text detected)"}`
                );
                return {
                    content: [{
                        type: "text",
                        text: parts.join("\n\n"),
                    }],
                };
            }
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
        throw new Error(
            `Error in tool "${name}": ${error instanceof Error ? error.message : String(error)}`
        );
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Document Reader MCP Server v1.1.0 running on stdio");
}

run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
