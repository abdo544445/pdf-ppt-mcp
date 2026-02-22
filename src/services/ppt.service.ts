const officeParser = require('officeparser');

interface OfficeTextNode {
    type: string;
    text?: string;
    children?: OfficeTextNode[];
    metadata?: Record<string, any>;
}

interface OfficeResult {
    type: string;
    metadata: Record<string, any>;
    content: OfficeTextNode[];
}

/** Recursively extract all text from a node tree. */
function extractText(node: OfficeTextNode): string {
    if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
    }
    if (node.children && node.children.length > 0) {
        return node.children.map(extractText).filter(Boolean).join(' ');
    }
    return '';
}

export class PptService {
    /** Parse the PPTX and return the raw officeparser object. */
    private static parseFile(filePath: string): Promise<OfficeResult> {
        return new Promise((resolve, reject) => {
            officeParser.parseOffice(filePath, (result: OfficeResult | string, err: Error) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result as OfficeResult);
                }
            });
        });
    }

    /**
     * Returns an array of slide texts.
     * Each element = one slide's text content.
     */
    static async getSlides(filePath: string): Promise<string[]> {
        try {
            const result = await this.parseFile(filePath);

            // If officeparser returned a string (older API), fall back to chunking
            if (typeof result === 'string') {
                const text = result as unknown as string;
                if (!text || text.trim() === '') return ['(No text content found)'];
                const chunks: string[] = [];
                for (let i = 0; i < text.length; i += 2000) {
                    const chunk = text.slice(i, i + 2000).trim();
                    if (chunk) chunks.push(chunk);
                }
                return chunks;
            }

            // Extract per-slide content from the structured object
            const slides = result.content?.filter(node => node.type === 'slide') ?? [];

            if (slides.length === 0) {
                // Fallback: extract all text from all nodes
                const allText = result.content?.map(extractText).join('\n\n') ?? '';
                return allText.trim() ? [allText.trim()] : ['(No text content found)'];
            }

            return slides.map((slide, i) => {
                const slideNum = slide.metadata?.slideNumber ?? (i + 1);
                const text = slide.children?.map(extractText).filter(Boolean).join('\n') ?? '';
                return text.trim() || `(Slide ${slideNum} has no text)`;
            });
        } catch (error) {
            console.error('Error parsing PPT/PPTX document:', error);
            throw new Error(`Failed to read PPT: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /** Alias for backward compatibility — returns slides as chunks */
    static async getDocumentChunks(filePath: string): Promise<string[]> {
        return this.getSlides(filePath);
    }

    static async getChunk(filePath: string, slideNumber: number): Promise<{ text: string, totalChunks: number }> {
        const slides = await this.getSlides(filePath);
        if (slideNumber < 1 || slideNumber > slides.length) {
            throw new Error(`Slide number ${slideNumber} out of range (1 - ${slides.length})`);
        }
        return {
            text: slides[slideNumber - 1],
            totalChunks: slides.length
        };
    }
}
