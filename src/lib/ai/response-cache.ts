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

import { redisGet, redisSet, redisDel } from '@/lib/upstash/client';

// ── Types ───────────────────────────────────────────────────────────

export interface CacheEntry {
    /** Normalised query key */
    query: string;
    /** Cached response text */
    response: string;
    /** Which model generated the response */
    model: 'groq' | 'gemini' | 'bedrock';
    /** When the entry was created (epoch ms) */
    timestamp: number;
    /** Number of cache hits */
    hitCount: number;
    /** Running average latency saved (ms) */
    avgLatency: number;
    /** Estimated size in bytes (query + response) */
    sizeBytes: number;
    /** Optional additional metadata */
    metadata?: Record<string, unknown>;
}

export interface CacheIdentity {
    modelId?: string;
    promptVersion?: string;
    ragContextHash?: string;
    languageCode?: string;
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

function buildIdentitySuffix(identity?: CacheIdentity): string {
    if (!identity) return '';

    const modelId = identity.modelId?.trim() || 'any';
    const promptVersion = identity.promptVersion?.trim() || 'none';
    const ragContextHash = identity.ragContextHash?.trim() || 'none';
    const languageCode = identity.languageCode?.trim().toLowerCase() || 'none';

    return `m=${modelId}|p=${promptVersion}|r=${ragContextHash}|l=${languageCode}`;
}

function buildScopedKey(query: string, identity?: CacheIdentity): string {
    const normalised = normaliseCacheKey(query);
    if (!normalised) return '';

    const suffix = buildIdentitySuffix(identity);
    return suffix ? `${normalised}::${suffix}` : normalised;
}

/** Estimate byte size of a string (rough: 2 bytes per char for JS strings). */
function estimateBytes(s: string): number {
    return s.length * 2;
}

// ── ResponseCache ───────────────────────────────────────────────────

export class ResponseCache {
    private totalHits = 0;
    private totalMisses = 0;
    private totalEntries = 0;
    private totalLatencySaved = 0;
    private readonly opts: Required<ResponseCacheOptions>;

    constructor(options: ResponseCacheOptions = {}) {
        this.opts = {
            ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
            fuzzyThreshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD,
            appVersion: options.appVersion ?? '1.0.0',
        };
    }

    // ── Read ────────────────────────────────────────────────────────

    /** Look up a cached response for the given query. */
    async get(query: string, identity?: CacheIdentity): Promise<CacheEntry | null> {
        const key = buildScopedKey(query, identity);
        if (!key) {
            this.totalMisses++;
            return null;
        }

        try {
            const redisValue = await redisGet(`${CACHE_KEY_PREFIX}${key}`);
            if (redisValue) {
                const entry = JSON.parse(
                    typeof redisValue === 'string' ? redisValue : JSON.stringify(redisValue)
                ) as CacheEntry;

                if (Date.now() - entry.timestamp < this.opts.ttlMs) {
                    this.totalHits++;
                    entry.hitCount = (entry.hitCount || 0) + 1;
                    this.totalLatencySaved += entry.avgLatency || 0;
                    // Update hit count in background
                    void redisSet(
                        `${CACHE_KEY_PREFIX}${key}`,
                        JSON.stringify(entry),
                        Math.floor(this.opts.ttlMs / 1000)
                    );
                    return entry;
                }

                void redisDel(`${CACHE_KEY_PREFIX}${key}`);
                void this.removeKeyFromIndex(key);
                this.totalEntries = Math.max(0, this.totalEntries - 1);
            }

            // Compatibility lookup for entries written before scoped identity keys.
            if (identity) {
                const legacyKey = normaliseCacheKey(query);
                if (legacyKey && legacyKey !== key) {
                    const legacyValue = await redisGet(`${CACHE_KEY_PREFIX}${legacyKey}`);
                    if (legacyValue) {
                        const entry = JSON.parse(
                            typeof legacyValue === 'string' ? legacyValue : JSON.stringify(legacyValue)
                        ) as CacheEntry;

                        if (Date.now() - entry.timestamp < this.opts.ttlMs) {
                            this.totalHits++;
                            return entry;
                        }
                    }
                }
            }
        } catch {
            // suppress
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
        modelOrMetadata?: 'groq' | 'gemini' | 'bedrock' | Record<string, unknown>,
        latencyMs = 0
    ): Promise<void> {
        const isLegacySignature = typeof modelOrMetadata === 'string';
        const metadata = (!isLegacySignature && modelOrMetadata) ? modelOrMetadata : undefined;
        const identity = (metadata?.identity as CacheIdentity | undefined);

        const key = buildScopedKey(query, identity);
        if (!key || !response) return;
        const sizeBytes = estimateBytes(key) + estimateBytes(response);

        const model = isLegacySignature
            ? modelOrMetadata
            : ((metadata?.model as 'groq' | 'gemini' | 'bedrock' | undefined) ?? 'groq');
        const avgLatency = isLegacySignature
            ? latencyMs
            : Number(metadata?.avgLatency ?? 0);

        const entry: CacheEntry = {
            query: key,
            response,
            model,
            timestamp: Date.now(),
            hitCount: 0,
            avgLatency,
            sizeBytes,
            metadata,
        };

        try {
            await redisSet(
                `${CACHE_KEY_PREFIX}${key}`,
                JSON.stringify(entry),
                Math.floor(this.opts.ttlMs / 1000)
            );
            await this.addKeyToIndex(key);
            this.totalEntries++;
        } catch { /* ignore set errors */ }
    }

    // ── Invalidation ────────────────────────────────────────────────

    /**
     * Invalidate cache entries matching a pattern.
     * Pattern is checked against the normalised key (substring match).
     */
    async invalidate(pattern: string): Promise<number> {
        const normalised = normaliseCacheKey(pattern);
        const keys = await this.getIndexedKeys();
        const keysToRemove = keys.filter((key) => key.includes(normalised));

        if (keysToRemove.length === 0) {
            return 0;
        }

        await Promise.all(keysToRemove.map((key) => redisDel(`${CACHE_KEY_PREFIX}${key}`)));
        const remaining = keys.filter((key) => !keysToRemove.includes(key));
        await this.persistIndex(remaining);
        this.totalEntries = Math.max(0, this.totalEntries - keysToRemove.length);

        return keysToRemove.length;
    }

    /** Clear the entire cache. */
    clear(): void {
        this.totalHits = 0;
        this.totalMisses = 0;
        this.totalEntries = 0;
        this.totalLatencySaved = 0;

        // Fire-and-forget async clear so the current sync API remains unchanged.
        void (async () => {
            const keys = await this.getIndexedKeys();
            await Promise.all([
                ...keys.map((key) => redisDel(`${CACHE_KEY_PREFIX}${key}`)),
                redisDel(CACHE_INDEX_KEY),
            ]);
        })();
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

        return {
            entries: this.totalEntries,
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            hitRate: total > 0 ? Math.round((this.totalHits / total) * 100) : 0,
            memorySizeBytes: 0,
            maxMemoryBytes: 0,
            avgLatencySaved: this.totalHits > 0
                ? Math.round(this.totalLatencySaved / this.totalHits)
                : 0,
            topQueries: [],
        };
    }

    /** Get current entry count. */
    get size(): number {
        return this.totalEntries;
    }

    // ── Internal ────────────────────────────────────────────────────

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
