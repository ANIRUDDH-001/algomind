/**
 * ResponseCache — in-memory cache for AI responses to common queries.
 *
 * Features:
 *   - Fuzzy matching via Levenshtein distance (reuses intent-classifier util)
 *   - TTL-based expiry (24h for technical content)
 *   - LRU eviction (keeps top 100 entries by hit count)
 *   - Size cap (~10MB estimated)
 *   - Pre-warming with common interview questions
 *
 * Gated by ENABLE_RESPONSE_CACHE feature flag.
 *
 * @module response-cache
 */

import { levenshtein } from './intent-classifier';

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
    /** Max number of entries. Default: 100 */
    maxEntries?: number;
    /** Max total memory in bytes. Default: 10MB */
    maxMemoryBytes?: number;
    /** TTL in milliseconds. Default: 24 * 60 * 60 * 1000 (24h) */
    ttlMs?: number;
    /** Levenshtein distance threshold for fuzzy matching. Default: 2 */
    fuzzyThreshold?: number;
    /** App version — cache is cleared when version changes */
    appVersion?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_MEMORY = 10 * 1024 * 1024; // 10MB
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
const DEFAULT_FUZZY_THRESHOLD = 2;

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
    private cache = new Map<string, CacheEntry>();
    private totalHits = 0;
    private totalMisses = 0;
    private readonly opts: Required<ResponseCacheOptions>;
    private currentMemory = 0;

    constructor(options: ResponseCacheOptions = {}) {
        this.opts = {
            maxEntries: options.maxEntries ?? DEFAULT_MAX_ENTRIES,
            maxMemoryBytes: options.maxMemoryBytes ?? DEFAULT_MAX_MEMORY,
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
    get(query: string): CacheEntry | null {
        const key = normaliseCacheKey(query);
        if (!key) {
            this.totalMisses++;
            return null;
        }

        // 1. Exact match
        const exact = this.cache.get(key);
        if (exact) {
            if (this.isExpired(exact)) {
                this.cache.delete(key);
                this.currentMemory -= exact.sizeBytes;
                this.totalMisses++;
                return null;
            }
            exact.hitCount++;
            this.totalHits++;
            return exact;
        }

        // 2. Fuzzy match
        if (key.length <= 100) { // perf guard
            let bestKey: string | null = null;
            let bestDist = Infinity;

            for (const [k, entry] of this.cache.entries()) {
                if (Math.abs(k.length - key.length) > this.opts.fuzzyThreshold) continue;
                if (this.isExpired(entry)) continue;

                const dist = levenshtein(key, k);
                if (dist <= this.opts.fuzzyThreshold && dist < bestDist) {
                    bestDist = dist;
                    bestKey = k;
                }
            }

            if (bestKey) {
                const entry = this.cache.get(bestKey)!;
                entry.hitCount++;
                this.totalHits++;
                return entry;
            }
        }

        this.totalMisses++;
        return null;
    }

    // ── Write ───────────────────────────────────────────────────────

    /**
     * Cache a response for a query.
     * Handles LRU eviction and memory limits.
     */
    set(
        query: string,
        response: string,
        model: 'groq' | 'gemini',
        latencyMs = 0
    ): void {
        const key = normaliseCacheKey(query);
        if (!key || !response) return;

        const sizeBytes = estimateBytes(key) + estimateBytes(response);

        // Don't cache if single entry exceeds memory limit
        if (sizeBytes > this.opts.maxMemoryBytes) return;

        // Evict if at entry limit
        while (this.cache.size >= this.opts.maxEntries) {
            this.evictLRU();
        }

        // Evict if at memory limit
        while (this.currentMemory + sizeBytes > this.opts.maxMemoryBytes && this.cache.size > 0) {
            this.evictLRU();
        }

        // Update or insert
        const existing = this.cache.get(key);
        if (existing) {
            this.currentMemory -= existing.sizeBytes;
        }

        const entry: CacheEntry = {
            query: key,
            response,
            model,
            timestamp: Date.now(),
            hitCount: existing?.hitCount ?? 0,
            avgLatency: existing
                ? (existing.avgLatency * existing.hitCount + latencyMs) / (existing.hitCount + 1)
                : latencyMs,
            sizeBytes,
        };

        this.cache.set(key, entry);
        this.currentMemory += sizeBytes;
    }

    // ── Invalidation ────────────────────────────────────────────────

    /**
     * Invalidate cache entries matching a pattern.
     * Pattern is checked against the normalised key (substring match).
     */
    invalidate(pattern: string): number {
        const normalised = normaliseCacheKey(pattern);
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (key.includes(normalised)) {
                this.currentMemory -= entry.sizeBytes;
                this.cache.delete(key);
                removed++;
            }
        }

        return removed;
    }

    /** Clear the entire cache. */
    clear(): void {
        this.cache.clear();
        this.currentMemory = 0;
        this.totalHits = 0;
        this.totalMisses = 0;
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
            const existing = this.get(query);
            if (existing) {
                warmed++;
                continue;
            }

            try {
                const result = await generator(query);
                this.set(query, result.response, result.model, result.latencyMs);
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
        const entries = [...this.cache.values()];

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
            entries: this.cache.size,
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            hitRate: total > 0 ? Math.round((this.totalHits / total) * 100) : 0,
            memorySizeBytes: this.currentMemory,
            maxMemoryBytes: this.opts.maxMemoryBytes,
            avgLatencySaved: this.totalHits > 0
                ? Math.round(totalLatencySaved / this.totalHits)
                : 0,
            topQueries,
        };
    }

    /** Get current entry count. */
    get size(): number {
        return this.cache.size;
    }

    // ── Internal ────────────────────────────────────────────────────

    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > this.opts.ttlMs;
    }

    /**
     * Evict the entry with the lowest hit count (LRU by usage).
     * On ties, evict the oldest entry.
     */
    private evictLRU(): void {
        let worstKey: string | null = null;
        let worstHits = Infinity;
        let worstTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (
                entry.hitCount < worstHits ||
                (entry.hitCount === worstHits && entry.timestamp < worstTime)
            ) {
                worstKey = key;
                worstHits = entry.hitCount;
                worstTime = entry.timestamp;
            }
        }

        if (worstKey) {
            const entry = this.cache.get(worstKey)!;
            this.currentMemory -= entry.sizeBytes;
            this.cache.delete(worstKey);
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
