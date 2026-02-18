/**
 * Unit tests for IntentClassifier.
 *
 * Run:
 *   npx vitest run src/lib/ai/__tests__/intent-classifier.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    IntentClassifier,
    levenshtein,
    type IntentClassification,
} from '../intent-classifier';

// ── Levenshtein tests ───────────────────────────────────────────────

describe('levenshtein', () => {
    test('identical strings → 0', () => {
        expect(levenshtein('hello', 'hello')).toBe(0);
    });

    test('empty vs non-empty', () => {
        expect(levenshtein('', 'abc')).toBe(3);
        expect(levenshtein('abc', '')).toBe(3);
    });

    test('single substitution → 1', () => {
        expect(levenshtein('cat', 'bat')).toBe(1);
    });

    test('insertion → 1', () => {
        expect(levenshtein('cat', 'cats')).toBe(1);
    });

    test('deletion → 1', () => {
        expect(levenshtein('cats', 'cat')).toBe(1);
    });

    test('multiple edits', () => {
        expect(levenshtein('kitten', 'sitting')).toBe(3);
    });
});

// ── IntentClassifier ────────────────────────────────────────────────

describe('IntentClassifier', () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
        classifier = new IntentClassifier({ enableLLMPass: false });
    });

    // ── Simple intents (→ Groq) ─────────────────────────────────────

    describe('simple intents → groq', () => {
        const simpleQueries = [
            'hi',
            'hello',
            'Hey!',
            'good morning',
            'thanks',
            'thank you',
            'yes',
            'no',
            'okay',
            'sure',
            'got it',
            'I see',
            'understood',
            'makes sense',
            "that's correct",
            'yes, exactly',
            'can you repeat',
            'what do you mean',
            "I'm ready",
            "let's go",
        ];

        test.each(simpleQueries)('"%s" → simple/groq', async (query) => {
            const result = await classifier.classify(query);
            expect(result.complexity).toBe('simple');
            expect(result.suggestedModel).toBe('groq');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });
    });

    // ── Medium intents (→ Groq) ─────────────────────────────────────

    describe('medium intents → groq', () => {
        const mediumQueries = [
            'what is a hash table?',
            'what are linked lists?',
            'give me an example of recursion',
            'show me an example',
            'how does caching work?',
        ];

        test.each(mediumQueries)('"%s" → medium/groq', async (query) => {
            const result = await classifier.classify(query);
            expect(result.complexity).toBe('medium');
            expect(result.suggestedModel).toBe('groq');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });
    });

    // ── Complex intents (→ Gemini) ──────────────────────────────────

    describe('complex intents → gemini', () => {
        const complexQueries = [
            'explain merge sort algorithm step by step',
            'review my code for the binary search implementation',
            'how would you design a URL shortener?',
            'compare arrays vs linked lists pros and cons',
            'tell me about a time when you had to debug a hard problem',
            'what is the time complexity of quicksort?',
            'optimize my solution to make it faster',
        ];

        test.each(complexQueries)('"%s" → complex/gemini', async (query) => {
            const result = await classifier.classify(query);
            expect(result.complexity).toBe('complex');
            expect(result.suggestedModel).toBe('gemini');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });
    });

    // ── Confidence thresholds ───────────────────────────────────────

    test('high confidence for exact greeting', async () => {
        const result = await classifier.classify('hello');
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('fallback when no pattern matches', async () => {
        const result = await classifier.classify(
            'asdfghjkl random gibberish 12345 that matches nothing'
        );
        expect(result.suggestedModel).toBe('gemini'); // safe fallback
        expect(result.confidence).toBeLessThan(0.8);
    });

    // ── Cache behavior ──────────────────────────────────────────────

    describe('caching', () => {
        test('second call returns cache_hit', async () => {
            await classifier.classify('hello');
            const second = await classifier.classify('hello');
            expect(second.reasoning).toBe('cache_hit');
        });

        test('clearCache empties the cache', async () => {
            await classifier.classify('hello');
            expect(classifier.getCacheSize()).toBeGreaterThan(0);
            classifier.clearCache();
            expect(classifier.getCacheSize()).toBe(0);
        });

        test('LRU eviction when cache is full', async () => {
            const small = new IntentClassifier({
                enableLLMPass: false,
                maxCacheSize: 3,
                fuzzyThreshold: 0,
            });

            await small.classify('hi');
            await small.classify('hello');
            await small.classify('hey');
            expect(small.getCacheSize()).toBe(3);

            // This should evict 'hi'
            await small.classify('yes');
            expect(small.getCacheSize()).toBe(3);

            // 'hi' was evicted, should not be a cache_hit
            const result = await small.classify('hi');
            expect(result.reasoning).not.toBe('cache_hit');
        });
    });

    // ── Fuzzy matching ──────────────────────────────────────────────

    describe('fuzzy matching', () => {
        test('typo within threshold returns fuzzy_cache_hit', async () => {
            await classifier.classify('hello');
            // "helo" is edit distance 1 from "hello"
            const result = await classifier.classify('helo');
            expect(result.reasoning).toBe('fuzzy_cache_hit');
        });

        test('large edit distance does not fuzzy match', async () => {
            await classifier.classify('hello');
            // "xxxxx" is edit distance 5 from "hello" — too far
            const result = await classifier.classify('xxxxx');
            expect(result.reasoning).not.toBe('fuzzy_cache_hit');
        });

        test('fuzzy match reduces confidence slightly', async () => {
            const original = await classifier.classify('hello');
            const fuzzy = await classifier.classify('helo');
            expect(fuzzy.confidence).toBeLessThan(original.confidence);
        });
    });

    // ── Admin model override ────────────────────────────────────────

    describe('model override', () => {
        test('override forces model regardless of classification', async () => {
            classifier.setModelOverride('gemini');
            const result = await classifier.classify('hi'); // normally groq
            expect(result.suggestedModel).toBe('gemini');
            expect(result.reasoning).toContain('Admin override');
        });

        test('clearing override restores normal behavior', async () => {
            classifier.setModelOverride('gemini');
            classifier.setModelOverride(null);
            const result = await classifier.classify('hi');
            expect(result.suggestedModel).toBe('groq');
        });

        test('getModelOverride returns current override', () => {
            expect(classifier.getModelOverride()).toBeNull();
            classifier.setModelOverride('groq');
            expect(classifier.getModelOverride()).toBe('groq');
        });
    });

    // ── Feedback ────────────────────────────────────────────────────

    describe('feedback', () => {
        test('updateFromFeedback overrides cached classification', async () => {
            await classifier.classify('hello');

            // Admin says this should be complex/gemini
            classifier.updateFromFeedback('hello', {
                complexity: 'complex',
                category: 'technical',
                confidence: 1.0,
                suggestedModel: 'gemini',
            });

            const result = await classifier.classify('hello');
            expect(result.complexity).toBe('complex');
            expect(result.suggestedModel).toBe('gemini');
            expect(result.reasoning).toBe('cache_hit');
        });
    });

    // ── classifySync ────────────────────────────────────────────────

    describe('classifySync', () => {
        test('returns classification for regex-matched query', () => {
            const result = classifier.classifySync('hello');
            expect(result).not.toBeNull();
            expect(result!.complexity).toBe('simple');
            expect(result!.suggestedModel).toBe('groq');
        });

        test('returns null for unmatched query', () => {
            const result = classifier.classifySync(
                'asdfghjkl random gibberish that nothing matches'
            );
            expect(result).toBeNull();
        });

        test('uses cache on second call', () => {
            classifier.classifySync('hello');
            const second = classifier.classifySync('hello');
            expect(second?.reasoning).toBe('cache_hit');
        });
    });

    // ── Performance ─────────────────────────────────────────────────

    describe('performance', () => {
        test('regex classification completes in < 5ms', async () => {
            const queries = [
                'hi', 'what is a stack?', 'explain merge sort algorithm',
                'yes', 'review my code', 'got it',
            ];

            for (const q of queries) {
                const start = performance.now();
                await classifier.classify(q);
                const elapsed = performance.now() - start;
                expect(elapsed).toBeLessThan(5);
            }
        });

        test('cached classification completes in < 1ms', async () => {
            await classifier.classify('hello'); // warm cache

            const start = performance.now();
            for (let i = 0; i < 100; i++) {
                await classifier.classify('hello');
            }
            const avg = (performance.now() - start) / 100;
            expect(avg).toBeLessThan(1);
        });
    });

    // ── Edge cases ──────────────────────────────────────────────────

    describe('edge cases', () => {
        test('empty string does not throw', async () => {
            const result = await classifier.classify('');
            expect(result).toBeDefined();
            expect(result.suggestedModel).toBeDefined();
        });

        test('very long query defaults to gemini', async () => {
            const longQuery = 'explain '.repeat(100) + 'everything about everything';
            const result = await classifier.classify(longQuery);
            expect(result.suggestedModel).toBe('gemini');
        });

        test('case insensitive matching', async () => {
            const lower = await classifier.classify('hello');
            const upper = await classifier.classify('HELLO');
            expect(lower.complexity).toBe(upper.complexity);
            expect(lower.suggestedModel).toBe(upper.suggestedModel);
        });

        test('whitespace trimming', async () => {
            const result = await classifier.classify('   hello   ');
            expect(result.complexity).toBe('simple');
            expect(result.suggestedModel).toBe('groq');
        });
    });

    // ── getCacheStats ───────────────────────────────────────────────

    test('getCacheStats returns correct info', async () => {
        await classifier.classify('hi');
        await classifier.classify('hello');
        const stats = classifier.getCacheStats();
        expect(stats.size).toBe(2);
        expect(stats.keys).toContain('hi');
        expect(stats.keys).toContain('hello');
    });

    // ── LLM Classification (Mocked) ─────────────────────────────────

    describe('LLM classification', () => {
        beforeEach(() => {
            // Enable LLM pass
            classifier = new IntentClassifier({
                enableLLMPass: true,
                llmTimeoutMs: 1000,
                confidenceThreshold: 0.7,
            });

            // Mock fetch
            global.fetch = vi.fn();
            process.env.GROQ_API_KEY = 'mock-key';
        });

        afterEach(() => {
            vi.restoreAllMocks();
            delete process.env.GROQ_API_KEY;
        });

        test('parses valid LLM response correctly', async () => {
            const mockResponse = {
                complexity: 'complex',
                category: 'technical',
                confidence: 0.9,
                reasoning: 'Detailed question about algorithms',
            };

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: '```json\n' + JSON.stringify(mockResponse) + '\n```'
                        }
                    }]
                })
            });

            // Query that fails regex (no match) so it falls through to LLM
            const result = await classifier.classify('explain the intricate details of quantum computing algorithms');

            expect(result.complexity).toBe('complex');
            expect(result.category).toBe('technical');
            expect(result.reasoning).toContain('llm:Detailed question');
            expect(global.fetch).toHaveBeenCalledOnce();
        });

        test('falls back to default on fetch error', async () => {
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            const result = await classifier.classify('complex question unique 12345');

            // Should fallback to Gemini default
            expect(result.suggestedModel).toBe('gemini');
            expect(result.reasoning).toContain('defaulting to Gemini');
        });

        test('corrects malformed JSON from LLM', async () => {
            // LLM returns bad JSON
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: 'This is not JSON' }
                    }]
                })
            });

            const result = await classifier.classify('complex question unique 67890');
            expect(result.suggestedModel).toBe('gemini');
        });

        test('validates schema of LLM response', async () => {
            // Missing fields
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: { content: JSON.stringify({ complexity: 'simple' }) } // missing category/confidence
                    }]
                })
            });

            const result = await classifier.classify('complex question unique 13579');
            expect(result.suggestedModel).toBe('gemini');
        });

        test('skips LLM if no API key', async () => {
            delete process.env.GROQ_API_KEY;
            const result = await classifier.classify('complex question unique 24680');
            expect(global.fetch).not.toHaveBeenCalled();
            expect(result.suggestedModel).toBe('gemini');
        });
    });
});
