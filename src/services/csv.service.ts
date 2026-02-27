import fs from 'fs';

export class CsvService {
    /**
     * Get metadata about the CSV file: total rows, column headers.
     */
    static getInfo(filePath: string): { totalRows: number; columns: string[] } {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length === 0) {
            return { totalRows: 0, columns: [] };
        }
        const columns = CsvService.parseCsvLine(lines[0]);
        return {
            totalRows: lines.length - 1, // exclude header
            columns,
        };
    }

    /**
     * Read a range of rows from the CSV (1-indexed, excluding header).
     * Returns header + requested rows as formatted text.
     */
    static getRows(filePath: string, startRow: number, endRow: number): { text: string; totalRows: number } {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length === 0) {
            return { text: '(empty CSV file)', totalRows: 0 };
        }

        const totalRows = lines.length - 1; // exclude header
        const start = Math.max(1, startRow);
        const end = Math.min(totalRows, endRow);

        if (start > totalRows) {
            throw new Error(`Row ${start} out of range (1 - ${totalRows})`);
        }

        const header = lines[0];
        const selectedLines = lines.slice(start, end + 1);
        const text = [header, ...selectedLines].join('\n');

        return { text, totalRows };
    }

    /**
     * Get the full CSV content as text.
     */
    static getFullContent(filePath: string): string {
        return fs.readFileSync(filePath, 'utf-8').trim();
    }

    /**
     * Search the CSV for a query string (case-insensitive).
     * Returns matching rows with their row numbers.
     */
    static search(filePath: string, query: string): string[] {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length === 0) return [];

        const lowerQuery = query.toLowerCase();
        const matches: string[] = [];

        // Search data rows (skip header)
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lowerQuery)) {
                matches.push(`[Row ${i}]: ${lines[i]}`);
            }
        }
        return matches;
    }

    /**
     * Read rows as chunks for paginated access.
     * Each chunk = 50 rows by default.
     */
    static getChunk(filePath: string, chunkNumber: number, chunkSize = 50): { text: string; totalChunks: number; totalRows: number } {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length === 0) {
            return { text: '(empty CSV file)', totalChunks: 0, totalRows: 0 };
        }

        const totalRows = lines.length - 1;
        const totalChunks = Math.ceil(totalRows / chunkSize);

        if (chunkNumber < 1 || chunkNumber > totalChunks) {
            throw new Error(`Chunk ${chunkNumber} out of range (1 - ${totalChunks})`);
        }

        const startRow = (chunkNumber - 1) * chunkSize + 1;
        const endRow = Math.min(chunkNumber * chunkSize, totalRows);
        const header = lines[0];
        const selectedLines = lines.slice(startRow, endRow + 1);

        return {
            text: [header, ...selectedLines].join('\n'),
            totalChunks,
            totalRows,
        };
    }

    /**
     * Simple CSV line parser that handles quoted fields.
     */
    private static parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }
}
