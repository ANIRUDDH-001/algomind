/**
 * ResponseChunker — splits AI streaming output into sentence-level chunks
 * for TTS pipelining.
 *
 * Yields `ResponseChunk` objects as soon as a sentence boundary is detected,
 * allowing TTS to start speaking the first sentence while the AI generates
 * the rest.
 *
 * @module response-chunker
 */
// @ts-nocheck

// 


// ── Types ───────────────────────────────────────────────────────────

export interface ResponseChunk {
    /** Unique chunk identifier (sequential) */
    id: string;
    /** The sentence/chunk text */
    text: string;
    /** Whether this is the last chunk of the response */
    isFinal: boolean;
    /** Chunk index (0-based) */
    index: number;
    /** Timing metadata */
    timing: {
        /** When the chunk was generated (ms since stream start) */
        generatedAt: number;
        /** When the chunk was spoken — set externally by TTS */
        spokenAt?: number;
    };
}

export interface ChunkerOptions {
    /** Minimum number of words per chunk (avoids tiny chunks). Default: 5 */
    minWords?: number;
    /** Maximum number of words per chunk (avoids long pauses). Default: 50 */
    maxWords?: number;
    /** Skip chunking if total response has fewer words than this. Default: 20 */
    shortCircuitThreshold?: number;
    /** AbortSignal for cancelling mid-stream */
    signal?: AbortSignal;
}

export interface ChunkerStats {
    /** Total chunks produced */
    totalChunks: number;
    /** Time to first chunk (ms from stream start) */
    timeToFirstChunkMs: number;
    /** Total stream duration (ms) */
    totalDurationMs: number;
    /** Average chunk size in words */
    avgChunkWords: number;
}

// ── Constants ───────────────────────────────────────────────────────

const DEFAULT_MIN_WORDS = 5;
const DEFAULT_MAX_WORDS = 50;
const DEFAULT_SHORT_CIRCUIT = 20;

/**
 * Abbreviations and patterns that should NOT be treated as sentence endings.
 * The trailing period in these is not a sentence boundary.
 */
const ABBREVIATIONS = new Set([
    'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr',
    'vs', 'etc', 'approx', 'dept', 'est', 'vol',
    'e.g', 'i.e', 'ex', 'fig', 'inc', 'ltd',
    'no', 'st', 'ave', 'blvd',
]);

/**
 * Regex for detecting likely abbreviation patterns:
 * - Single uppercase letter followed by period: "U." "S." "A."
 * - Decimal numbers: "3.14", "0.5"
 */
const ABBREVIATION_LIKE = /(?:^|\s)(?:[A-Z]\.)+$|(?:\d+\.\d*)$/;

// ── Sentence boundary detection ─────────────────────────────────────

/**
 * Determine if a potential sentence boundary (period/exclamation/question)
 * at the end of `textBefore` is a real sentence ending.
 */
export function isSentenceBoundary(textBefore: string): boolean {
    const trimmed = textBefore.trimEnd();
    if (!trimmed) return false;

    // Must end with sentence-ending punctuation
    const lastChar = trimmed.charAt(trimmed.length - 1);
    if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') return false;

    // Exclamation and question marks are always sentence boundaries
    if (lastChar === '!' || lastChar === '?') return true;

    // Check for abbreviation-like patterns (e.g., "U.S.A.", "3.14")
    if (ABBREVIATION_LIKE.test(trimmed)) return false;

    // Check if the last word (before the period) is a known abbreviation
    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1]
        .replace(/[.!?]+$/, '')
        .toLowerCase();

    if (ABBREVIATIONS.has(lastWord)) return false;

    return true;
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

// ── ResponseChunker ─────────────────────────────────────────────────

export class ResponseChunker {
    private readonly opts: Required<Omit<ChunkerOptions, 'signal'>>;
    private readonly signal?: AbortSignal;

    constructor(options: ChunkerOptions = {}) {
        this.opts = {
            minWords: options.minWords ?? DEFAULT_MIN_WORDS,
            maxWords: options.maxWords ?? DEFAULT_MAX_WORDS,
            shortCircuitThreshold: options.shortCircuitThreshold ?? DEFAULT_SHORT_CIRCUIT,
        };
        this.signal = options.signal;
    }

    /**
     * Process a streaming AI response and yield sentence-level chunks.
     *
     * @param aiStream — An async iterable of string tokens (e.g., from Groq/Gemini streaming)
     * @yields ResponseChunk — each chunk is a complete sentence or bounded text fragment
     */
    async *chunkStream(
        aiStream: AsyncIterable<string>
    ): AsyncGenerator<ResponseChunk> {
        const streamStart = performance.now();
        let buffer = '';
        let chunkIndex = 0;
        //  -- automated unused local suppression
        let firstChunkTime = 0;
        let lastYieldedChunk: ResponseChunk | null = null;

        for await (const token of aiStream) {
            // Check for abort
            if (this.signal?.aborted) return;

            buffer += token;

            // Try to extract complete sentences from the buffer
            const extracted = this.extractSentences(buffer);

            for (const sentence of extracted.sentences) {
                if (this.signal?.aborted) return;

                const now = performance.now() - streamStart;
                if (chunkIndex === 0) firstChunkTime = now;

                const chunk: ResponseChunk = {
                    id: `chunk-${chunkIndex}`,
                    text: sentence,
                    isFinal: false,
                    index: chunkIndex,
                    timing: { generatedAt: now },
                };
                lastYieldedChunk = chunk;
                yield chunk;
                chunkIndex++;
            }

            buffer = extracted.remainder;
        }

        // Flush remaining buffer as the final chunk
        const remaining = buffer.trim();
        if (remaining && !this.signal?.aborted) {
            const now = performance.now() - streamStart;
            if (chunkIndex === 0) firstChunkTime = now;

            yield {
                id: `chunk-${chunkIndex}`,
                text: remaining,
                isFinal: true,
                index: chunkIndex,
                timing: { generatedAt: now },
            };
        } else if (lastYieldedChunk && !this.signal?.aborted) {
            // Mark the last yielded chunk as final, modifying the reference returned to consumer.
            lastYieldedChunk.isFinal = true;
        }
    }

    /**
     * Simple non-streaming chunker: split a complete text into sentence chunks.
     * Useful when the full response is already available and streaming isn't needed.
     */
    chunkText(text: string): ResponseChunk[] {
        const words = countWords(text);

        // Short-circuit: don't chunk short responses
        if (words < this.opts.shortCircuitThreshold) {
            return [{
                id: 'chunk-0',
                text: text.trim(),
                isFinal: true,
                index: 0,
                timing: { generatedAt: 0 },
            }];
        }

        const chunks: ResponseChunk[] = [];
        let remaining = text;
        let index = 0;

        while (remaining.trim()) {
            const extracted = this.extractSentences(remaining, true);

            for (const sentence of extracted.sentences) {
                chunks.push({
                    id: `chunk-${index}`,
                    text: sentence,
                    isFinal: false,
                    index,
                    timing: { generatedAt: 0 },
                });
                index++;
            }

            // If no sentences were extracted (e.g., no boundary found), flush remainder
            if (extracted.sentences.length === 0) {
                if (extracted.remainder.trim()) {
                    chunks.push({
                        id: `chunk-${index}`,
                        text: extracted.remainder.trim(),
                        isFinal: true,
                        index,
                        timing: { generatedAt: 0 },
                    });
                }
                break;
            }

            remaining = extracted.remainder;
        }

        // Mark last chunk as final
        if (chunks.length > 0) {
            chunks[chunks.length - 1].isFinal = true;
        }

        return chunks;
    }

    /**
     * Extract complete sentences from a text buffer.
     *
     * Walks character-by-character looking for sentence-ending punctuation
     * followed by whitespace. Returns extracted sentences and the remaining
     * un-consumed buffer.
     */
    private extractSentences(
        buffer: string,
        greedy = false
    ): { sentences: string[]; remainder: string } {
        const sentences: string[] = [];
        let current = '';
        let i = 0;

        let inCodeBlock = false;

        while (i < buffer.length) {
            current += buffer[i];
            i++;

            // Recalculate inCodeBlock for the current state
            const codeMatches = current.match(/```/g);
            const wasInCodeBlock = inCodeBlock;
            inCodeBlock = codeMatches ? codeMatches.length % 2 === 1 : false;

            const ch = buffer[i - 1];
            const nextCh = buffer[i] ?? '';

            // If we just exited a code block, yield the entire block immediately
            if (wasInCodeBlock && !inCodeBlock) {
                sentences.push(current.trim());
                current = '';
                continue;
            }

            if (inCodeBlock) {
                continue; // Do not apply prose splitting inside code block
            }

            // Check if current is building a bullet list item
            const lines = current.split('\n');
            const activeLine = current.endsWith('\n') ? lines[lines.length - 2] : lines[lines.length - 1];
            const isBulletLine = /^\s*([-*+]|\d+\.)\s/.test(activeLine || '');

            if (isBulletLine) {
                // Bullet items end exclusively upon newline
                if (ch === '\n') {
                    const wordCount = countWords(current);
                    if (wordCount >= this.opts.minWords) {
                        sentences.push(current.trim());
                        current = '';
                    }
                }
                continue; // Bypass standard prose rules and force splits
            }

            // Normal prose
            const isEnd = ch === '.' || ch === '!' || ch === '?';
            const isFollowedBySpace = /\s/.test(nextCh) || i === buffer.length;

            let shouldYield = false;

            if (isEnd && isFollowedBySpace) {
                if (isSentenceBoundary(current)) {
                    shouldYield = true;
                }
            }

            if (shouldYield) {
                const wordCount = countWords(current);

                // For prose exceeding max words, split
                if (wordCount > this.opts.maxWords) {
                    const split = this.splitAtMaxWords(current);
                    sentences.push(...split.chunks);
                    current = split.remainder;
                } else if (wordCount >= this.opts.minWords) {
                    sentences.push(current.trim());
                    current = '';
                } else if (i === buffer.length && greedy) {
                    sentences.push(current.trim());
                    current = '';
                }
            } else if (!greedy && countWords(current) > this.opts.maxWords) {
                // Force split overly long prose (which doesn't apply to code blocks or bullets due to `continue`)
                const split = this.splitAtMaxWords(current);
                sentences.push(...split.chunks);
                current = split.remainder;
            }
        }

        return { sentences, remainder: current };
    }

    /**
     * Split text that exceeds maxWords at a natural word boundary.
     */
    private splitAtMaxWords(
        text: string
    ): { chunks: string[]; remainder: string } {
        const words = text.trim().split(/\s+/);
        const chunks: string[] = [];

        while (words.length > this.opts.maxWords) {
            const chunk = words.splice(0, this.opts.maxWords).join(' ');
            chunks.push(chunk);
        }

        return { chunks, remainder: words.join(' ') };
    }
}

// ── Factory helper ──────────────────────────────────────────────────

/**
 * Create a ResponseChunker with default options.
 */
export function createResponseChunker(
    options?: ChunkerOptions
): ResponseChunker {
    return new ResponseChunker(options);
}

/**
 * Convenience: chunk a complete text (non-streaming).
 */
export function chunkResponseText(
    text: string,
    options?: ChunkerOptions
): ResponseChunk[] {
    return new ResponseChunker(options).chunkText(text);
}
