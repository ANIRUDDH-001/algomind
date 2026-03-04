// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { UnifiedAIClient, getAIClient } from '../client';
import type { Message, CompletionOptions } from '../client';
import type { ModelConfig } from '../providers';
import { getActiveModels } from '../model-registry';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Must be declared before any imports that trigger module execution.

vi.mock('../rate-limiter', () => ({
    getRateLimiter: vi.fn(() => mockRateLimiter),
    IntelligentRateLimiter: vi.fn(),
}));

vi.mock('../model-registry', () => ({
    getActiveModels: vi.fn(),
}));

vi.mock('../intent-classifier', () => ({
    getIntentClassifier: vi.fn(() => mockClassifier),
}));

vi.mock('../../analytics/model-telemetry', () => ({
    getModelTelemetry: vi.fn(() => mockTelemetry),
}));

vi.mock('../response-cache', () => ({
    getResponseCache: vi.fn(() => mockCache),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock model-routing to skip DB-driven routing in tests (fallback to legacy)
vi.mock('../model-routing', () => ({
    getModelsForUseCase: vi.fn().mockResolvedValue([]),
    isCrossTierFallbackEnabled: vi.fn().mockResolvedValue(false),
    resolveToModelConfig: vi.fn(),
}));

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockRateLimiter = {
    canUseModel: vi.fn(),
    recordRequest: vi.fn(),
    recordError: vi.fn(),
    getUsageStats: vi.fn().mockResolvedValue({}),
    getRemainingCapacity: vi.fn().mockResolvedValue({ minuteRemaining: 0, dayRemaining: 0 }),
};

const mockClassifier = {
    classify: vi.fn(),
};

const mockTelemetry = {
    recordDecision: vi.fn(),
};

const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const groqModel: ModelConfig = {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    tier: 1,
    rpm: 30,
    tpm: 5000,
    rpd: 1000,
    contextWindow: 128000,
    supportsEmbeddings: false,
    description: 'Groq fast model',
};

const geminiModel: ModelConfig = {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    tier: 1,
    rpm: 15,
    tpm: 1000000,
    rpd: 1500,
    contextWindow: 1000000,
    supportsEmbeddings: false,
    description: 'Gemini Flash',
};

const userMessages: Message[] = [{ role: 'user', content: 'What is a binary tree?' }];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchGroqSuccess(content = 'Binary tree is a data structure.') {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            choices: [{ message: { content } }],
        }),
        text: async () => '',
    } as Response);
}

function mockFetchGeminiSuccess(content = 'Binary tree explanation from Gemini.') {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: content }] } }],
        }),
        text: async () => '',
    } as Response);
}

function mockFetchFailure(status = 500, body = 'Internal Server Error') {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status,
        text: async () => body,
        json: async () => ({}),
    } as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UnifiedAIClient', () => {
    let client: UnifiedAIClient;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
        vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

        // Default: rate limiter allows everything
        mockRateLimiter.canUseModel.mockResolvedValue({ allowed: true, model: groqModel });

        // Default: single groq model in registry
        (getActiveModels as Mock).mockResolvedValue([groqModel]);

        client = new UnifiedAIClient();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        mockCache.get.mockReset();
        mockClassifier.classify.mockReset();
    });

    // ── Constructor / Config validation ───────────────────────────────────────

    describe('constructor + validateConfig', () => {
        it('logs a warning when GROQ_API_KEY is missing', () => {
            vi.unstubAllEnvs();
            vi.stubEnv('GEMINI_API_KEY', 'key');
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            new UnifiedAIClient();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GROQ_API_KEY'));
            warnSpy.mockRestore();
        });

        it('logs a warning when both Gemini keys are missing', () => {
            vi.unstubAllEnvs();
            vi.stubEnv('GROQ_API_KEY', 'key');
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            new UnifiedAIClient();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GEMINI_API_KEY'));
            warnSpy.mockRestore();
        });

        it('does not warn when both providers are configured', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            new UnifiedAIClient();
            expect(warnSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ── callModel / callGroq ─────────────────────────────────────────────────

    describe('callModel() → Groq', () => {
        it('returns success with content on 200 OK', async () => {
            mockFetchGroqSuccess('Hello from Groq');
            const result = await client.callModel(groqModel, userMessages, {});
            expect(result.success).toBe(true);
            expect(result.response).toBe('Hello from Groq');
        });

        it('returns failure when GROQ_API_KEY is missing', async () => {
            vi.unstubAllEnvs();
            vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
            const c = new UnifiedAIClient();
            const result = await c.callModel(groqModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/GROQ_API_KEY/);
        });

        it('throws and catches on non-OK response', async () => {
            mockFetchFailure(500, 'Server error');
            const result = await client.callModel(groqModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/500/);
        });

        it('returns failure on empty content from Groq', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '' } }] }),
                text: async () => '',
            } as Response);
            const result = await client.callModel(groqModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Empty response/);
        });

        it('prepends system prompt if not already in messages', async () => {
            mockFetchGroqSuccess();
            await client.callModel(groqModel, userMessages, { systemPrompt: 'Be concise.' });

            const fetchCall = (global.fetch as Mock).mock.calls[0];
            const body = JSON.parse(fetchCall[1].body as string);
            expect(body.messages[0].role).toBe('system');
            expect(body.messages[0].content).toBe('Be concise.');
        });

        it('does not double-prepend system prompt if already first message', async () => {
            mockFetchGroqSuccess();
            const messagesWithSystem: Message[] = [
                { role: 'system', content: 'Existing system.' },
                { role: 'user', content: 'Hello' },
            ];
            await client.callModel(groqModel, messagesWithSystem, { systemPrompt: 'Overriding system.' });

            const fetchCall = (global.fetch as Mock).mock.calls[0];
            const body = JSON.parse(fetchCall[1].body as string);
            // Should still have only ONE system message at index 0
            const systemMessages = body.messages.filter((m: Message) => m.role === 'system');
            expect(systemMessages.length).toBe(1);
        });

        it('logs model_429 event on 429 error', async () => {
            const { logSystemEvent } = await import('@/lib/monitoring/events');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => 'Rate limited (429)',
            } as Response);
            await client.callModel(groqModel, userMessages, {});
            await vi.runAllTimersAsync();
            expect(logSystemEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'model_429' }));
        });

        it('logs model_deprecated event on 404 error', async () => {
            const { logSystemEvent } = await import('@/lib/monitoring/events');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'Not found (404)',
            } as Response);
            await client.callModel(groqModel, userMessages, {});
            await vi.runAllTimersAsync();
            expect(logSystemEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'model_deprecated' }));
        });
    });

    // ── callModel / callGemini ────────────────────────────────────────────────

    describe('callModel() → Gemini', () => {
        it('returns success with content on 200 OK', async () => {
            mockFetchGeminiSuccess('Gemini answer');
            const result = await client.callModel(geminiModel, userMessages, {});
            expect(result.success).toBe(true);
            expect(result.response).toBe('Gemini answer');
        });

        it('returns failure when both Gemini API keys are missing', async () => {
            vi.unstubAllEnvs();
            vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
            const c = new UnifiedAIClient();
            const result = await c.callModel(geminiModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/GEMINI_API_KEY/);
        });

        it('uses GOOGLE_API_KEY as fallback when GEMINI_API_KEY absent', async () => {
            vi.unstubAllEnvs();
            vi.stubEnv('GROQ_API_KEY', 'rk');
            vi.stubEnv('GOOGLE_API_KEY', 'google-key');
            const c = new UnifiedAIClient();
            mockFetchGeminiSuccess('OK');
            const result = await c.callModel(geminiModel, userMessages, {});
            expect(result.success).toBe(true);
        });

        it('converts messages to Gemini role format (assistant → model)', async () => {
            mockFetchGeminiSuccess();
            const conversation: Message[] = [
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello' },
                { role: 'user', content: 'What is recursion?' },
            ];
            await client.callModel(geminiModel, conversation, {});
            const fetchCall = (global.fetch as Mock).mock.calls[0];
            const body = JSON.parse(fetchCall[1].body as string);
            const roles = body.contents.map((c: { role: string }) => c.role);
            expect(roles).toEqual(['user', 'model', 'user']);
        });

        it('filters out system messages from contents array', async () => {
            mockFetchGeminiSuccess();
            const msgs: Message[] = [
                { role: 'system', content: 'Be helpful.' },
                { role: 'user', content: 'Hello' },
            ];
            await client.callModel(geminiModel, msgs, {});
            const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body as string);
            const hasSystem = body.contents.some((c: { role: string }) => c.role === 'system');
            expect(hasSystem).toBe(false);
        });

        it('sets systemInstruction when systemPrompt option is provided', async () => {
            mockFetchGeminiSuccess();
            await client.callModel(geminiModel, userMessages, { systemPrompt: 'You are Kai.' });
            const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body as string);
            expect(body.systemInstruction.parts[0].text).toBe('You are Kai.');
        });

        it('returns failure on empty Gemini response', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ candidates: [] }),
                text: async () => '',
            } as Response);
            const result = await client.callModel(geminiModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Empty response/);
        });
    });

    // ── tryProvider ───────────────────────────────────────────────────────────

    describe('tryProvider()', () => {
        it('skips rate-limited models and tries the next one', async () => {
            const slowModel: ModelConfig = { ...groqModel, id: 'model-slow', tier: 2 };
            const fastModel: ModelConfig = { ...groqModel, id: 'model-fast', tier: 1 };
            const models = [fastModel, slowModel];

            // fast is rate-limited, slow is allowed
            mockRateLimiter.canUseModel
                .mockResolvedValueOnce({ allowed: false, reason: 'rpm_limit' })
                .mockResolvedValueOnce({ allowed: true, model: slowModel });

            mockFetchGroqSuccess('Answer from slow');

            const result = await client.tryProvider('groq', userMessages, {}, [], models);
            expect(result.success).toBe(true);
            expect(result.modelUsed).toBe('model-slow');
        });

        it('returns failed result when all models are rate-limited', async () => {
            mockRateLimiter.canUseModel.mockResolvedValue({ allowed: false, reason: 'rpm_limit' });
            const result = await client.tryProvider('groq', userMessages, {}, [], [groqModel]);
            expect(result.success).toBe(false);
        });

        it('records successful request in rate limiter', async () => {
            mockFetchGroqSuccess('Response');
            await client.tryProvider('groq', userMessages, {}, [], [groqModel]);
            expect(mockRateLimiter.recordRequest).toHaveBeenCalledWith(
                groqModel.id,
                expect.any(Number)
            );
        });

        it('records error in rate limiter on model failure', async () => {
            mockFetchFailure(500);
            await client.tryProvider('groq', userMessages, {}, [], [groqModel]);
            expect(mockRateLimiter.recordError).toHaveBeenCalledWith(
                groqModel.id,
                expect.any(String)
            );
        });

        it('sorts models by tier (lower tier = higher priority)', async () => {
            const tier1: ModelConfig = { ...groqModel, id: 't1', tier: 1 };
            const tier3: ModelConfig = { ...groqModel, id: 't3', tier: 3 };
            const attempted: string[] = [];
            mockRateLimiter.canUseModel.mockResolvedValue({ allowed: true, model: tier1 });
            mockFetchGroqSuccess();

            await client.tryProvider('groq', userMessages, {}, attempted, [tier3, tier1]);
            // tier1 should be attempted first
            expect(attempted[0]).toBe('t1');
        });
    });

    // ── generateCompletion ────────────────────────────────────────────────────

    describe('generateCompletion()', () => {
        it('returns success on first model success (groq default)', async () => {
            mockFetchGroqSuccess('Great answer');
            const result = await client.generateCompletion(userMessages);
            expect(result.success).toBe(true);
            expect(result.response).toBe('Great answer');
            expect(result.provider).toBe('groq');
        });

        it('maps "local" preferred provider to "groq"', async () => {
            mockFetchGroqSuccess();
            const result = await client.generateCompletion(userMessages, {
                preferredProvider: 'local' as CompletionOptions['preferredProvider'],
            });
            expect(result.provider).toBe('groq');
        });

        it('does NOT fall back to Gemini when Groq is preferred and fails', async () => {
            (getActiveModels as Mock).mockResolvedValue([groqModel, geminiModel]);
            mockRateLimiter.canUseModel.mockResolvedValue({ allowed: false, reason: 'rpm_limit' });

            const result = await client.generateCompletion(userMessages, {
                preferredProvider: 'groq',
            });
            expect(result.success).toBe(false);
            // Gemini should NOT have been attempted
            expect(result.attemptedModels).not.toContain('gemini-2.0-flash');
        });

        it('falls back from Gemini to Groq when Gemini is preferred and fails', async () => {
            (getActiveModels as Mock).mockResolvedValue([groqModel, geminiModel]);

            // Gemini rate-limited, Groq allowed
            mockRateLimiter.canUseModel
                .mockResolvedValueOnce({ allowed: false, reason: 'rpm_limit' }) // gemini blocked
                .mockResolvedValueOnce({ allowed: true, model: groqModel });  // groq allowed

            mockFetchGroqSuccess('Groq fallback answer');
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await client.generateCompletion(userMessages, {
                preferredProvider: 'gemini',
            });

            expect(result.success).toBe(true);
            expect(result.provider).toBe('groq');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to Groq'));
            warnSpy.mockRestore();
        });

        it('returns error message when all providers fail', async () => {
            mockRateLimiter.canUseModel.mockResolvedValue({ allowed: false });
            const result = await client.generateCompletion(userMessages);
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    // ── generateResponse ──────────────────────────────────────────────────────

    describe('generateResponse()', () => {
        it('bypasses smart routing when preferredModel is "groq"', async () => {
            mockFetchGroqSuccess('Direct groq response');
            const result = await client.generateResponse(userMessages, {
                preferredModel: 'groq',
            });
            expect(result.success).toBe(true);
            expect(result.routing).toBeUndefined();
            expect(mockClassifier.classify).not.toHaveBeenCalled();
        });

        it('bypasses smart routing when smart routing env is disabled', async () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING', 'false');
            mockFetchGroqSuccess('Groq non-smart');
            const result = await client.generateResponse(userMessages, { preferredModel: 'auto' });
            expect(result.success).toBe(true);
            expect(mockClassifier.classify).not.toHaveBeenCalled();
        });

        it('uses classifier when smart routing env is enabled and preferredModel is auto', async () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING', 'true');
            mockClassifier.classify.mockResolvedValue({
                complexity: 'simple',
                category: 'greeting',
                confidence: 0.95,
                suggestedModel: 'groq',
                reasoning: 'Simple query',
            });
            mockFetchGroqSuccess('Smart routed response');

            const result = await client.generateResponse(userMessages, { preferredModel: 'auto' });
            expect(result.success).toBe(true);
            expect(result.routing?.smartRoutingUsed).toBe(true);
            expect(mockClassifier.classify).toHaveBeenCalledWith(userMessages[0].content);
        });

        it('returns cached response without calling AI when cache hits', async () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE', 'true');
            vi.stubEnv('CACHE_BACKEND', 'memory');
            vi.stubEnv('NODE_ENV', 'development');

            mockCache.get.mockResolvedValue({
                response: 'Cached answer',
                model: 'groq',
                hitCount: 3,
                avgLatency: 120,
            });

            const result = await client.generateResponse(userMessages, { preferredModel: 'groq' });
            expect(result.success).toBe(true);
            expect(result.response).toBe('Cached answer');
            expect(global.fetch).not.toHaveBeenCalled?.();
        });

        it('records telemetry decision after smart routing', async () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING', 'true');
            mockClassifier.classify.mockResolvedValue({
                complexity: 'medium',
                category: 'coding',
                confidence: 0.8,
                suggestedModel: 'groq',
            });
            mockFetchGroqSuccess();

            await client.generateResponse(userMessages, { preferredModel: 'auto' });
            expect(mockTelemetry.recordDecision).toHaveBeenCalledWith(
                expect.objectContaining({ smartRouting: true })
            );
        });

        it('falls back to alternate provider when routed provider fails in smart routing', async () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING', 'true');
            (getActiveModels as Mock).mockResolvedValue([groqModel, geminiModel]);

            // Route to 'gemini' — the source only falls back from gemini → groq
            mockClassifier.classify.mockResolvedValue({
                complexity: 'complex',
                category: 'coding',
                confidence: 0.95,
                suggestedModel: 'gemini',
            });

            // Gemini fails (rate limited), Groq succeeds
            mockRateLimiter.canUseModel
                .mockResolvedValueOnce({ allowed: false })   // gemini blocked
                .mockResolvedValueOnce({ allowed: true, model: groqModel }); // groq allowed

            mockFetchGroqSuccess('Groq fallback');

            const result = await client.generateResponse(userMessages, { preferredModel: 'auto' });
            expect(result.success).toBe(true);
        });
    });

    // ── storeInCache ──────────────────────────────────────────────────────────

    describe('storeInCache()', () => {
        it('stores in cache when cache is enabled', () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE', 'true');
            vi.stubEnv('CACHE_BACKEND', 'memory');
            vi.stubEnv('NODE_ENV', 'development');

            client.storeInCache('what is a heap?', 'A heap is...', 'groq', 200);
            expect(mockCache.set).toHaveBeenCalledWith('what is a heap?', 'A heap is...', 'groq', 200);
        });

        it('does NOT store in cache when flag is disabled', () => {
            vi.stubEnv('NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE', 'false');
            client.storeInCache('query', 'response', 'groq', 100);
            expect(mockCache.set).not.toHaveBeenCalled();
        });
    });

    // ── chat (legacy) ─────────────────────────────────────────────────────────

    describe('chat() legacy method', () => {
        it('returns response and modelUsed on success', async () => {
            mockFetchGroqSuccess('Legacy response');
            const result = await client.chat(userMessages);
            expect(result.response).toBe('Legacy response');
            expect(result.modelUsed).toBe(groqModel.id);
        });

        it('throws when all models fail', async () => {
            mockRateLimiter.canUseModel.mockResolvedValue({ allowed: false });
            await expect(client.chat(userMessages)).rejects.toThrow();
        });
    });

    // ── getAIClient singleton ─────────────────────────────────────────────────

    describe('getAIClient() singleton', () => {
        it('returns same instance on multiple calls', () => {
            const a = getAIClient();
            const b = getAIClient();
            expect(a).toBe(b);
        });
    });
});
