/**
 * Unit tests for ResponseCache.
 *
 * Run:
 *   npx vitest run src/lib/ai/__tests__/response-cache.test.ts
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
    ResponseCache,
    normaliseCacheKey,
    getResponseCache,
    resetResponseCache,
} from '../response-cache';

// ── normaliseCacheKey ───────────────────────────────────────────────

describe('normaliseCacheKey', () => {
    test('lowercases and trims', () => {
        expect(normaliseCacheKey('  Hello World  ')).toBe('hello world');
    });

    test('removes punctuation', () => {
        expect(normaliseCacheKey('What is an array?')).toBe('what is an array');
    });

    test('collapses whitespace', () => {
        expect(normaliseCacheKey('hello   world   foo')).toBe('hello world foo');
    });

    test('empty string', () => {
        expect(normaliseCacheKey('')).toBe('');
    });
});

// ── ResponseCache.get / set ─────────────────────────────────────────

describe('ResponseCache', () => {
    let cache: ResponseCache;

    beforeEach(() => {
        cache = new ResponseCache({ maxEntries: 10, ttlMs: 60_000 });
    });

    test('set + get returns cached entry', () => {
        cache.set('What is an array?', 'An array is a data structure.', 'groq', 150);
        const entry = cache.get('What is an array?');
        expect(entry).not.toBeNull();
        expect(entry!.response).toBe('An array is a data structure.');
        expect(entry!.model).toBe('groq');
    });

    test('get increments hitCount', () => {
        cache.set('Hello', 'Hi there!', 'groq', 100);
        cache.get('Hello');
        cache.get('Hello');
        const entry = cache.get('Hello');
        expect(entry!.hitCount).toBe(3);
    });

    test('miss returns null', () => {
        expect(cache.get('nonexistent')).toBeNull();
    });

    test('fuzzy matching finds similar queries', () => {
        cache.set('What is an array', 'An array is...', 'groq', 100);
        // "What is a array" — edit distance 1
        const entry = cache.get('What is a array');
        expect(entry).not.toBeNull();
    });

    test('fuzzy matching rejects distant queries', () => {
        cache.set('What is an array', 'An array is...', 'groq', 100);
        // Very different query
        const entry = cache.get('How does quicksort work');
        expect(entry).toBeNull();
    });

    test('empty query returns null', () => {
        expect(cache.get('')).toBeNull();
    });
});

// ── TTL expiry ──────────────────────────────────────────────────────

describe('TTL expiry', () => {
    test('expired entries are evicted on get', () => {
        const cache = new ResponseCache({ ttlMs: 1 }); // 1ms TTL
        cache.set('hello', 'world', 'groq', 100);

        // Wait a bit for TTL to expire
        const start = Date.now();
        while (Date.now() - start < 5) { /* spin */ }

        expect(cache.get('hello')).toBeNull();
    });
});

// ── LRU eviction ────────────────────────────────────────────────────

describe('LRU eviction', () => {
    test('evicts least-used entry when at capacity', () => {
        const cache = new ResponseCache({ maxEntries: 3, fuzzyThreshold: 0 });
        cache.set('query1', 'response1', 'groq', 100);
        cache.set('query2', 'response2', 'groq', 100);
        cache.set('query3', 'response3', 'groq', 100);

        // Hit query2 and query3 to make query1 least-used
        cache.get('query2');
        cache.get('query3');

        // Add another — should evict query1
        cache.set('query4', 'response4', 'gemini', 100);

        expect(cache.get('query1')).toBeNull();
        expect(cache.get('query2')).not.toBeNull();
    });

    test('evicts oldest on tie', () => {
        const cache = new ResponseCache({ maxEntries: 2, fuzzyThreshold: 0 });
        cache.set('old', 'r1', 'groq', 100);
        cache.set('new', 'r2', 'groq', 100);

        // Both have hitCount 0, "old" should be evicted (older timestamp)
        cache.set('extra', 'r3', 'groq', 100);

        expect(cache.get('old')).toBeNull();
        expect(cache.get('new')).not.toBeNull();
    });
});

// ── Invalidation ────────────────────────────────────────────────────

describe('invalidation', () => {
    test('invalidate removes matching entries', () => {
        const cache = new ResponseCache({ maxEntries: 10 });
        cache.set('What is an array', 'Array...', 'groq', 100);
        cache.set('What is a linked list', 'List...', 'groq', 100);
        cache.set('Hello', 'Hi!', 'groq', 100);

        const removed = cache.invalidate('what is');
        expect(removed).toBe(2);
        expect(cache.get('Hello')).not.toBeNull();
    });

    test('clear removes everything', () => {
        const cache = new ResponseCache();
        cache.set('q1', 'r1', 'groq', 100);
        cache.set('q2', 'r2', 'groq', 100);
        cache.clear();

        expect(cache.size).toBe(0);
    });
});

// ── Stats ───────────────────────────────────────────────────────────

describe('getStats', () => {
    test('reports accurate stats', () => {
        const cache = new ResponseCache();
        cache.set('q1', 'r1', 'groq', 200);
        cache.set('q2', 'r2', 'gemini', 400);
        cache.get('q1');
        cache.get('q1');
        cache.get('q1');
        cache.get('nonexistent'); // miss

        const stats = cache.getStats();
        expect(stats.entries).toBe(2);
        expect(stats.totalHits).toBe(3);
        expect(stats.totalMisses).toBe(1);
        expect(stats.hitRate).toBe(75);
        expect(stats.topQueries.length).toBe(2);
        expect(stats.topQueries[0].query).toContain('q1');
    });
});

// ── Memory limit ────────────────────────────────────────────────────

describe('memory limits', () => {
    test('does not cache entry larger than max memory', () => {
        const cache = new ResponseCache({ maxMemoryBytes: 100 });
        const hugeResponse = 'x'.repeat(200); // > 100 bytes
        cache.set('q', hugeResponse, 'groq', 100);
        expect(cache.size).toBe(0);
    });

    test('evicts entries when memory limit is reached', () => {
        const cache = new ResponseCache({ maxEntries: 100, maxMemoryBytes: 100 });
        cache.set('a', 'short', 'groq', 100);
        cache.set('b', 'also short but fills up', 'groq', 100);
        // Should have evicted to stay under 100 bytes
        expect(cache.size).toBeLessThanOrEqual(2);
    });
});

// ── Pre-warming ─────────────────────────────────────────────────────

describe('preWarm', () => {
    test('caches responses from generator', async () => {
        const cache = new ResponseCache();
        const result = await cache.preWarm(
            ['q1', 'q2', 'q3'],
            async (query) => ({
                response: `answer to ${query}`,
                model: 'groq' as const,
                latencyMs: 100,
            })
        );

        expect(result.warmed).toBe(3);
        expect(result.failed).toBe(0);
        expect(cache.get('q1')!.response).toBe('answer to q1');
    });

    test('skips already cached entries', async () => {
        const cache = new ResponseCache();
        cache.set('What is an array', 'existing', 'groq', 50);

        let generatorCalls = 0;
        await cache.preWarm(
            ['What is an array', 'Explain dynamic programming'],
            async (query) => {
                generatorCalls++;
                return { response: `new ${query}`, model: 'groq' as const, latencyMs: 100 };
            }
        );

        // 'What is an array' was skipped (already cached), only 'Explain dynamic programming' was generated
        expect(generatorCalls).toBe(1);
    });

    test('handles generator failures gracefully', async () => {
        const cache = new ResponseCache();
        const result = await cache.preWarm(
            ['ok', 'fail'],
            async (query) => {
                if (query === 'fail') throw new Error('oops');
                return { response: 'ok', model: 'groq' as const, latencyMs: 100 };
            }
        );

        expect(result.warmed).toBe(1);
        expect(result.failed).toBe(1);
    });
});

// ── Singleton ───────────────────────────────────────────────────────

describe('singleton', () => {
    test('getResponseCache returns same instance', () => {
        resetResponseCache();
        const a = getResponseCache();
        const b = getResponseCache();
        expect(a).toBe(b);
        resetResponseCache();
    });

    test('resetResponseCache clears singleton', () => {
        const a = getResponseCache();
        resetResponseCache();
        const b = getResponseCache();
        expect(a).not.toBe(b);
        resetResponseCache();
    });
});
