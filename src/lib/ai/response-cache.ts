/**
 * ResponseCache — Redis-backed cache for AI responses to common queries.
 *
 * Features:
 *   - Fuzzy matching via Levenshtein distance
 *   - TTL-based expiry (24h default)
 *   - Cross-request persistence via Redis
 *   - Pre-warming with common interview questions
 *
 * Gated by ENABLE_RESPONSE_CACHE feature flag.
 *
 * @module response-cache
 */

import { levenshtein } from './intent-classifier';
import { redisGet, redisSet, redisDel } from '@/lib/upstash/client';

// ── Types ───────────────────────────────────────────────────────────

export interface CacheEntry {
    /** Normalised query key */
    query: string;
    /** Cached response text */
    response: string;
    /** Which model generated the response */
    model: 'groq' | 'gemini';
    /** When the entry was created (epoch ms) */
    timestamp: number;
    /** Number of cache hits */
    hitCount: number;
    /** Running average latency saved (ms) */
    avgLatency: number;
    /** Estimated size in bytes (query + response) */
    sizeBytes: number;
}

export interface CacheStats {
    /** Total entries in cache */
    entries: number;
    /** Total cache hits since creation */
    totalHits: number;
    /** Total cache misses since creation */
    totalMisses: number;
    /** Hit rate as percentage */
    hitRate: number;
    /** Estimated memory usage in bytes */
    memorySizeBytes: number;
    /** Max memory allowed */
    maxMemoryBytes: number;
    /** Average latency saved per hit (ms) */
    avgLatencySaved: number;
    /** Top 10 most-hit queries */
    topQueries: Array<{ query: string; hitCount: number; model: string }>;
}

export interface ResponseCacheOptions {
    /** TTL in milliseconds. Default: 24 * 60 * 60 * 1000 (24h) */
    ttlMs?: number;
    /** Levenshtein distance threshold for fuzzy matching. Default: 2 */
    fuzzyThreshold?: number;
    /** App version — cache is cleared when version changes */
    appVersion?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
const DEFAULT_FUZZY_THRESHOLD = 2;
const LEGACY_MAX_MEMORY_PLACEHOLDER = 10 * 1024 * 1024;
const CACHE_KEY_PREFIX = 'ai:cache:';
const CACHE_INDEX_KEY = 'ai:cache:keys';

// ── Helpers ─────────────────────────────────────────────────────────

/** Normalise a query for cache key generation. */
export function normaliseCacheKey(query: string): string {
    return query
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // remove punctuation
        .replace(/\s+/g, ' ');   // collapse whitespace
}

/** Estimate byte size of a string (rough: 2 bytes per char for JS strings). */
function estimateBytes(s: string): number {
    return s.length * 2;
}

// ── ResponseCache ───────────────────────────────────────────────────

export class ResponseCache {
    private queryStats = new Map<string, { hitCount: number; model: 'groq' | 'gemini'; avgLatency: number }>();
    private totalHits = 0;
    private totalMisses = 0;
    private readonly opts: Required<ResponseCacheOptions>;

    constructor(options: ResponseCacheOptions = {}) {
        this.opts = {
            ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
            fuzzyThreshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD,
            appVersion: options.appVersion ?? '1.0.0',
        };
    }

    // ── Read ────────────────────────────────────────────────────────

    /**
     * Look up a cached response for the given query.
     * Checks exact match first, then fuzzy match within threshold.
     * Returns null on miss.
     */
    async get(query: string): Promise<CacheEntry | null> {
        const key = normaliseCacheKey(query);
        if (!key) {
            this.totalMisses++;
            return null;
        }

        // 1. Exact match (Redis)
        const exact = await this.readEntryFromRedis(key);
        if (exact) {
            return this.registerHitAndPersist(key, exact);
        }

        // 2. Fuzzy match (Redis key index)
        if (key.length <= 100) { // perf guard
            let bestKey: string | null = null;
            let bestDist = Infinity;
            const indexedKeys = await this.getIndexedKeys();

            for (const indexedKey of indexedKeys) {
                if (indexedKey === key) continue;
                if (Math.abs(indexedKey.length - key.length) > this.opts.fuzzyThreshold) continue;

                const dist = levenshtein(key, indexedKey);
                if (dist <= this.opts.fuzzyThreshold && dist < bestDist) {
                    bestDist = dist;
                    bestKey = indexedKey;
                }
            }

            if (bestKey) {
                const fuzzyEntry = await this.readEntryFromRedis(bestKey);
                if (fuzzyEntry) {
                    return this.registerHitAndPersist(bestKey, fuzzyEntry);
                }
            }
        }

        this.totalMisses++;
        return null;
    }

    // ── Write ───────────────────────────────────────────────────────

    /**
    * Cache a response for a query in Redis.
     */
    async set(
        query: string,
        response: string,
        model: 'groq' | 'gemini',
        latencyMs = 0
    ): Promise<void> {
        const key = normaliseCacheKey(query);
        if (!key || !response) return;
        const existingStats = this.queryStats.get(key);
        const sizeBytes = estimateBytes(key) + estimateBytes(response);

        const entry: CacheEntry = {
            query: key,
            response,
            model,
            timestamp: Date.now(),
            hitCount: existingStats?.hitCount ?? 0,
            avgLatency: existingStats
                ? (existingStats.avgLatency * existingStats.hitCount + latencyMs) / (existingStats.hitCount + 1)
                : latencyMs,
            sizeBytes,
        };

        this.queryStats.set(key, {
            hitCount: existingStats?.hitCount ?? 0,
            model,
            avgLatency: entry.avgLatency,
        });

        try {
            await redisSet(
                `${CACHE_KEY_PREFIX}${key}`,
                JSON.stringify(entry),
                Math.floor(this.opts.ttlMs / 1000)
            );
            await this.addKeyToIndex(key);
        } catch { /* ignore set errors */ }
    }

    // ── Invalidation ────────────────────────────────────────────────

    /**
     * Invalidate cache entries matching a pattern.
     * Pattern is checked against the normalised key (substring match).
     */
    invalidate(pattern: string): number {
        const normalised = normaliseCacheKey(pattern);
        let removed = 0;

        for (const [key] of this.queryStats.entries()) {
            if (key.includes(normalised)) {
                this.queryStats.delete(key);
                void redisDel(`${CACHE_KEY_PREFIX}${key}`);
                removed++;
            }
        }

        if (removed > 0) {
            void this.persistIndex([...this.queryStats.keys()]);
        }

        return removed;
    }

    /** Clear the entire cache. */
    clear(): void {
        const keysToDelete = [...this.queryStats.keys()];
        this.queryStats.clear();
        this.totalHits = 0;
        this.totalMisses = 0;

        // Fire-and-forget async clear so the current sync API remains unchanged.
        void Promise.all([
            ...keysToDelete.map((key) => redisDel(`${CACHE_KEY_PREFIX}${key}`)),
            redisDel(CACHE_INDEX_KEY),
        ]);
    }

    // ── Pre-warming ─────────────────────────────────────────────────

    /**
     * Pre-warm the cache by running common queries through a generator function.
     * The generator should produce AI responses for each query.
     */
    async preWarm(
        queries: string[],
        generator: (query: string) => Promise<{ response: string; model: 'groq' | 'gemini'; latencyMs: number }>
    ): Promise<{ warmed: number; failed: number }> {
        let warmed = 0;
        let failed = 0;

        for (const query of queries) {
            // Skip if already cached and valid
            const existing = await this.get(query);
            if (existing) {
                warmed++;
                continue;
            }

            try {
                const result = await generator(query);
                await this.set(query, result.response, result.model, result.latencyMs);
                warmed++;
            } catch (err) {
                console.warn(`[ResponseCache] Pre-warm failed for: "${query.slice(0, 50)}"`, err);
                failed++;
            }
        }

        return { warmed, failed };
    }

    // ── Stats ───────────────────────────────────────────────────────

    getStats(): CacheStats {
        const total = this.totalHits + this.totalMisses;
        const entries = [...this.queryStats.entries()].map(([query, info]) => ({
            query,
            hitCount: info.hitCount,
            model: info.model,
            avgLatency: info.avgLatency,
        }));

        // Top queries by hit count
        const topQueries = entries
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, 10)
            .map(e => ({ query: e.query, hitCount: e.hitCount, model: e.model }));

        const totalLatencySaved = entries.reduce(
            (sum, e) => sum + e.avgLatency * e.hitCount,
            0
        );

        return {
            entries: this.queryStats.size,
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            hitRate: total > 0 ? Math.round((this.totalHits / total) * 100) : 0,
            memorySizeBytes: 0,
            maxMemoryBytes: LEGACY_MAX_MEMORY_PLACEHOLDER,
            avgLatencySaved: this.totalHits > 0
                ? Math.round(totalLatencySaved / this.totalHits)
                : 0,
            topQueries,
        };
    }

    /** Get current entry count. */
    get size(): number {
        return this.queryStats.size;
    }

    // ── Internal ────────────────────────────────────────────────────

    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > this.opts.ttlMs;
    }

    private async readEntryFromRedis(key: string): Promise<CacheEntry | null> {
        let redisValue: string | null = null;
        try {
            redisValue = await redisGet(`${CACHE_KEY_PREFIX}${key}`);
        } catch {
            redisValue = null;
        }

        if (!redisValue) return null;

        try {
            const entry = JSON.parse(redisValue) as CacheEntry;
            if (this.isExpired(entry)) {
                void redisDel(`${CACHE_KEY_PREFIX}${key}`);
                void this.removeKeyFromIndex(key);
                return null;
            }
            return entry;
        } catch {
            return null;
        }
    }

    private registerHitAndPersist(key: string, entry: CacheEntry): CacheEntry {
        entry.hitCount++;
        this.totalHits++;

        const existing = this.queryStats.get(key);
        this.queryStats.set(key, {
            hitCount: entry.hitCount,
            model: entry.model,
            avgLatency: existing?.avgLatency ?? entry.avgLatency,
        });

        void redisSet(
            `${CACHE_KEY_PREFIX}${key}`,
            JSON.stringify(entry),
            Math.floor(this.opts.ttlMs / 1000)
        );

        return entry;
    }

    private async getIndexedKeys(): Promise<string[]> {
        let raw: string | null = null;
        try {
            raw = await redisGet(CACHE_INDEX_KEY);
        } catch {
            raw = null;
        }

        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((item): item is string => typeof item === 'string');
        } catch {
            return [];
        }
    }

    private async addKeyToIndex(key: string): Promise<void> {
        const keys = await this.getIndexedKeys();
        if (!keys.includes(key)) {
            keys.push(key);
            await this.persistIndex(keys);
        }
    }

    private async removeKeyFromIndex(key: string): Promise<void> {
        const keys = await this.getIndexedKeys();
        const next = keys.filter((k) => k !== key);
        await this.persistIndex(next);
    }

    private async persistIndex(keys: string[]): Promise<void> {
        try {
            await redisSet(CACHE_INDEX_KEY, JSON.stringify(keys), Math.floor(this.opts.ttlMs / 1000));
        } catch {
            // ignore index persistence failures
        }
    }
}

// ── Singleton ───────────────────────────────────────────────────────

let instance: ResponseCache | null = null;

export function getResponseCache(options?: ResponseCacheOptions): ResponseCache {
    if (!instance) {
        instance = new ResponseCache(options);
    }
    return instance;
}

export function resetResponseCache(): void {
    instance = null;
}
