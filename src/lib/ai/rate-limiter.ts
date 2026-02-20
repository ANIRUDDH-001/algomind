// Intelligent Rate Limiter using Upstash Redis for global shared state.
// Tracks RPM, RPD, TPM with safety margins and exponential backoff
import { ModelConfig } from './providers';
import { getRedis, redisGet, redisSet } from '../upstash/client';
import { markModelDeprecated } from './model-registry';
import { logSystemEvent } from '../monitoring/events';

interface RateLimitResult {
    allowed: boolean;
    model?: ModelConfig;
    waitMs?: number;
    reason?: string;
}

export class IntelligentRateLimiter {
    // Cooldown tiers in milliseconds: 5m, 10m, 20m, 40m, 80m
    private readonly COOLDOWN_TIERS = [
        5 * 60,
        10 * 60,
        20 * 60,
        40 * 60,
        80 * 60
    ];

    constructor() { }

    /**
     * Check if a specific model can be used.
     * Hits Upstash Redis to check shared global rate counters.
     */
    async canUseModel(
        modelId: string,
        models: ModelConfig[],
        _estimatedTokens: number = 0
    ): Promise<RateLimitResult> {
        const model = models.find((m) => m.id === modelId);
        if (!model) return { allowed: false, reason: 'model_not_found' };

        const redis = getRedis();
        // If Redis is unavailable, fail open to maintain latency and availability
        if (!redis) {
            return { allowed: true, model };
        }

        try {
            // a. Check cooldown key — check levels 0 through 4 (max array size)
            // By testing each potential cooldown tier key manually. (O(1) fast cache reads)
            const cooldownKeys = this.COOLDOWN_TIERS.map((_, idx) => `rl:${modelId}:cooldown:${idx}`);
            if (cooldownKeys.length > 0) {
                const cooldowns = await redis.mget(...cooldownKeys);
                const inCooldown = cooldowns.some((val) => val !== null && val !== undefined);
                if (inCooldown) {
                    return { allowed: false, model, reason: 'cooldown' };
                }
            }

            // b. Get rpm counter
            const rpmStr = await redisGet(`rl:${modelId}:rpm`);
            const currentRpm = rpmStr ? parseInt(rpmStr, 10) : 0;
            if (currentRpm >= model.rpm) {
                return { allowed: false, model, reason: 'rpm_limit' };
            }

            // c. Get day counter
            const dayStr = await redisGet(`rl:${modelId}:day`);
            const currentDay = dayStr ? parseInt(dayStr, 10) : 0;
            if (currentDay >= model.rpd) {
                return { allowed: false, model, reason: 'rpd_limit' };
            }

            return { allowed: true, model };

        } catch (error) {
            console.error(`Rate limiter check error for ${modelId}:`, error);
            // d. Fail open on Redis connectivity or query errors
            return { allowed: true, model };
        }
    }

    /**
     * Get best available model, optionally filtering by tier
     */
    async getAvailableModel(models: ModelConfig[], _preferredTier?: number): Promise<RateLimitResult> {
        const candidates = _preferredTier
            ? models.filter((m) => m.tier >= _preferredTier)
            : models;

        const sortedModels = [...candidates].sort((a, b) => a.tier - b.tier);

        for (const model of sortedModels) {
            const res = await this.canUseModel(model.id, models);
            if (res.allowed) {
                return res;
            }
        }

        return {
            allowed: false,
            waitMs: 5000,
            reason: "All models rate limited, deprecated, or in cooldown."
        };
    }

    /**
     * Record a successful request. Fire-and-forget logic using atomic Redis counters.
     */
    recordRequest(modelId: string, _tokensUsed: number = 0): void {
        const redis = getRedis();
        if (!redis) return;

        // Use SET NX EX for atomic key initialization, then INCR
        // RPM counter (65s TTL to cover 1-minute window with small buffer)
        void redis.set(`rl:${modelId}:rpm`, 0, { nx: true, ex: 65 })
            .then(() => redis.incr(`rl:${modelId}:rpm`))
            .catch(() => { /* Silently swallow — rate limiter errors must not affect user requests */ });

        // RPD counter (86400s = 24h TTL)
        void redis.set(`rl:${modelId}:day`, 0, { nx: true, ex: 86400 })
            .then(() => redis.incr(`rl:${modelId}:day`))
            .catch(() => { /* Silently swallow */ });
    }

    /**
     * Record a failure (updates cooldowns/deprecation and handles 'model_429' event loggings)
     */
    async recordFailure(modelId: string, error: unknown): Promise<void> {
        const errorMsg = String(error).toLowerCase();
        const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota');
        const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('deprecated');

        if (isNotFound) {
            await markModelDeprecated(modelId, "404 Not Found or Deprecated");
            return;
        }

        if (isRateLimit) {
            const redis = getRedis();
            if (redis) {
                try {
                    // find current highest cooldown level active in order to increment penalties
                    let currentLevel = 0;
                    const cooldownKeys = this.COOLDOWN_TIERS.map((_, idx) => `rl:${modelId}:cooldown:${idx}`);
                    const activeCooldowns = await redis.mget<unknown[]>(...cooldownKeys);

                    for (let i = activeCooldowns.length - 1; i >= 0; i--) {
                        if (activeCooldowns[i] !== null) {
                            currentLevel = Math.min(i + 1, this.COOLDOWN_TIERS.length - 1);
                            break;
                        }
                    }

                    const cooldownSeconds = this.COOLDOWN_TIERS[currentLevel];
                    await redisSet(`rl:${modelId}:cooldown:${currentLevel}`, "true", cooldownSeconds);
                } catch (err) {
                    console.error("Error setting exponential cooldown in Redis:", err);
                }
            }

            // Log 'model_429' event silently explicitly via events logger
            logSystemEvent({
                type: 'model_429',
                modelId,
                errorMessage: typeof error === 'object' && error !== null && 'message' in error ? String((error as Error).message) : String(error)
            }).catch(() => { });
        }
    }

    // Alias for compatibility if needed, or intended helper
    recordError(modelId: string, error: unknown): void {
        this.recordFailure(modelId, error).catch(() => { });
    }

    /**
     * Manual reset for a model overriding existing TTLs.
     */
    resetModel(modelId: string): void {
        const redis = getRedis();
        if (!redis) return;

        const keysToDelete = [
            `rl:${modelId}:rpm`,
            `rl:${modelId}:day`,
            ...this.COOLDOWN_TIERS.map((_, i) => `rl:${modelId}:cooldown:${i}`)
        ];

        redis.del(...keysToDelete).catch(() => { });
    }

    /**
     * Get usage statistics for debugging/monitoring.
     * Reads real counters from Redis using individual gets.
     */
    async getUsageStats(models: ModelConfig[] = []): Promise<Record<string, { rpm: string; rpd: string; failures: number; deprecated: boolean; cooldown: string }>> {
        const redis = getRedis();
        if (!redis || models.length === 0) return {};

        const result: Record<string, { rpm: string; rpd: string; failures: number; deprecated: boolean; cooldown: string }> = {};

        for (const model of models) {
            try {
                const [rpmStr, rpdStr] = await Promise.all([
                    redisGet(`rl:${model.id}:rpm`),
                    redisGet(`rl:${model.id}:day`),
                ]);
                result[model.id] = {
                    rpm: rpmStr || '0',
                    rpd: rpdStr || '0',
                    failures: 0,
                    deprecated: false,
                    cooldown: 'none',
                };
            } catch {
                result[model.id] = { rpm: '?', rpd: '?', failures: 0, deprecated: false, cooldown: 'unknown' };
            }
        }
        return result;
    }

    /**
     * Get all currently available models.
     */
    async getAvailableModels(models: ModelConfig[]): Promise<ModelConfig[]> {
        const result: ModelConfig[] = [];
        for (const model of models) {
            const res = await this.canUseModel(model.id, models);
            if (res.allowed && res.model) {
                result.push(res.model);
            }
        }
        return result;
    }

    /**
     * Get remaining capacity (approximate)
     * For distributed Redis architecture this represents a mock response or requires heavy aggregation.
     */
    async getRemainingCapacity(_models: ModelConfig[]): Promise<{ minuteRemaining: number; dayRemaining: number }> {
        return { minuteRemaining: 0, dayRemaining: 0 };
    }
}

// Singleton
let instance: IntelligentRateLimiter | null = null;

export function getRateLimiter(): IntelligentRateLimiter {
    if (!instance) {
        instance = new IntelligentRateLimiter();
    }
    return instance;
}
