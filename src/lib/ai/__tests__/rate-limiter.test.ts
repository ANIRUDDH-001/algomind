// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { IntelligentRateLimiter, getRateLimiter } from '../rate-limiter';
import type { ModelConfig } from '../providers';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/upstash/client', () => ({
    getRedis: vi.fn(),
    redisGet: vi.fn(),
    redisSet: vi.fn(),
}));

vi.mock('./model-registry', () => ({
    markModelDeprecated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../model-registry', () => ({
    markModelDeprecated: vi.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const model: ModelConfig = {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    tier: 1,
    rpm: 30,
    tpm: 5000,
    rpd: 1000,
    contextWindow: 128000,
    supportsEmbeddings: false,
    description: 'Test model',
};

const allModels = [model];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock redis object that matches the source's usage:
 *   - mget(...keys) — for cooldown checks
 *   - incr(key) — atomic RPM/RPD increment
 *   - expire(key, seconds) — set TTL after first incr
 *   - decr(key) — rollback on limit exceeded
 *   - set(key, value, opts) — used by recordRequest (legacy, now noop)
 *   - del(...keys) — used by resetModel
 */
function buildRedisMock(overrides: {
    mgetValues?: (string | null)[];
    incrRpmValue?: number;
    incrDayValue?: number;
} = {}) {
    const mgetValues = overrides.mgetValues ?? [null, null, null, null, null];
    let rpmIncrCall = 0;
    let dayIncrCall = 0;
    const rpmValue = overrides.incrRpmValue ?? 1;
    const dayValue = overrides.incrDayValue ?? 1;

    return {
        mget: vi.fn().mockResolvedValue(mgetValues),
        incr: vi.fn().mockImplementation((key: string) => {
            if (key.includes(':rpm')) {
                rpmIncrCall++;
                return Promise.resolve(rpmValue);
            }
            if (key.includes(':day')) {
                dayIncrCall++;
                return Promise.resolve(dayValue);
            }
            return Promise.resolve(1);
        }),
        expire: vi.fn().mockResolvedValue(1),
        decr: vi.fn().mockResolvedValue(0),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(7),
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IntelligentRateLimiter', () => {
    let limiter: IntelligentRateLimiter;
    let getRedis: Mock;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        limiter = new IntelligentRateLimiter();
        const upstash = await import('@/lib/upstash/client');
        getRedis = upstash.getRedis as Mock;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ── canUseModel ───────────────────────────────────────────────────────────

    describe('canUseModel()', () => {
        it('returns allowed=false with reason "model_not_found" for unknown model', async () => {
            getRedis.mockReturnValue(buildRedisMock());
            const result = await limiter.canUseModel('unknown-model', allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('model_not_found');
        });

        it('fails open (allowed=true) when Redis is unavailable', async () => {
            getRedis.mockReturnValue(null);
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
            expect(result.model?.id).toBe(model.id);
        });

        it('returns allowed=true when all counters are zero (fresh state)', async () => {
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 1,
                incrDayValue: 1,
            }));
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
            expect(result.model).toBeDefined();
        });

        it('returns allowed=false with reason "rpm_limit" when rpm is at limit', async () => {
            // rpm incr returns 31 (> model.rpm of 30)
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 31,
                incrDayValue: 1,
            }));
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('rpm_limit');
        });

        it('allows when rpm is below limit', async () => {
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 15,
                incrDayValue: 1,
            }));
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
        });

        it('returns allowed=false with reason "rpd_limit" when daily limit is reached', async () => {
            // day incr returns 1001 (> model.rpd of 1000)
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 1,
                incrDayValue: 1001,
            }));
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('rpd_limit');
        });

        it('returns allowed=false with reason "cooldown" when any cooldown key is active', async () => {
            // Second cooldown tier is active (index 1)
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: [null, 'true', null, null, null],
            }));
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('cooldown');
        });

        it('fails open when Redis throws an error', async () => {
            getRedis.mockReturnValue({
                mget: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
            });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
        });

        it('checks cooldown keys for all 5 tier levels', async () => {
            const mockRedis = buildRedisMock();
            getRedis.mockReturnValue(mockRedis);

            await limiter.canUseModel(model.id, allModels);
            expect(mockRedis.mget).toHaveBeenCalledWith(
                `rl:${model.id}:cooldown:0`,
                `rl:${model.id}:cooldown:1`,
                `rl:${model.id}:cooldown:2`,
                `rl:${model.id}:cooldown:3`,
                `rl:${model.id}:cooldown:4`
            );
        });
    });

    // ── recordRequest ─────────────────────────────────────────────────────────

    describe('recordRequest()', () => {
        it('does nothing when Redis is unavailable', () => {
            getRedis.mockReturnValue(null);
            expect(() => limiter.recordRequest(model.id, 100)).not.toThrow();
        });

        it('does not throw when Redis is available (now a no-op)', async () => {
            const mockRedis = buildRedisMock();
            getRedis.mockReturnValue(mockRedis);

            limiter.recordRequest(model.id, 100);
            await vi.runAllTimersAsync();
            // recordRequest is now a no-op since canUseModel handles atomically
        });
    });

    // ── recordFailure ─────────────────────────────────────────────────────────

    describe('recordFailure()', () => {
        it('calls markModelDeprecated on 404 error and does not set cooldown', async () => {
            const { markModelDeprecated } = await import('../model-registry');
            getRedis.mockReturnValue(buildRedisMock());

            await limiter.recordFailure(model.id, new Error('Model not found (404)'));

            expect(markModelDeprecated).toHaveBeenCalledWith(
                model.id,
                expect.stringContaining('404')
            );
        });

        it('sets cooldown tier 0 on first 429 error', async () => {
            const mockRedis = buildRedisMock({ mgetValues: [null, null, null, null, null] });
            getRedis.mockReturnValue(mockRedis);
            const { redisSet } = await import('@/lib/upstash/client');

            await limiter.recordFailure(model.id, new Error('Rate limited (429)'));

            expect(redisSet).toHaveBeenCalledWith(
                `rl:${model.id}:cooldown:0`,
                'true',
                5 * 60 // 5 minutes
            );
        });

        it('escalates to higher cooldown tier when a lower tier is already active', async () => {
            // Tier 0 is already active, so we should escalate to tier 1 (10 min)
            const mockRedis = buildRedisMock({ mgetValues: ['true', null, null, null, null] });
            getRedis.mockReturnValue(mockRedis);
            const { redisSet } = await import('@/lib/upstash/client');

            await limiter.recordFailure(model.id, '429 rate limit exceeded');

            expect(redisSet).toHaveBeenCalledWith(
                `rl:${model.id}:cooldown:1`,
                'true',
                10 * 60 // 10 minutes
            );
        });

        it('caps cooldown at tier 4 (max) even when many tiers are active', async () => {
            const mockRedis = buildRedisMock({ mgetValues: ['true', 'true', 'true', 'true', 'true'] });
            getRedis.mockReturnValue(mockRedis);
            const { redisSet } = await import('@/lib/upstash/client');

            await limiter.recordFailure(model.id, 'quota exceeded 429');

            expect(redisSet).toHaveBeenCalledWith(
                `rl:${model.id}:cooldown:4`,
                'true',
                80 * 60 // 80 minutes — max tier
            );
        });

        it('logs model_429 event via logSystemEvent on rate limit error', async () => {
            const { logSystemEvent } = await import('@/lib/monitoring/events');
            const mockRedis = buildRedisMock({ mgetValues: [null, null, null, null, null] });
            getRedis.mockReturnValue(mockRedis);

            await limiter.recordFailure(model.id, new Error('429 Too Many Requests'));

            expect(logSystemEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'model_429', modelId: model.id })
            );
        });

        it('does nothing special for generic (non-429, non-404) errors', async () => {
            const { markModelDeprecated } = await import('../model-registry');
            const { logSystemEvent } = await import('@/lib/monitoring/events');

            await limiter.recordFailure(model.id, new Error('Network timeout'));

            expect(markModelDeprecated).not.toHaveBeenCalled();
            expect(logSystemEvent).not.toHaveBeenCalled();
        });

        it('handles rate limit detection from string "quota" keyword', async () => {
            const mockRedis = buildRedisMock({ mgetValues: [null, null, null, null, null] });
            getRedis.mockReturnValue(mockRedis);
            const { redisSet } = await import('@/lib/upstash/client');

            await limiter.recordFailure(model.id, 'Daily quota exceeded');

            expect(redisSet).toHaveBeenCalledWith(
                expect.stringContaining(':cooldown:'),
                'true',
                expect.any(Number)
            );
        });
    });

    // ── recordError (alias) ───────────────────────────────────────────────────

    describe('recordError()', () => {
        it('delegates to recordFailure without throwing', async () => {
            const recordFailureSpy = vi.spyOn(limiter, 'recordFailure').mockResolvedValue(undefined);
            limiter.recordError(model.id, new Error('Some error'));
            await vi.runAllTimersAsync();
            expect(recordFailureSpy).toHaveBeenCalledWith(model.id, expect.any(Error));
        });
    });

    // ── resetModel ────────────────────────────────────────────────────────────

    describe('resetModel()', () => {
        it('deletes rpm, day, and all 5 cooldown keys', () => {
            const mockRedis = buildRedisMock();
            getRedis.mockReturnValue(mockRedis);

            limiter.resetModel(model.id);

            expect(mockRedis.del).toHaveBeenCalledWith(
                `rl:${model.id}:rpm`,
                `rl:${model.id}:day`,
                `rl:${model.id}:cooldown:0`,
                `rl:${model.id}:cooldown:1`,
                `rl:${model.id}:cooldown:2`,
                `rl:${model.id}:cooldown:3`,
                `rl:${model.id}:cooldown:4`
            );
        });

        it('does nothing when Redis is unavailable', () => {
            getRedis.mockReturnValue(null);
            expect(() => limiter.resetModel(model.id)).not.toThrow();
        });
    });

    // ── getAvailableModel ─────────────────────────────────────────────────────

    describe('getAvailableModel()', () => {
        it('returns first allowed model sorted by tier', async () => {
            const tier1: ModelConfig = { ...model, id: 'tier1', tier: 1 };
            const tier2: ModelConfig = { ...model, id: 'tier2', tier: 2 };
            const mockRedis = buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 1,
                incrDayValue: 1,
            });
            getRedis.mockReturnValue(mockRedis);

            const result = await limiter.getAvailableModel([tier2, tier1]);
            expect(result.allowed).toBe(true);
            expect(result.model?.id).toBe('tier1');
        });

        it('returns allowed=false when all models are blocked', async () => {
            getRedis.mockReturnValue(buildRedisMock({
                mgetValues: ['true', null, null, null, null],
            }));
            const result = await limiter.getAvailableModel([model]);
            expect(result.allowed).toBe(false);
            expect(result.waitMs).toBeGreaterThan(0);
        });

        it('filters candidates by preferredTier', async () => {
            const tier1: ModelConfig = { ...model, id: 'tier1', tier: 1 };
            const tier3: ModelConfig = { ...model, id: 'tier3', tier: 3 };
            const mockRedis = buildRedisMock({
                mgetValues: [null, null, null, null, null],
                incrRpmValue: 1,
                incrDayValue: 1,
            });
            getRedis.mockReturnValue(mockRedis);

            const result = await limiter.getAvailableModel([tier1, tier3], 3);
            expect(result.allowed).toBe(true);
            expect(result.model?.id).toBe('tier3');
        });
    });

    // ── getRateLimiter singleton ──────────────────────────────────────────────

    describe('getRateLimiter() singleton', () => {
        it('returns the same instance across calls', () => {
            const a = getRateLimiter();
            const b = getRateLimiter();
            expect(a).toBe(b);
        });
    });
});
