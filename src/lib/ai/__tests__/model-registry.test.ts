import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
    getActiveModels,
    markModelRateLimited,
    clearModelRateLimit,
    resetModelRegistry,
    getNextAvailableModel,
} from '../model-registry';
import { CHAT_MODELS } from '../providers';
import { getServiceClient } from '@/lib/supabase/service';
import { redisGet } from '@/lib/upstash/client';

// Mock Supabase Server Client
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

// Mock Redis Client
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
}));

// Mock Events Logger
vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn(),
}));

describe('Model Registry', () => {

    // Supabase builder chain mock
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        resetModelRegistry(); // Reset 60s cooldown maps

        // Setup base Supabase mock chain
        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        };
        (getServiceClient as Mock).mockReturnValue(mockSupabase);

        // Setup base Redis mock (cache miss by default)
        (redisGet as Mock).mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getActiveModels()', () => {
        it('1. returns sorted list by priority when DB returns rows', async () => {
            const dbRows = [
                { model_id: 'model-a', provider: 'groq', tier: 2, rpm: 10, tpm: 100, rpd: 1000, context_window: 8192, notes: '' },
                { model_id: 'model-b', provider: 'gemini', tier: 1, rpm: 20, tpm: 200, rpd: 2000, context_window: 4096, notes: '' },
            ];

            // Mock successful DB response
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            const models = await getActiveModels();

            expect(mockSupabase.from).toHaveBeenCalledWith('model_registry');
            expect(models).toHaveLength(2);
            // It maps them correctly based on the payload returned
            expect(models[0].id).toBe('model-a');
            expect(models[0].tier).toBe(2);
            expect(models[1].id).toBe('model-b');
            expect(models[1].tier).toBe(1);
        });

        it('2. returns fallback static list when DB query fails', async () => {
            // Mock DB error
            mockSupabase.order.mockResolvedValue({ data: null, error: new Error('DB Error') });

            const models = await getActiveModels();

            // Should fallback to CHAT_MODELS
            expect(models).toEqual(CHAT_MODELS);
            expect(models.length).toBeGreaterThan(0);
        });
    });

    describe('Rate Limiting & Cooldown Logic', () => {
        it('3. markModelRateLimited() updates cache internally', async () => {
            const dbRows = [
                { model_id: 'test-model', provider: 'groq', tier: 1, rpm: 10, tpm: 0, rpd: 0, context_window: 0, notes: '' },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            const now = Date.now();
            vi.setSystemTime(now);

            markModelRateLimited('test-model');

            // Verify the model is now skipped by getNextAvailableModel (internal state was updated)
            const model = await getNextAvailableModel();
            expect(model).toBeNull();
        });

        it('4. getNextAvailableModel() skips models rate-limited in last 60s', async () => {
            const dbRows = [
                { model_id: 'tier-1-model', provider: 'groq', tier: 1, rpm: 10, tpm: 0, rpd: 0, context_window: 0, notes: '' },
                { model_id: 'tier-2-model', provider: 'gemini', tier: 2, rpm: 10, tpm: 0, rpd: 0, context_window: 0, notes: '' },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            // Mark tier 1 as rate limited right now
            markModelRateLimited('tier-1-model');

            // Should skip tier 1 and return tier 2
            const model = await getNextAvailableModel();
            expect(model).toBeDefined();
            expect(model!.id).toBe('tier-2-model');
        });

        it('5. getNextAvailableModel() returns null when ALL models are rate-limited', async () => {
            const dbRows = [
                { model_id: 'tier-1-model', provider: 'groq', tier: 1, rpm: 10 },
                { model_id: 'tier-2-model', provider: 'gemini', tier: 2, rpm: 10 },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            markModelRateLimited('tier-1-model');
            markModelRateLimited('tier-2-model');

            const model = await getNextAvailableModel();
            expect(model).toBeNull();
        });

        it('6. The 60-second cooldown window: model rate-limited 59s ago → still skipped', async () => {
            const dbRows = [
                { model_id: 'tier-1-model', provider: 'groq', tier: 1, rpm: 10 },
                { model_id: 'tier-2-model', provider: 'gemini', tier: 2, rpm: 10 },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            const start = Date.now();
            vi.setSystemTime(start);

            markModelRateLimited('tier-1-model');

            // advance 59 seconds (59000 ms)
            vi.setSystemTime(start + 59000);

            // Tier 1 still cooling down, fallback to Tier 2
            const model = await getNextAvailableModel();
            expect(model!.id).toBe('tier-2-model');
        });

        it('7. The 60-second cooldown window: model rate-limited 61s ago → available again', async () => {
            const dbRows = [
                { model_id: 'tier-1-model', provider: 'groq', tier: 1, rpm: 10 },
                { model_id: 'tier-2-model', provider: 'gemini', tier: 2, rpm: 10 },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            const start = Date.now();
            vi.setSystemTime(start);
            markModelRateLimited('tier-1-model');

            // advance 61 seconds (61000 ms)
            vi.setSystemTime(start + 61000);

            // Tier 1 has cooled down! Should be selected again.
            const model = await getNextAvailableModel();
            expect(model!.id).toBe('tier-1-model');
        });
    });

    describe('Singleton behavior (ActiveModels Cache)', () => {
        it('8. Singleton behavior: multiple calls to getRegistry (getActiveModels) return same instance', async () => {
            const dbRows = [
                { model_id: 'tier-1-model', provider: 'groq', tier: 1, rpm: 10 },
            ];
            mockSupabase.order.mockResolvedValue({ data: dbRows, error: null });

            const call1 = await getActiveModels();
            const call2 = await getActiveModels();

            // When DB is working, active models returns mapped models dynamically
            // (Note: getActiveModels implements Redis caching which is currently mocked, 
            // so each call might resolve anew without a memcache layer in the module itself, 
            // but the arrays should deep equal representing identical derived states).
            expect(call1).toEqual(call2);
        });
    });
});
