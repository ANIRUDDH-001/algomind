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

async function makeRedisMock(overrides: {
    rpmStr?: string | null;
    dayStr?: string | null;
    mgetValues?: (string | null)[];
}) {
    const { getRedis, redisGet } = await import('@/lib/upstash/client');

    const mockRedis = {
        mget: vi.fn().mockResolvedValue(overrides.mgetValues ?? [null, null, null, null, null]),
        set: vi.fn().mockResolvedValue('OK'),
        incr: vi.fn().mockResolvedValue(1),
        del: vi.fn().mockResolvedValue(1),
    };

    (getRedis as Mock).mockReturnValue(mockRedis);
    (redisGet as Mock).mockImplementation(async (key: string) => {
        if (key.includes(':rpm')) return overrides.rpmStr ?? null;
        if (key.includes(':day')) return overrides.dayStr ?? null;
        return null;
    });

    return { mockRedis };
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
            await makeRedisMock({});
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
            await makeRedisMock({ rpmStr: null, dayStr: null, mgetValues: [null, null, null, null, null] });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
            expect(result.model).toBeDefined();
        });

        it('returns allowed=false with reason "rpm_limit" when rpm is at limit', async () => {
            await makeRedisMock({ rpmStr: '30', dayStr: '0', mgetValues: [null, null, null, null, null] });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('rpm_limit');
        });

        it('allows when rpm is below limit', async () => {
            await makeRedisMock({ rpmStr: '15', dayStr: '0', mgetValues: [null, null, null, null, null] });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
        });

        it('returns allowed=false with reason "rpd_limit" when daily limit is reached', async () => {
            await makeRedisMock({ rpmStr: '0', dayStr: '1000', mgetValues: [null, null, null, null, null] });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('rpd_limit');
        });

        it('returns allowed=false with reason "cooldown" when any cooldown key is active', async () => {
            // Second cooldown tier is active (index 1)
            await makeRedisMock({ mgetValues: [null, 'true', null, null, null] });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('cooldown');
        });

        it('fails open when Redis throws an error', async () => {
            const { getRedis: getR } = await import('@/lib/upstash/client');
            (getR as Mock).mockReturnValue({
                mget: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
            });
            const result = await limiter.canUseModel(model.id, allModels);
            expect(result.allowed).toBe(true);
        });

        it('checks cooldown keys for all 5 tier levels', async () => {
            const { getRedis: getR } = await import('@/lib/upstash/client');
            const mockRedis = {
                mget: vi.fn().mockResolvedValue([null, null, null, null, null]),
                set: vi.fn().mockResolvedValue('OK'),
                incr: vi.fn().mockResolvedValue(1),
                del: vi.fn().mockResolvedValue(1),
            };
            const { redisGet } = await import('@/lib/upstash/client');
            (getR as Mock).mockReturnValue(mockRedis);
            (redisGet as Mock).mockResolvedValue(null);

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

        it('sets RPM key with NX + EX=65 then increments', async () => {
            const mockRedis = {
                set: vi.fn().mockResolvedValue('OK'),
                incr: vi.fn().mockResolvedValue(1),
            };
            getRedis.mockReturnValue(mockRedis);

            limiter.recordRequest(model.id, 100);
            // Allow microtask queue to flush
            await vi.runAllTimersAsync();

            expect(mockRedis.set).toHaveBeenCalledWith(
                `rl:${model.id}:rpm`,
                0,
                { nx: true, ex: 65 }
            );
        });

        it('sets RPD key with NX + EX=86400 then increments', async () => {
            const mockRedis = {
                set: vi.fn().mockResolvedValue('OK'),
                incr: vi.fn().mockResolvedValue(1),
            };
            getRedis.mockReturnValue(mockRedis);

            limiter.recordRequest(model.id, 0);
            await vi.runAllTimersAsync();

            expect(mockRedis.set).toHaveBeenCalledWith(
                `rl:${model.id}:day`,
                0,
                { nx: true, ex: 86400 }
            );
        });

        it('silently swallows Redis errors without throwing', async () => {
            const mockRedis = {
                set: vi.fn().mockRejectedValue(new Error('Write failed')),
                incr: vi.fn(),
            };
            getRedis.mockReturnValue(mockRedis);
            expect(() => limiter.recordRequest(model.id, 0)).not.toThrow();
            await vi.runAllTimersAsync();
        });
    });

    // ── recordFailure ─────────────────────────────────────────────────────────

    describe('recordFailure()', () => {
        it('calls markModelDeprecated on 404 error and does not set cooldown', async () => {
            const { markModelDeprecated } = await import('../model-registry');
            getRedis.mockReturnValue({ mget: vi.fn().mockResolvedValue([null]) });

            await limiter.recordFailure(model.id, new Error('Model not found (404)'));

            expect(markModelDeprecated).toHaveBeenCalledWith(
                model.id,
                expect.stringContaining('404')
            );
        });

        it('sets cooldown tier 0 on first 429 error', async () => {
            const mockRedis = {
                mget: vi.fn().mockResolvedValue([null, null, null, null, null]),
                set: vi.fn().mockResolvedValue('OK'),
                incr: vi.fn().mockResolvedValue(1),
            };
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
            const mockRedis = {
                mget: vi.fn().mockResolvedValue(['true', null, null, null, null]),
                set: vi.fn().mockResolvedValue('OK'),
            };
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
            const mockRedis = {
                mget: vi.fn().mockResolvedValue(['true', 'true', 'true', 'true', 'true']),
                set: vi.fn().mockResolvedValue('OK'),
            };
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
            const mockRedis = {
                mget: vi.fn().mockResolvedValue([null, null, null, null, null]),
                set: vi.fn().mockResolvedValue('OK'),
            };
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
            const mockRedis = {
                mget: vi.fn().mockResolvedValue([null, null, null, null, null]),
                set: vi.fn().mockResolvedValue('OK'),
            };
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
            const mockRedis = { del: vi.fn().mockResolvedValue(7) };
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
            await makeRedisMock({ rpmStr: '0', dayStr: '0', mgetValues: [null, null, null, null, null] });

            const result = await limiter.getAvailableModel([tier2, tier1]);
            expect(result.allowed).toBe(true);
            expect(result.model?.id).toBe('tier1');
        });

        it('returns allowed=false when all models are blocked', async () => {
            await makeRedisMock({ mgetValues: ['true', null, null, null, null] });
            const result = await limiter.getAvailableModel([model]);
            expect(result.allowed).toBe(false);
            expect(result.waitMs).toBeGreaterThan(0);
        });

        it('filters candidates by preferredTier', async () => {
            const tier1: ModelConfig = { ...model, id: 'tier1', tier: 1 };
            const tier3: ModelConfig = { ...model, id: 'tier3', tier: 3 };
            await makeRedisMock({ rpmStr: '0', dayStr: '0', mgetValues: [null, null, null, null, null] });

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
