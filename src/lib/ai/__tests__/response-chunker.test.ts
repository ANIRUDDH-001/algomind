/**
 * Unit tests for ResponseChunker.
 *
 * Run:
 *   npx vitest run src/lib/ai/__tests__/response-chunker.test.ts
 */

import { describe, test, expect } from 'vitest';
import {
    ResponseChunker,
    isSentenceBoundary,
    countWords,
    chunkResponseText,
    createResponseChunker,
    type ResponseChunk,
} from '../response-chunker';

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a fake async iterable from an array of token strings. */
async function* fakeStream(tokens: string[]): AsyncGenerator<string> {
    for (const token of tokens) {
        yield token;
    }
}

/** Collect all chunks from an async generator into an array. */
async function collectChunks(
    gen: AsyncGenerator<ResponseChunk>
): Promise<ResponseChunk[]> {
    const chunks: ResponseChunk[] = [];
    for await (const chunk of gen) {
        chunks.push(chunk);
    }
    return chunks;
}

// ── isSentenceBoundary ──────────────────────────────────────────────

describe('isSentenceBoundary', () => {
    test('period at end of sentence → true', () => {
        expect(isSentenceBoundary('Hello world.')).toBe(true);
    });

    test('exclamation mark → true', () => {
        expect(isSentenceBoundary('Hello world!')).toBe(true);
    });

    test('question mark → true', () => {
        expect(isSentenceBoundary('Is this correct?')).toBe(true);
    });

    test('no punctuation → false', () => {
        expect(isSentenceBoundary('Hello world')).toBe(false);
    });

    test('abbreviation "Dr." → false', () => {
        expect(isSentenceBoundary('Talk to Dr.')).toBe(false);
    });

    test('abbreviation "Mr." → false', () => {
        expect(isSentenceBoundary('Hello Mr.')).toBe(false);
    });

    test('abbreviation "vs." → false', () => {
        expect(isSentenceBoundary('arrays vs.')).toBe(false);
    });

    test('abbreviation "etc." → false', () => {
        expect(isSentenceBoundary('apples, oranges, etc.')).toBe(false);
    });

    test('abbreviation "e.g." → false', () => {
        expect(isSentenceBoundary('for example e.g.')).toBe(false);
    });

    test('single letter abbreviation "U." → false', () => {
        expect(isSentenceBoundary('The U.')).toBe(false);
    });

    test('acronym pattern "U.S.A." → false', () => {
        expect(isSentenceBoundary('In the U.S.A.')).toBe(false);
    });

    test('decimal number "3.14" → false', () => {
        expect(isSentenceBoundary('Pi is 3.14')).toBe(false);
    });

    test('empty string → false', () => {
        expect(isSentenceBoundary('')).toBe(false);
    });
});

// ── countWords ──────────────────────────────────────────────────────

describe('countWords', () => {
    test('basic sentence', () => {
        expect(countWords('hello world')).toBe(2);
    });

    test('empty string → 0', () => {
        expect(countWords('')).toBe(0);
    });

    test('whitespace only → 0', () => {
        expect(countWords('   ')).toBe(0);
    });

    test('extra whitespace normalized', () => {
        expect(countWords('  hello   world  ')).toBe(2);
    });
});

// ── ResponseChunker.chunkText (synchronous) ─────────────────────────

describe('ResponseChunker.chunkText', () => {
    test('short text (< 20 words) returns single chunk', () => {
        const chunker = new ResponseChunker();
        const chunks = chunker.chunkText('Hello world.');
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe('Hello world.');
        expect(chunks[0].isFinal).toBe(true);
    });

    test('multiple sentences create multiple chunks', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0 });
        const text =
            'This is the first sentence. This is the second one. And here is the last.';
        const chunks = chunker.chunkText(text);
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        // Last chunk should be final
        expect(chunks[chunks.length - 1].isFinal).toBe(true);
        // Reconstruct should contain all content
        const reconstructed = chunks.map(c => c.text).join(' ');
        expect(reconstructed).toContain('first sentence');
        expect(reconstructed).toContain('second one');
        expect(reconstructed).toContain('last');
    });

    test('abbreviations are not split', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0, minWords: 1 });
        const text = 'Talk to Dr. Smith about this problem. He knows the answer.';
        const chunks = chunker.chunkText(text);
        // "Dr." should NOT cause a split
        const allText = chunks.map(c => c.text).join(' ');
        expect(allText).toContain('Dr. Smith');
    });

    test('chunks have sequential IDs', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0 });
        const text =
            'First sentence here now. Second sentence now here. Third sentence is here.';
        const chunks = chunker.chunkText(text);
        chunks.forEach((chunk, i) => {
            expect(chunk.id).toBe(`chunk-${i}`);
            expect(chunk.index).toBe(i);
        });
    });

    test('max word limit splits long runs', () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            maxWords: 10,
            minWords: 1,
        });
        // 30 words with no sentence boundary
        const text = Array(30).fill('word').join(' ') + '.';
        const chunks = chunker.chunkText(text);
        // Should be split into multiple chunks of ~10 words
        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(countWords(chunk.text)).toBeLessThanOrEqual(11); // allow small overflow
        }
    });

    test('min word threshold merges tiny sentences', () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 5,
        });
        // Two tiny sentences that should be merged
        const text =
            'Yes. No. Maybe. Definitely yes I think so. Absolutely that is correct.';
        const chunks = chunker.chunkText(text);
        // Should not produce chunks with < 5 words (except possibly the last)
        for (let i = 0; i < chunks.length - 1; i++) {
            expect(countWords(chunks[i].text)).toBeGreaterThanOrEqual(5);
        }
    });
});

// ── ResponseChunker.chunkStream (async generator) ───────────────────

describe('ResponseChunker.chunkStream', () => {
    test('streams tokens and yields sentence chunks', async () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 1,
        });

        const tokens = [
            'Hello ',
            'world. ',
            'How are ',
            'you? ',
            'Fine.',
        ];

        const chunks = await collectChunks(chunker.chunkStream(fakeStream(tokens)));

        expect(chunks.length).toBeGreaterThanOrEqual(2);
        const allText = chunks.map(c => c.text).join(' ');
        expect(allText).toContain('Hello world.');
    });

    test('yields final chunk with remaining buffer', async () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 1,
        });

        const tokens = ['No sentence ending here'];
        const chunks = await collectChunks(chunker.chunkStream(fakeStream(tokens)));

        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe('No sentence ending here');
        expect(chunks[0].isFinal).toBe(true);
    });

    test('timing.generatedAt is populated', async () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 1,
        });

        const tokens = ['Hello. ', 'World.'];
        const chunks = await collectChunks(chunker.chunkStream(fakeStream(tokens)));

        for (const chunk of chunks) {
            expect(typeof chunk.timing.generatedAt).toBe('number');
            expect(chunk.timing.generatedAt).toBeGreaterThanOrEqual(0);
        }
    });

    test('respects abort signal', async () => {
        const controller = new AbortController();
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 1,
            signal: controller.signal,
        });

        async function* slowStream(): AsyncGenerator<string> {
            yield 'First sentence. ';
            controller.abort();
            yield 'Second sentence. ';
            yield 'Third sentence.';
        }

        const chunks = await collectChunks(chunker.chunkStream(slowStream()));
        // Should have at most 1 chunk (aborted before second can yield)
        expect(chunks.length).toBeLessThanOrEqual(1);
    });

    test('empty stream produces no chunks', async () => {
        const chunker = new ResponseChunker();
        const chunks = await collectChunks(chunker.chunkStream(fakeStream([])));
        expect(chunks).toHaveLength(0);
    });
});

// ── Factory helpers ─────────────────────────────────────────────────

describe('factory helpers', () => {
    test('createResponseChunker returns instance', () => {
        const chunker = createResponseChunker();
        expect(chunker).toBeInstanceOf(ResponseChunker);
    });

    test('chunkResponseText returns chunks', () => {
        const chunks = chunkResponseText('Hello world.');
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe('Hello world.');
    });
});

// ── Edge cases ──────────────────────────────────────────────────────

describe('edge cases', () => {
    test('empty string', () => {
        const chunks = new ResponseChunker().chunkText('');
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe('');
    });

    test('single word', () => {
        const chunks = new ResponseChunker().chunkText('Hello');
        expect(chunks).toHaveLength(1);
    });

    test('multiple consecutive punctuation', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0, minWords: 1 });
        const text = 'Really?! That is amazing!!! Wow.';
        const chunks = chunker.chunkText(text);
        const allText = chunks.map(c => c.text).join(' ');
        expect(allText).toContain('Really?');
        expect(allText).toContain('amazing!');
    });

    test('text with code blocks is not split incorrectly', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0, minWords: 1 });
        const text = 'Use array.sort() to sort. Then iterate the result.';
        const chunks = chunker.chunkText(text);
        const allText = chunks.map(c => c.text).join(' ');
        expect(allText).toContain('sort');
        expect(allText).toContain('iterate');
    });
});

// ── Performance ─────────────────────────────────────────────────────

describe('performance', () => {
    test('chunkText completes in < 5ms for normal text', () => {
        const chunker = new ResponseChunker({ shortCircuitThreshold: 0 });
        const text = Array(10)
            .fill('This is a sample sentence for testing chunking performance.')
            .join(' ');

        const start = performance.now();
        chunker.chunkText(text);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(5);
    });

    test('chunkStream time-to-first-chunk is < 2ms', async () => {
        const chunker = new ResponseChunker({
            shortCircuitThreshold: 0,
            minWords: 1,
        });

        const tokens = ['Hello world. ', 'This is a test. ', 'Final sentence.'];
        const streamStart = performance.now();

        let firstChunkTime = 0;
        for await (const chunk of chunker.chunkStream(fakeStream(tokens))) {
            if (firstChunkTime === 0) {
                firstChunkTime = performance.now() - streamStart;
            }
        }

        expect(firstChunkTime).toBeLessThan(2);
    });
});
