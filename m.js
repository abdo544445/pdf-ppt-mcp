const m = `flowchart LR
    Client(("🤖 AI Assistant\\n(Claude / Cursor)")) <-->|MCP Protocol| Server["📄 Document Reader Server"]
    
    subgraph ServerScope ["Server"]
        direction TB
        Server <--> Tools{{"MCP Tools"}}
        
        Tools -->|read_document_page| Services
        Tools -->|search_document| Services
        Tools -->|get_document_info| Services
        Tools -->|read_full_document| Services
        Tools -->|list_directory| FS[("📁 File System")]
        
        subgraph Services ["Parsing Services"]
            direction LR
            PDF[/"PDFService\\n(pdf-parse)"/]
            Word[/"WordService\\n(mammoth)"/]
            Excel[/"ExcelService\\n(xlsx)"/]
            PPT[/"PptService\\n(officeparser)"/]
        end
    end

    Services --> FS`;
console.log('B64:', Buffer.from(m).toString('base64url'));
