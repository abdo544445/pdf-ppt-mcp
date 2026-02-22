import mammoth from 'mammoth';

export class WordService {
    static async getDocumentChunks(filePath: string, chunkSize: number = 2000): Promise<string[]> {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            const text = result.value;

            // Word doesn't have native pages, so we chunk it synthetically
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += chunkSize) {
                chunks.push(text.slice(i, i + chunkSize));
            }
            return chunks.length > 0 ? chunks : [''];
        } catch (error) {
            console.error('Error parsing Word document:', error);
            throw new Error(`Failed to read Word document: ${error instanceof Error ? error.message : String(error)}`);
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
