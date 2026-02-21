import { describe, it, expect } from 'vitest';
import { ResponseChunker, chunkResponseText, createResponseChunker } from '../response-chunker';

describe('Response Chunker', () => {

    // Helper to simulate a streaming AI response token by token
    async function* simulateStream(text: string, chunkSize = 3): AsyncGenerator<string> {
        for (let i = 0; i < text.length; i += chunkSize) {
            yield text.slice(i, i + chunkSize);
        }
    }

    it('1. Single sentence input → single chunk with isFinal: true', () => {
        const chunks = chunkResponseText('This is a single sentence.', { shortCircuitThreshold: 0, minWords: 1 });
        expect(chunks.length).toBe(1);
        expect(chunks[0].text).toBe('This is a single sentence.');
        expect(chunks[0].isFinal).toBe(true);
    });

    it('2. Multiple sentences → correct sentence-by-sentence chunking', () => {
        const text = 'First sentence. Second sentence! Is this the third? Yes it is.';
        const chunks = chunkResponseText(text, { shortCircuitThreshold: 0, minWords: 1 });

        expect(chunks.length).toBe(4);
        expect(chunks[0].text).toBe('First sentence.');
        expect(chunks[1].text).toBe('Second sentence!');
        expect(chunks[2].text).toBe('Is this the third?');
        expect(chunks[3].text).toBe('Yes it is.');
        expect(chunks[3].isFinal).toBe(true);
    });

    it('3. Code blocks (```...```) must not be split mid-block', () => {
        const text = "Here is code.\n```python\ndef foo():\n    print('Hello. World.')\n    return True.\n```\nDone.";
        const chunks = chunkResponseText(text, { shortCircuitThreshold: 0, minWords: 1 });

        // chunk 0: Here is code.
        // chunk 1: ```python\ndef foo():\n    print('Hello. World.')\n    return True.\n```
        // chunk 2: Done.
        const codeChunk = chunks.find(c => c.text.includes('```python'));
        expect(codeChunk).toBeDefined();
        // It should retain the inner periods without splitting
        expect(codeChunk!.text).toContain("print('Hello. World.')");
        expect(codeChunk!.text).toContain("return True.");
        expect(codeChunk!.text.endsWith('```')).toBe(true);
    });

    it('4. Bullet lists must not break mid-item', () => {
        const text = "Here is a list:\n* First item is long. It has two sentences.\n* Second item.\nDone.";
        const chunks = chunkResponseText(text, { shortCircuitThreshold: 0, minWords: 1 });

        const firstItemChunk = chunks.find(c => c.text.includes('* First item'));
        expect(firstItemChunk).toBeDefined();
        expect(firstItemChunk!.text).toContain('First item is long. It has two sentences.');
    });

    it('5. Empty input → yields no chunks', () => {
        const chunks = chunkResponseText('', { shortCircuitThreshold: 0, minWords: 1 });
        expect(chunks.length).toBe(0);
    });

    it('6. Input with only whitespace → yields no chunks', () => {
        const chunks = chunkResponseText('   \n\t  ', { shortCircuitThreshold: 0, minWords: 1 });
        expect(chunks.length).toBe(0);
    });

    it('7. Very long single sentence (>300 words) → handled without hanging', () => {
        const longWord = 'word ';
        const longSentence = longWord.repeat(350) + '.';

        // Given maxWords is 50 by default, it should split into roughly 7 chunks
        const chunks = chunkResponseText(longSentence, { shortCircuitThreshold: 0, minWords: 1, maxWords: 50 });

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0].text.split(/\s+/).length).toBeLessThanOrEqual(51); // Allow slight leniency for boundary splits
    });

    it('8. Input with mixed code + prose → code preserved, prose chunked correctly', () => {
        const text = "Prose one. Prose two. ```\ncode. block.\n``` Prose three.";
        const chunks = chunkResponseText(text, { shortCircuitThreshold: 0, minWords: 1 });

        expect(chunks.some(c => c.text === 'Prose one.')).toBe(true);
        expect(chunks.some(c => c.text === 'Prose two.')).toBe(true);
        expect(chunks.some(c => c.text === 'Prose three.')).toBe(true);
        expect(chunks.some(c => c.text.includes('code. block.'))).toBe(true);
    });

    it('9. Verify sentenceIndex increments correctly across chunks', () => {
        const text = 'One. Two. Three. Four.';
        const chunks = chunkResponseText(text, { shortCircuitThreshold: 0, minWords: 1 });

        expect(chunks.length).toBe(4);
        expect(chunks[0].index).toBe(0);
        expect(chunks[1].index).toBe(1);
        expect(chunks[2].index).toBe(2);
        expect(chunks[3].index).toBe(3);
    });

    it('10. Verify the async generator protocol (for await ... of)', async () => {
        const chunker = createResponseChunker({ shortCircuitThreshold: 0, minWords: 1 });
        const stream = simulateStream('Hello there! This is streaming. Is it working? Yes.');

        const chunks = [];
        for await (const chunk of chunker.chunkStream(stream)) {
            chunks.push(chunk);
        }

        expect(chunks.length).toBe(4);
        expect(chunks[0].text).toBe('Hello there!');
        expect(chunks[1].text).toBe('This is streaming.');
        expect(chunks[2].text).toBe('Is it working?');
        expect(chunks[3].text).toBe('Yes.');
        expect(chunks[3].isFinal).toBe(true);
    });
});
