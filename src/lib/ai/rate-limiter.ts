// Intelligent Rate Limiter with Multi-Model Fallback
// Tracks usage across all models and selects best available

import { CHAT_MODELS, ModelConfig, ModelTier } from './providers';

interface UsageStats {
    minuteCount: number;
    dayCount: number;
    minuteResetTime: number;  // timestamp
    dayResetTime: number;     // timestamp
    lastError?: string;
    lastErrorTime?: number;
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
    private readonly ERROR_COOLDOWN_MS = 30 * 1000; // 30 second cooldown after error

    constructor() {
        // Initialize usage stats for all models
        const now = Date.now();
        for (const model of CHAT_MODELS) {
            this.usage.set(model.id, {
                minuteCount: 0,
                dayCount: 0,
                minuteResetTime: now + this.MINUTE_MS,
                dayResetTime: now + this.DAY_MS,
            });
        }
    }

    /**
     * Get the best available model based on current rate limits
     */
    async getAvailableModel(preferredTier?: ModelTier): Promise<RateLimitResult> {
        this.resetCountersIfNeeded();

        // Filter models by preferred tier if specified
        const candidates = preferredTier
            ? CHAT_MODELS.filter(m => m.tier >= preferredTier)
            : CHAT_MODELS;

        // Sort by tier (preference) 
        const sortedCandidates = [...candidates].sort((a, b) => a.tier - b.tier);

        for (const model of sortedCandidates) {
            if (this.isModelAvailable(model)) {
                return { allowed: true, model };
            }
        }

        // All models exhausted - calculate wait time
        const waitMs = this.getMinWaitTime();
        return {
            allowed: false,
            waitMs,
            reason: 'All models rate limited. Please wait.',
        };
    }

    /**
     * Check if a specific model is available
     */
    isModelAvailable(model: ModelConfig): boolean {
        const stats = this.usage.get(model.id);
        if (!stats) return false;

        // Check if model is in error cooldown
        if (stats.lastErrorTime && Date.now() - stats.lastErrorTime < this.ERROR_COOLDOWN_MS) {
            return false;
        }

        // Check rate limits
        return stats.minuteCount < model.rpm && stats.dayCount < model.rpd;
    }

    /**
     * Record a successful request
     */
    recordRequest(modelId: string): void {
        const stats = this.usage.get(modelId);
        if (stats) {
            stats.minuteCount++;
            stats.dayCount++;
        }
    }

    /**
     * Record an error (puts model in cooldown)
     */
    recordError(modelId: string, error: string): void {
        const stats = this.usage.get(modelId);
        if (stats) {
            stats.lastError = error;
            stats.lastErrorTime = Date.now();
        }
    }

    /**
     * Reset counters if time windows have passed
     */
    private resetCountersIfNeeded(): void {
        const now = Date.now();

        for (const [modelId, stats] of this.usage.entries()) {
            // Reset minute counter
            if (now >= stats.minuteResetTime) {
                stats.minuteCount = 0;
                stats.minuteResetTime = now + this.MINUTE_MS;
            }

            // Reset day counter
            if (now >= stats.dayResetTime) {
                stats.dayCount = 0;
                stats.dayResetTime = now + this.DAY_MS;
            }
        }
    }

    /**
     * Get minimum wait time until any model becomes available
     */
    private getMinWaitTime(): number {
        let minWait = Infinity;
        const now = Date.now();

        for (const [modelId, stats] of this.usage.entries()) {
            const model = CHAT_MODELS.find(m => m.id === modelId);
            if (!model) continue;

            // Check if minute reset would help
            if (stats.minuteCount >= model.rpm) {
                const waitForMinute = stats.minuteResetTime - now;
                minWait = Math.min(minWait, waitForMinute);
            }

            // Check error cooldown
            if (stats.lastErrorTime) {
                const waitForCooldown = (stats.lastErrorTime + this.ERROR_COOLDOWN_MS) - now;
                if (waitForCooldown > 0) {
                    minWait = Math.min(minWait, waitForCooldown);
                }
            }
        }

        return Math.max(0, minWait);
    }

    /**
     * Get current usage statistics
     */
    getUsageStats(): Record<string, { minute: number; day: number; available: boolean }> {
        const stats: Record<string, { minute: number; day: number; available: boolean }> = {};

        for (const model of CHAT_MODELS) {
            const usage = this.usage.get(model.id);
            if (usage) {
                stats[model.id] = {
                    minute: usage.minuteCount,
                    day: usage.dayCount,
                    available: this.isModelAvailable(model),
                };
            }
        }

        return stats;
    }

    /**
     * Get total remaining capacity across all models
     */
    getRemainingCapacity(): { minuteRemaining: number; dayRemaining: number } {
        let minuteRemaining = 0;
        let dayRemaining = 0;

        for (const model of CHAT_MODELS) {
            const usage = this.usage.get(model.id);
            if (usage) {
                minuteRemaining += Math.max(0, model.rpm - usage.minuteCount);
                dayRemaining += Math.max(0, model.rpd - usage.dayCount);
            }
        }

        return { minuteRemaining, dayRemaining };
    }
}

// Singleton instance
let rateLimiterInstance: IntelligentRateLimiter | null = null;

export function getRateLimiter(): IntelligentRateLimiter {
    if (!rateLimiterInstance) {
        rateLimiterInstance = new IntelligentRateLimiter();
    }
    return rateLimiterInstance;
}
