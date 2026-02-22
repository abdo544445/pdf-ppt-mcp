# 📄 Document Reader MCP Server

> **An MCP (Model Context Protocol) server that lets AI assistants read PDF, Word, Excel, and PowerPoint files — without blowing up the context window.**

[![npm](https://img.shields.io/npm/v/pdf-ppt-mcp)](https://npmjs.com/package/pdf-ppt-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Why this exists

Most AI tools try to dump an entire document into the prompt at once. This server solves that with **context-efficient reading** by exposing tools that:
- Get document **metadata first** (page count, sheet names)  
- Read **one page / slide / sheet at a time**
- **Search** across the entire document and return only relevant snippets

This keeps your context window clean while still giving the AI access to large documents.

---

## 📦 Supported File Types

| Format | Extension(s) | How it's read |
|--------|-------------|---------------|
| PDF | `.pdf` | Page-by-page (native PDF pagination) |
| Word | `.docx` | Paragraph-aware chunking |
| Excel | `.xlsx`, `.xls` | Sheet-by-sheet (full CSV per sheet) |
| PowerPoint | `.pptx`, `.ppt` | Slide-by-slide (true slide extraction) |

---

## 🚀 Quick Start

### Run instantly with npx (recommended)
```bash
npx -y pdf-ppt-mcp
```

### Or install globally
```bash
npm install -g pdf-ppt-mcp
mcp-document-server
```

### Or clone and run locally
```bash
git clone https://github.com/abdo544445/pdf-ppt-mcp.git
cd pdf-ppt-mcp
npm install
npm run build
npm start
```

---

## 🔌 Integration Guide

### VS Code (Cline / RooCode / Copilot MCP)

Add to your MCP config file (usually `~/.cline/mcp_settings.json` or `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "document-reader": {
      "command": "npx",
      "args": ["-y", "pdf-ppt-mcp"]
    }
  }
}
```

### Cursor

Open **Settings → MCP** and add:

```json
{
  "mcpServers": {
    "document-reader": {
      "command": "npx",
      "args": ["-y", "pdf-ppt-mcp"]
    }
  }
}
```

### Antigravity / Claude Desktop

In your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "document-reader": {
      "command": "npx",
      "args": ["-y", "pdf-ppt-mcp"]
    }
  }
}
```

### Local path (if you cloned the repo)

```json
{
  "mcpServers": {
    "document-reader": {
      "command": "node",
      "args": ["/absolute/path/to/pdf-ppt-mcp/build/index.js"]
    }
  }
}
```

---

## 🛠️ Available MCP Tools

### 1. `get_document_info`
> **Always call this first.** Returns metadata so the AI knows the document's size before trying to read it.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Absolute path to the document |

**Example output:**
```
📄 report.pdf — PDF document
• Total pages: 42

📊 data.xlsx — Excel workbook  
• Sheets (3): "Summary", "Q1 Data", "Q2 Data"

📊 slides.pptx — PowerPoint presentation
• Total slides: 12
```

---

### 2. `read_document_page`
> Read **one specific page, chunk, or sheet** at a time to avoid loading the whole document.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Absolute path to the document |
| `pageOrSheet` | `string` | **PDF/Word/PPT**: page/chunk/slide number (e.g. `"3"`). **Excel**: sheet name (e.g. `"Sheet1"`) |

**Example calls:**
```json
// Read page 5 of a PDF
{ "filePath": "/docs/report.pdf", "pageOrSheet": "5" }

// Read slide 2 of a PPTX
{ "filePath": "/docs/deck.pptx", "pageOrSheet": "2" }

// Read the "Sales" sheet of an Excel file
{ "filePath": "/docs/data.xlsx", "pageOrSheet": "Sales" }

// Read chunk 3 of a Word document
{ "filePath": "/docs/contract.docx", "pageOrSheet": "3" }
```

---

### 3. `search_document`
> Search the **entire document** for a keyword. Returns matching pages/slides/chunks with surrounding context snippets — no need to read every page manually.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Absolute path to the document |
| `query` | `string` | Search term (case-insensitive) |

**Example output:**
```
Found 2 match(es) for "revenue":

[Page 7]:
...total revenue for Q3 was $4.2M, representing a 12% increase over...

[Page 23]:
...projected revenue targets were exceeded in all regions except...
```

---

### 4. `list_directory`
> List all supported document files in a folder. Useful for discovering what documents are available.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `directoryPath` | `string` | Absolute path to the directory |

**Example output:**
```
Found 4 document(s):

annual_report.pdf  (2,341.2 KB)
budget_2025.xlsx   (128.5 KB)
proposal.docx      (54.8 KB)
presentation.pptx  (8,902.1 KB)
```

---

### 5. `read_full_document`
> Read the **entire document** at once. Best for small documents only.

> ⚠️ **Warning:** Use `read_document_page` or `search_document` for large documents to avoid filling the context window.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Absolute path to the document |
| `maxChunks` | `number` | Max pages/chunks to read (default: `10`, max: `50`) |

---

## 🤖 Recommended Usage Pattern for AI Assistants

When an AI assistant uses this server, the recommended flow is:

```
1. list_directory("/path/to/folder")          → discover available documents
2. get_document_info("/path/to/doc.pdf")      → learn total pages
3. search_document("/path/to/doc.pdf", "key term")  → find relevant pages
4. read_document_page("/path/to/doc.pdf", "7")      → read specific page
```

This approach typically uses **< 5% of context** compared to loading the whole document.

---

## 🏗️ Architecture

```
pdf-ppt-mcp/
├── src/
│   ├── index.ts                  # MCP Server — tool definitions & routing
│   └── services/
│       ├── pdf.service.ts        # PDF parsing (pdf-parse v2)
│       ├── word.service.ts       # Word parsing (mammoth)
│       ├── excel.service.ts      # Excel parsing (xlsx)
│       └── ppt.service.ts        # PPT parsing (officeparser)
├── build/                        # Compiled output (auto-generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Libraries Used

| Library | Purpose |
|---------|---------|
| [`@modelcontextprotocol/sdk`](https://npmjs.com/package/@modelcontextprotocol/sdk) | MCP server/client protocol |
| [`pdf-parse`](https://npmjs.com/package/pdf-parse) | PDF text extraction (v2, page-by-page) |
| [`mammoth`](https://npmjs.com/package/mammoth) | Word `.docx` text extraction |
| [`xlsx`](https://npmjs.com/package/xlsx) | Excel `.xlsx`/`.xls` reading |
| [`officeparser`](https://npmjs.com/package/officeparser) | PowerPoint `.pptx`/`.ppt` slide extraction |

---

## 💻 Development

```bash
# Clone the repo
git clone https://github.com/abdo544445/pdf-ppt-mcp.git
cd pdf-ppt-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server (stdio mode for MCP clients)
npm start
```

---

## 📋 Requirements

- **Node.js** >= 20.16.0
- An MCP-compatible client (VS Code with Cline/RooCode, Cursor, Antigravity, Claude Desktop, etc.)

---

## 🗺️ Roadmap

- [ ] Publish to npm registry for true `npx pdf-ppt-mcp` one-line install
- [ ] VS Code Extension wrapper for GUI-based document selection
- [ ] Support for `.csv` files (direct reading)
- [ ] Support for password-protected PDFs
- [ ] OCR for scanned/image-based PDFs

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📝 License

MIT © [abdo544445](https://github.com/abdo544445)
