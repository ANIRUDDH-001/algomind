// Intelligent Rate Limiter
// Tracks RPM, RPD, TPM with safety margins and exponential backoff
import { CHAT_MODELS, ModelConfig, ModelTier } from './providers';

interface UsageStats {
    minuteCount: number;
    dayCount: number;
    tokensMinuteCount: number; // TPM tracking
    minuteResetTime: number;
    dayResetTime: number;

    // Failure tracking
    consecutiveFailures: number;
    isDeprecated: boolean;
    deprecationReason?: string;

    // Cooldown tracking
    cooldownLevel: number; // 0 to 4 (5, 10, 20, 40, 80 mins)
    cooldownEndTime: number; // Timestamp when cooldown expires
}

interface RateLimitResult {
    allowed: boolean;
    model?: ModelConfig;
    waitMs?: number;
    reason?: string;
}

export class IntelligentRateLimiter {
    private usage: Map<string, UsageStats> = new Map();
    private readonly MINUTE_MS = 60 * 1000;
    private readonly DAY_MS = 24 * 60 * 60 * 1000;

    // Cooldown tiers in milliseconds: 5m, 10m, 20m, 40m, 80m
    private readonly COOLDOWN_TIERS = [
        5 * 60 * 1000,
        10 * 60 * 1000,
        20 * 60 * 1000,
        40 * 60 * 1000,
        80 * 60 * 1000
    ];

    constructor() {
        this.initializeStats();
    }

    private initializeStats() {
        const now = Date.now();
        for (const model of CHAT_MODELS) {
            if (!this.usage.has(model.id)) {
                this.usage.set(model.id, {
                    minuteCount: 0,
                    dayCount: 0,
                    tokensMinuteCount: 0,
                    minuteResetTime: now + this.MINUTE_MS,
                    dayResetTime: now + this.DAY_MS,
                    consecutiveFailures: 0,
                    isDeprecated: false,
                    cooldownLevel: 0,
                    cooldownEndTime: 0
                });
            }
        }
    }

    /**
     * Check if a specific model can be used
     */
    canUseModel(modelId: string, estimatedTokens: number = 0): boolean {
        const stats = this.usage.get(modelId);
        if (!stats) return false;

        // 1. Check Deprecation
        if (stats.isDeprecated) return false;

        this.resetCountersIfNeeded(stats);

        // 2. Check Cooldown
        if (Date.now() < stats.cooldownEndTime) return false;

        // 3. Check Limits (RPM, RPD, TPM)
        const model = CHAT_MODELS.find(m => m.id === modelId);
        if (!model) return false;

        if (stats.minuteCount >= model.rpm) return false;
        if (stats.dayCount >= model.rpd) return false;
        if (model.tpm && stats.tokensMinuteCount + estimatedTokens > model.tpm) return false;

        return true;
    }

    /**
     * Get best available model, optionally filtering by tier
     */
    async getAvailableModel(preferredTier?: ModelTier): Promise<RateLimitResult> {
        // Ensure stats exist for all current models
        this.initializeStats();

        const candidates = preferredTier
            ? CHAT_MODELS.filter(m => m.tier >= preferredTier)
            : CHAT_MODELS;

        // Sort by tier (lower is better)
        const sortedModels = [...candidates].sort((a, b) => a.tier - b.tier);

        for (const model of sortedModels) {
            if (this.canUseModel(model.id)) {
                return { allowed: true, model };
            }
        }

        return {
            allowed: false,
            waitMs: this.getMinWaitTime(),
            reason: "All models rate limited, deprecated, or in cooldown."
        };
    }

    /**
     * Record a successful request
     */
    recordRequest(modelId: string, tokensUsed: number = 0): void {
        const stats = this.usage.get(modelId);
        if (!stats) return;

        stats.minuteCount++;
        stats.dayCount++;
        stats.tokensMinuteCount += tokensUsed;

        // Reset failure tracking on success
        if (stats.consecutiveFailures > 0) {
            stats.consecutiveFailures = 0;
        }

        // Reset cooldown level on success? 
        // Usually we slowly decrease it, but for simplicity, 
        // if we successfully use it, we might want to reset level to 0 
        // OR keep it high if it's unstable. 
        // Requirement: "Auto-reset after cooldown". 
        // Implies once cooldown is over, it's usable. 
        // If it succeeds, we should probably reset level to 0.
        stats.cooldownLevel = 0;
    }

    /**
     * Record a failure (updates cooldowns/deprecation)
     */
    recordFailure(modelId: string, error: any): void {
        const stats = this.usage.get(modelId);
        if (!stats) return;

        const errorMsg = String(error).toLowerCase();
        const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota');
        const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found');

        // 1. Deprecation Logic
        if (isNotFound) {
            this.deprecateModel(modelId, "404 Not Found");
            return;
        }

        stats.consecutiveFailures++;
        if (stats.consecutiveFailures >= 10) {
            this.deprecateModel(modelId, "10+ Consecutive Failures");
            return;
        }

        // 2. Cooldown Logic
        if (isRateLimit) {
            // Apply exponential backoff
            const cooldownMs = this.COOLDOWN_TIERS[Math.min(stats.cooldownLevel, this.COOLDOWN_TIERS.length - 1)];
            stats.cooldownEndTime = Date.now() + cooldownMs;

            // Increment level for next time
            stats.cooldownLevel = Math.min(stats.cooldownLevel + 1, this.COOLDOWN_TIERS.length - 1);
        }
    }

    // Alias for compatibility if needed, or intended helper
    recordError(modelId: string, error: any) {
        return this.recordFailure(modelId, error);
    }

    private deprecateModel(modelId: string, reason: string) {
        const stats = this.usage.get(modelId);
        if (stats) {
            stats.isDeprecated = true;
            stats.deprecationReason = reason;
            console.warn(`⚠️ Model ${modelId} deprecated: ${reason}`);
        }
    }

    /**
     * Manual reset for a model
     */
    resetModel(modelId: string): void {
        const stats = this.usage.get(modelId);
        if (stats) {
            stats.isDeprecated = false;
            stats.deprecationReason = undefined;
            stats.consecutiveFailures = 0;
            stats.cooldownLevel = 0;
            stats.cooldownEndTime = 0;
        }
    }

    /**
     * Get usage statistics for debugging/monitoring
     */
    getUsageStats() {
        const result: Record<string, any> = {};
        for (const [id, stats] of this.usage.entries()) {
            this.resetCountersIfNeeded(stats);
            result[id] = {
                rpm: `${stats.minuteCount}`,
                rpd: `${stats.dayCount}`,
                failures: stats.consecutiveFailures,
                deprecated: stats.isDeprecated,
                cooldown: stats.cooldownEndTime > Date.now() ? `${Math.ceil((stats.cooldownEndTime - Date.now()) / 1000)}s` : 'None'
            };
        }
        return result;
    }

    /**
     * Get all currently available models
     */
    getAvailableModels(): ModelConfig[] {
        return CHAT_MODELS.filter(m => this.canUseModel(m.id));
    }

    /**
     * Get remaining capacity (approximate)
     */
    getRemainingCapacity(): { minuteRemaining: number; dayRemaining: number } {
        let minuteRemaining = 0;
        let dayRemaining = 0;

        for (const model of CHAT_MODELS) {
            const stats = this.usage.get(model.id);
            if (stats && !stats.isDeprecated) {
                this.resetCountersIfNeeded(stats);
                minuteRemaining += Math.max(0, model.rpm - stats.minuteCount);
                dayRemaining += Math.max(0, model.rpd - stats.dayCount);
            } else if (!stats) {
                minuteRemaining += model.rpm;
                dayRemaining += model.rpd;
            }
        }

        return { minuteRemaining, dayRemaining };
    }

    /**
     * Internal helper to reset time-based counters
     */
    private resetCountersIfNeeded(stats: UsageStats) {
        const now = Date.now();

        if (now >= stats.minuteResetTime) {
            stats.minuteCount = 0;
            stats.tokensMinuteCount = 0;
            stats.minuteResetTime = now + this.MINUTE_MS;
        }

        if (now >= stats.dayResetTime) {
            stats.dayCount = 0;
            stats.dayResetTime = now + this.DAY_MS;
        }
    }

    private getMinWaitTime(): number {
        let minWait = Infinity;
        const now = Date.now();

        for (const stats of this.usage.values()) {
            if (stats.isDeprecated) continue;

            // Check cooldown wait
            if (stats.cooldownEndTime > now) {
                minWait = Math.min(minWait, stats.cooldownEndTime - now);
            }
        }
        return minWait === Infinity ? 5000 : minWait;
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
