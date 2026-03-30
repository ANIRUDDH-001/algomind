import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
    ResponseCache,
    normaliseCacheKey,
    getResponseCache,
    resetResponseCache,
} from '../response-cache';
import { redisGet, redisSet } from '@/lib/upstash/client';

// Mock Redis client
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
}));

describe('ResponseCache (Redis integrated)', () => {
    let cache: ResponseCache;
    let redisStore: Record<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Date.now mock if it was used
        vi.useRealTimers();
        redisStore = {};

        (redisSet as Mock).mockImplementation(async (key: string, value: string) => {
            redisStore[key] = value;
        });

        (redisGet as Mock).mockImplementation(async (key: string) => {
            return redisStore[key] ?? null;
        });

        cache = new ResponseCache({ ttlMs: 60_000 });
    });

    afterEach(() => {
        cache.clear();
        resetResponseCache();
    });

    describe('normaliseCacheKey', () => {
        it('lowercases and removes punctuation', () => {
            expect(normaliseCacheKey('What is an array?!')).toBe('what is an array');
            expect(normaliseCacheKey('  hello   world  ')).toBe('hello world');
        });
    });

    describe('Cache Hit & Miss', () => {
        it('returns cached value on hit', async () => {
            await cache.set('What is an array?', 'An array is...', 'groq', 150);

            const entry = await cache.get('What is an array?');
            expect(entry).not.toBeNull();
            expect(entry!.response).toBe('An array is...');
            expect(entry!.model).toBe('groq');
            expect(redisGet).toHaveBeenCalledTimes(2); // set(index read) + get(exact)
            expect(redisSet).toHaveBeenCalledTimes(3); // entry + index + hit count writeback
        });

        it('returns null on cache miss', async () => {
            const entry = await cache.get('nonexistent query');
            expect(entry).toBeNull();
            expect(redisGet).toHaveBeenCalledTimes(2); // exact lookup + key-index lookup
        });
    });

    describe('TTL Expiry', () => {
        it('evicts expired entries and returns null', async () => {
            // Mock Date.now to control time
            vi.useFakeTimers();
            const cacheWithShortTTL = new ResponseCache({ ttlMs: 5000 });

            await cacheWithShortTTL.set('hello', 'world', 'groq', 100);

            // Advance time past TTL (5000ms)
            vi.advanceTimersByTime(6000);

            const entry = await cacheWithShortTTL.get('hello');
            expect(entry).toBeNull();

            vi.useRealTimers();
        });
    });

    describe('Redis Fallback', () => {
        it('reads cached entries from Redis directly', async () => {
            const simulatedTimestamp = Date.now();

            // Setup Redis to return a valid cached entry
            const redisEntry = {
                query: 'what is redis',
                response: 'Redis is an in-memory datastore.',
                model: 'groq',
                timestamp: simulatedTimestamp,
                hitCount: 5,
                avgLatency: 120,
                sizeBytes: 150
            };
            redisStore['ai:cache:what is redis'] = JSON.stringify(redisEntry);
            redisStore['ai:cache:keys'] = JSON.stringify(['what is redis']);

            // Stats map starts empty in this instance
            expect(cache.size).toBe(0);

            // Fetch
            const entry = await cache.get('what is redis');

            expect(entry).not.toBeNull();
            expect(entry!.response).toBe('Redis is an in-memory datastore.');
            expect(redisGet).toHaveBeenCalledTimes(1);

            // Query stats should be tracked after hit
            expect(cache.size).toBe(1);
        });

        it('gracefully handles Redis unvailability (throws)', async () => {
            // Make Redis throw an error
            (redisGet as Mock).mockRejectedValue(new Error('Redis connection failed'));

            // Should not crash, just return null (miss)
            const entry = await cache.get('connection test');
            expect(entry).toBeNull();
        });

        it('handles invalid JSON from Redis gracefully', async () => {
            (redisGet as Mock).mockResolvedValue('invalid{json');
            const entry = await cache.get('json test');
            expect(entry).toBeNull();
        });
    });

    describe('Fuzzy Matching', () => {
        it('matches close keys from Redis index', async () => {
            await cache.set('binary search algorithm', 'Use divide and conquer.', 'groq', 140);

            const entry = await cache.get('binary searh algorithm');
            expect(entry).not.toBeNull();
            expect(entry!.response).toBe('Use divide and conquer.');
        });
    });

    describe('Stats', () => {
        it('returns accurately typed statistics', async () => {
            await cache.set('stat query', 'r1', 'groq', 200);
            await cache.get('stat query'); // hit

            (redisGet as Mock).mockResolvedValue(null);
            await cache.get('miss target variable'); // miss

            const stats = cache.getStats();
            expect(typeof stats.entries).toBe('number');
            expect(stats.entries).toBe(1);

            expect(typeof stats.totalHits).toBe('number');
            expect(stats.totalHits).toBe(1);

            expect(typeof stats.totalMisses).toBe('number');
            expect(stats.totalMisses).toBe(1);

            expect(typeof stats.hitRate).toBe('number');
            expect(stats.hitRate).toBe(50); // 1 hit, 1 miss = 50%

            expect(typeof stats.memorySizeBytes).toBe('number');
            expect(typeof stats.maxMemoryBytes).toBe('number');
            expect(typeof stats.avgLatencySaved).toBe('number');

            expect(Array.isArray(stats.topQueries)).toBe(true);
            expect(stats.topQueries.length).toBe(1);
            expect(stats.topQueries[0]).toHaveProperty('query', 'stat query');
            expect(stats.topQueries[0]).toHaveProperty('hitCount', 1);
            expect(stats.topQueries[0]).toHaveProperty('model', 'groq');
        });
    });

    describe('Pre-warming', () => {
        it('pre-warms the cache sequentially and caches results', async () => {
            const queries = ['warm up alpha phase', 'warm up beta phase'];

            const generator = vi.fn().mockImplementation(async (query: string) => {
                return { response: `response for ${query}`, model: 'groq', latencyMs: 50 };
            });

            // Mock to miss in redis initially
            (redisGet as Mock).mockImplementation(async (key: string) => redisStore[key] ?? null);

            const result = await cache.preWarm(queries, generator);

            expect(result.warmed).toBe(2);
            expect(result.failed).toBe(0);
            expect(generator).toHaveBeenCalledTimes(2);

            // Should exist in cache now
            const entry1 = await cache.get('warm up alpha phase');
            expect(entry1).not.toBeNull();
            expect(entry1!.response).toBe('response for warm up alpha phase');
        });
    });
});
