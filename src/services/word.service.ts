import mammoth from 'mammoth';

export class WordService {
    /**
     * Splits a Word document into chunks by paragraph breaks first,
     * then by character size, so chunks are semantically coherent.
     */
    static async getDocumentChunks(filePath: string, chunkSize: number = 2000): Promise<string[]> {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            const text = result.value;

            if (!text || text.trim() === '') return ['(No text content found)'];

            // Split by double newlines (paragraphs) first to keep context
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');

            const chunks: string[] = [];
            let current = '';
            for (const para of paragraphs) {
                if ((current + '\n\n' + para).length > chunkSize && current !== '') {
                    chunks.push(current.trim());
                    current = para;
                } else {
                    current = current ? current + '\n\n' + para : para;
                }
            }
            if (current.trim()) chunks.push(current.trim());

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
            text: chunks[chunkNumber - 1],
            totalChunks: chunks.length
        };
    }
}
