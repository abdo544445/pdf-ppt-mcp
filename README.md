# Document Reader MCP Server

An MCP (Model Context Protocol) server that allows Reading and Searching through PDF, Word, Excel, and PowerPoint documents while minimizing context window usage.

## Features
- **PDF Parsing**: Read specific pages or search for text without loading the whole PDF.
- **Office Documents**: Process Word (`.docx`), Excel (`.xlsx`), and PowerPoint (`.pptx`) files.
- **Context Management**: Pagination and chunking built-in to prevent blowing up the LLM context limit.

## Installation and execution
You can easily install and run this server via `npx`.

```bash
npx -y pdf-ppt-mcp
```

## Available MCP Tools

* `get_document_info`: Get metadata about a document, such as the total number of pages/chunks or available Excel sheets. Always use this first to understand the document's size before reading.
* `read_document_page`: Read a specific page, chunk, or sheet from a document.
* `search_document`: Search for a specific query string within a document. Returns matched pages/chunks and the surrounding context.

## Usage with MCP Clients

### VS Code (via Cline/RooCode) or Cursor
Add the following to your MCP settings (`mcp.json` or equivalent configuration):

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

Or run via absolute path locally:
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

## Development

```bash
npm install
npm run build
npm start
```
