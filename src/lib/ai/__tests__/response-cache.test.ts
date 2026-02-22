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

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Date.now mock if it was used
        vi.useRealTimers();
        cache = new ResponseCache({ maxEntries: 10, ttlMs: 60_000, maxMemoryBytes: 1024 * 1024 });
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

            // Should be in memory, so redisGet doesn't even need to be called
            const entry = await cache.get('What is an array?');
            expect(entry).not.toBeNull();
            expect(entry!.response).toBe('An array is...');
            expect(entry!.model).toBe('groq');
            expect(redisSet).toHaveBeenCalledTimes(1);
        });

        it('returns null on cache miss', async () => {
            // Mock Redis to return null for the miss
            (redisGet as Mock).mockResolvedValue(null);

            const entry = await cache.get('nonexistent query');
            expect(entry).toBeNull();
            expect(redisGet).toHaveBeenCalledTimes(1);
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

            // Redis also needs to return null or expired data to fully test eviction
            (redisGet as Mock).mockResolvedValue(null);

            const entry = await cacheWithShortTTL.get('hello');
            expect(entry).toBeNull();

            vi.useRealTimers();
        });
    });

    describe('Redis Fallback', () => {
        it('hydrates in-memory cache from Redis if missing locally', async () => {
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
            (redisGet as Mock).mockResolvedValue(JSON.stringify(redisEntry));

            // Cache is empty in memory
            expect(cache.size).toBe(0);

            // Fetch
            const entry = await cache.get('what is redis');

            expect(entry).not.toBeNull();
            expect(entry!.response).toBe('Redis is an in-memory datastore.');
            expect(redisGet).toHaveBeenCalledTimes(1);

            // It should now be warmed in memory
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

    describe('LRU Eviction', () => {
        it('evicts least used entry when maxEntries is reached', async () => {
            const smallCache = new ResponseCache({ maxEntries: 3 });

            await smallCache.set('query apple', 'r1', 'groq', 100);
            await smallCache.set('query banana', 'r2', 'groq', 100);
            await smallCache.set('query cherry', 'r3', 'groq', 100);

            // Hit banana and cherry so they have higher hit counts
            await smallCache.get('query banana');
            await smallCache.get('query cherry');

            // Add date. Since apple has the lowest hit count (0), it should be evicted.
            await smallCache.set('query date', 'r4', 'gemini', 150);

            // apple is evicted from memory. (Mock Redis to return null so we know it's gone)
            (redisGet as Mock).mockResolvedValue(null);

            expect(await smallCache.get('query apple')).toBeNull();
            expect(await smallCache.get('query banana')).not.toBeNull();
            expect(await smallCache.get('query date')).not.toBeNull();
        });
    });

    describe('Memory Bounds', () => {
        it('evicts entries when memory limit is reached', async () => {
            // Tiny memory limit (100 bytes)
            const memCache = new ResponseCache({ maxMemoryBytes: 100 });

            await memCache.set('a', 'short', 'groq', 100); // approx 14 bytes

            // Add a massive entry that blows the limit
            const hugeResponse = 'x'.repeat(200);
            await memCache.set('b', hugeResponse, 'groq', 100); // 400+ bytes

            // Memory should never exceed bounds. EITHER it evicts everything, OR it refuses to cache 'b'
            expect(memCache.size).toBeLessThanOrEqual(1);

            const stats = memCache.getStats();
            expect(stats.memorySizeBytes).toBeLessThanOrEqual(100);
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
            (redisGet as Mock).mockResolvedValue(null);

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
