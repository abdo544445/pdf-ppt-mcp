const officeParser = require('officeparser');
export class PptService {
    static async getDocumentChunks(filePath: string, chunkSize: number = 2000): Promise<string[]> {
        try {
            const text = await officeParser.parseOfficeAsync(filePath);

            // PPT doesn't easily expose slide numbers through officeparser, so we chunk it synthetically
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += chunkSize) {
                chunks.push(text.slice(i, i + chunkSize));
            }
            return chunks.length > 0 ? chunks : [''];
        } catch (error) {
            console.error('Error parsing PPT document:', error);
            throw new Error(`Failed to read PPT document: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async getChunk(filePath: string, chunkNumber: number): Promise<{ text: string, totalChunks: number }> {
        const chunks = await this.getDocumentChunks(filePath);
        if (chunkNumber < 1 || chunkNumber > chunks.length) {
            throw new Error(`Chunk number ${chunkNumber} out of range (1 - ${chunks.length})`);
        }
        return {
            text: chunks[chunkNumber - 1].trim(),
            totalChunks: chunks.length
        };
    }
}
