import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getIntentClassifier,
    resetIntentClassifier,
    levenshtein,
    normalizeQuery
} from '../intent-classifier';

describe('Intent Classifier System', () => {

    describe('normalizeQuery', () => {
        it('lowercases strings', () => {
            expect(normalizeQuery('HELLO World')).toBe('hello world');
        });

        it('trims whitespace and collapses multiple spaces', () => {
            expect(normalizeQuery('  hello     world  ')).toBe('hello world');
        });

        it('removes punctuation', () => {
            expect(normalizeQuery('what, is an array?!.')).toBe('what is an array');
        });

        it('handles empty strings', () => {
            expect(normalizeQuery('')).toBe('');
        });

        it('handles unicode input gracefully', () => {
            expect(normalizeQuery('こんにちは')).toBe('こんにちは');
        });
    });

    describe('levenshtein', () => {
        it('calculates distance accurately for known pairs', () => {
            expect(levenshtein('kitten', 'sitting')).toBe(3);
            expect(levenshtein('flaw', 'lawn')).toBe(2);
            expect(levenshtein('intention', 'execution')).toBe(5);
        });

        it('handles identical strings', () => {
            expect(levenshtein('hello', 'hello')).toBe(0);
        });

        it('handles empty strings', () => {
            expect(levenshtein('', 'hello')).toBe(5);
            expect(levenshtein('hello', '')).toBe(5);
            expect(levenshtein('', '')).toBe(0);
        });
    });

    describe('IntentClassifier class', () => {
        // We test via the singleton to cover its usage
        let classifier = getIntentClassifier({ enableLLMPass: false });

        beforeEach(() => {
            resetIntentClassifier();
            classifier = getIntentClassifier({ enableLLMPass: false });
        });

        afterEach(() => {
            classifier.clearCache();
        });

        describe('Classification Accuracy', () => {
            it('classifies greeting intents correctly', async () => {
                const res = await classifier.classify('Hello!');
                expect(res.category).toBe('greeting');
                expect(res.complexity).toBe('simple');
            });

            it('classifies technical/explain intents correctly', async () => {
                const res = await classifier.classify('Can you explain how Dijkstra algorithm works?');
                expect(res.category).toBe('technical');
                expect(res.complexity).toBe('complex');
                expect(res.suggestedModel).toBe('gemini');
            });

            it('classifies clarify intents correctly', async () => {
                const res = await classifier.classify("I didn't get that");
                expect(res.category).toBe('clarification');
                expect(res.complexity).toBe('simple');
                expect(res.suggestedModel).toBe('groq');
            });

            it('classifies code review / solution evaluation intents correctly', async () => {
                const res = await classifier.classify('Can you review my solution?');
                expect(res.category).toBe('code_review');
                expect(res.complexity).toBe('complex');
                expect(res.suggestedModel).toBe('gemini');
            });

            it('classifies behavioral constraints', async () => {
                const res = await classifier.classify('Tell me about a time when you failed.');
                expect(res.category).toBe('behavioral');
                expect(res.complexity).toBe('complex');
            });
        });

        describe('Edge Cases', () => {
            it('handles empty string gracefully', async () => {
                const res = await classifier.classify('');
                expect(res.category).toBe('technical'); // 0 words -> default fallback is complex/technical
                expect(res.complexity).toBe('complex');
            });

            it('handles single word gracefully', async () => {
                const res = await classifier.classify('explain');
                expect(res.category).toBe('clarification'); // Fails regex, falls back to default short query
                expect(res.complexity).toBe('simple');
            });

            it('handles very long input (>500 chars)', async () => {
                const longStr = 'design '.repeat(100);
                const res = await classifier.classify(longStr);
                // "design" triggers the complex pattern
                expect(res.complexity).toBe('complex');
                expect(res.category).toBe('technical');
            });

            it('handles unicode/foreign characters gracefully', async () => {
                const res = await classifier.classify('こんにちは');
                // Doesn't match regex, falls back since it's short
                expect(res.complexity).toBe('simple');
                expect(res.category).toBe('clarification');
            });
        });

        describe('Fuzzy Matching & Caching', () => {
            it('caches exact matches', async () => {
                const res1 = await classifier.classify('what is an array');
                const res2 = await classifier.classify('What is an array?!'); // Normalizes to the same string
                expect(res2.reasoning).toBe('cache_hit');
                expect(res2.category).toBe(res1.category);
            });

            it('classifies queries with typos using fuzzy cache match', async () => {
                const seed = await classifier.classify('explain binary search');
                expect(seed.reasoning).toContain('regex:algorithm');

                // 2 character edit distance (missing 'b', missing 'h')
                const typoRes = await classifier.classify('explain inary searc');
                expect(typoRes.reasoning).toBe('fuzzy_cache_hit');
                expect(typoRes.category).toBe(seed.category);
            });
        });

        describe('Boundary Cases', () => {
            it('gives precedence to higher confidence patterns for ambiguous inputs', async () => {
                // "hello, how would you design a system?"
                // Contains both greeting and system design
                const res = await classifier.classify('hello, how would you design a system?');
                // In our patterns, simple greetings usually require the ENTIRE string to match (^...$)
                // So greeting regex will fail, and design regex will hit.
                expect(res.category).toBe('technical');
                expect(res.complexity).toBe('complex');
            });
        });
    });
});
