// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, type Mock } from 'vitest';
import { http, HttpResponse } from 'msw';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkTokenBudget, recordTokenUsage } from '../cost-guard';
import { buildRoutingStagePlan, getModelsForUseCase, isCrossTierFallbackEnabled } from '../model-routing';
import { setupServer } from 'msw/node';
import { UnifiedAIClient, getAIClient } from '../client';
import type { Message, CompletionOptions } from '../client';
import type { ModelConfig } from '../providers';
import { getActiveModels } from '../model-registry';
import { __resetCooldownMemory } from '../provider-cooldown';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Must be declared before any imports that trigger module execution.

vi.mock('../cost-guard', () => ({
    checkTokenBudget: vi.fn().mockResolvedValue({ allowed: true }),
    recordTokenUsage: vi.fn().mockResolvedValue(undefined),
}));

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
    buildRoutingStagePlan: vi.fn().mockReturnValue([{ stage: 'emergency', useCase: 'chat' }]),
    getEmergencyFallbackModels: vi.fn().mockReturnValue([
        {
            modelId: 'llama-3.1-8b-instant',
            provider: 'groq',
            priority: 10,
            maxTokensOverride: null,
        },
    ]),
    getModelsForUseCase: vi.fn().mockResolvedValue([]),
    isCrossTierFallbackEnabled: vi.fn().mockResolvedValue(false),
    resolveToModelConfig: vi.fn((routed) => ({
        id: routed.modelId,
        provider: routed.provider,
        tier: routed.priority,
        rpm: 30,
        tpm: 5000,
        rpd: 1000,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: `${routed.provider} model`,
    })),
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

// ── MSW Server ───────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const server = setupServer();

let capturedRequestBody: any = null;

// ── MSW-based Helpers ────────────────────────────────────────────────────────

function mockFetchGroqSuccess(content = 'Binary tree is a data structure.') {
    server.use(
        http.post(GROQ_API_URL, async ({ request }) => {
            capturedRequestBody = await request.clone().json().catch(() => null);
            return HttpResponse.json({
                choices: [{ message: { content } }],
            });
        })
    );
}

function mockFetchGeminiSuccess(content = 'Binary tree explanation from Gemini.') {
    server.use(
        http.post(`${GEMINI_API_BASE}/*`, async ({ request }) => {
            capturedRequestBody = await request.clone().json().catch(() => null);
            return HttpResponse.json({
                candidates: [{ content: { parts: [{ text: content }] } }],
            });
        })
    );
}

function mockFetchFailure(status = 500, body = 'Internal Server Error') {
    server.use(
        http.post(GROQ_API_URL, () => {
            return new HttpResponse(body, { status });
        }),
        http.post(`${GEMINI_API_BASE}/*`, () => {
            return new HttpResponse(body, { status });
        })
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UnifiedAIClient', () => {
    let client: UnifiedAIClient;

    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
    afterAll(() => server.close());

    beforeEach(async () => {
        __resetCooldownMemory(); // quota cooldowns are module-level; isolate tests
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.stubEnv('GROQ_API_KEYS', '');
        vi.stubEnv('GEMINI_API_KEYS', '');
        vi.stubEnv('GOOGLE_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', process.env.TEST_GROQ_API_KEY || 'mock-groq-key-do-not-use');
        vi.stubEnv('GEMINI_API_KEY', 'mock-gemini-key-do-not-use');

        // Default: rate limiter allows everything
        mockRateLimiter.canUseModel.mockResolvedValue({ allowed: true, model: groqModel });

        // Default: single groq model in registry
        (getActiveModels as Mock).mockResolvedValue([groqModel]);

        client = new UnifiedAIClient();
    });

    afterEach(() => {
        server.resetHandlers();
        capturedRequestBody = null;
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
            server.use(
                http.post(GROQ_API_URL, () => {
                    return HttpResponse.json({ choices: [{ message: { content: '' } }] });
                })
            );
            const result = await client.callModel(groqModel, userMessages, {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Empty response/);
        });

        it('prepends system prompt if not already in messages', async () => {
            mockFetchGroqSuccess();
            await client.callModel(groqModel, userMessages, { systemPrompt: 'Be concise.' });

            expect(capturedRequestBody).not.toBeNull();
            expect(capturedRequestBody.messages[0].role).toBe('system');
            expect(capturedRequestBody.messages[0].content).toBe('Be concise.');
        });

        it('does not double-prepend system prompt if already first message', async () => {
            mockFetchGroqSuccess();
            const messagesWithSystem: Message[] = [
                { role: 'system', content: 'Existing system.' },
                { role: 'user', content: 'Hello' },
            ];
            await client.callModel(groqModel, messagesWithSystem, { systemPrompt: 'Overriding system.' });

            expect(capturedRequestBody).not.toBeNull();
            // Should still have only ONE system message at index 0
            const systemMessages = capturedRequestBody.messages.filter((m: Message) => m.role === 'system');
            expect(systemMessages.length).toBe(1);
        });

    });

    // ── Event logging with fake timers ───────────────────────────────────────

    describe('Event logging with fake timers', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
            server.resetHandlers();
            vi.useRealTimers();
        });

        it('logs model_429 event on 429 error', async () => {
            const { logSystemEvent } = await import('@/lib/monitoring/events');
            server.use(
                http.post(GROQ_API_URL, () => {
                    return new HttpResponse('Rate limited (429)', { status: 429 });
                })
            );
            await client.callModel(groqModel, userMessages, {});
            await vi.runAllTimersAsync();
            expect(logSystemEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'model_429' }));
        });

        it('logs model_deprecated event on 404 error', async () => {
            const { logSystemEvent } = await import('@/lib/monitoring/events');
            server.use(
                http.post(GROQ_API_URL, () => {
                    return new HttpResponse('Not found (404)', { status: 404 });
                })
            );
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
            expect(capturedRequestBody).not.toBeNull();
            const roles = capturedRequestBody.contents.map((c: { role: string }) => c.role);
            expect(roles).toEqual(['user', 'model', 'user']);
        });

        it('filters out system messages from contents array', async () => {
            mockFetchGeminiSuccess();
            const msgs: Message[] = [
                { role: 'system', content: 'Be helpful.' },
                { role: 'user', content: 'Hello' },
            ];
            await client.callModel(geminiModel, msgs, {});
            expect(capturedRequestBody).not.toBeNull();
            const hasSystem = capturedRequestBody.contents.some((c: { role: string }) => c.role === 'system');
            expect(hasSystem).toBe(false);
        });

        it('sets systemInstruction when systemPrompt option is provided', async () => {
            mockFetchGeminiSuccess();
            await client.callModel(geminiModel, userMessages, { systemPrompt: 'You are Kai.' });
            expect(capturedRequestBody).not.toBeNull();
            expect(capturedRequestBody.systemInstruction.parts[0].text).toBe('You are Kai.');
        });

        it('returns failure on empty Gemini response', async () => {
            server.use(
                http.post(`${GEMINI_API_BASE}/*`, () => {
                    return HttpResponse.json({ candidates: [] });
                })
            );
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
            expect(result.attemptedModels).toEqual([]);
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

    // ── getAIClient singleton ─────────────────────────────────────────────────

    describe('getAIClient() singleton', () => {
        it('returns same instance on multiple calls', () => {
            const a = getAIClient();
            const b = getAIClient();
            expect(a).toBe(b);
        });
    });

    describe('provider streaming contract', () => {
        const geminiStream = (text: string) =>
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

        function streamResponse(chunks: string[]) {
            const encoder = new TextEncoder();
            return new Response(new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                    controller.close();
                },
            }));
        }

        async function collect(chunks: AsyncIterable<string>) {
            const result = [];
            for await (const chunk of chunks) result.push(chunk);
            return result.join('');
        }

        afterEach(() => vi.restoreAllMocks());

        it('fails over Gemini models and preserves the request and SSE message boundaries', async () => {
            const standby = { ...geminiModel, id: 'gemini-standby' };
            vi.mocked(getActiveModels).mockResolvedValue([groqModel, geminiModel, standby]);
            const first = geminiStream('Visible <THINK');
            const fetch = vi.spyOn(globalThis, 'fetch')
                .mockRejectedValueOnce(new Error('connection reset'))
                .mockResolvedValueOnce(streamResponse([
                    ': heartbeat\n' + first.slice(0, 25),
                    first.slice(25) + 'data: {bad json}\n' + geminiStream('>internal'),
                    geminiStream('</TH') + geminiStream('INK>answer') + 'data: [DONE]\n' + geminiStream('discarded'),
                ]));
            const signal = new AbortController().signal;

            const result = await collect(client.generateStream([
                { role: 'system', content: 'old instruction' },
                { role: 'user', content: 'Question' },
                { role: 'assistant', content: 'Previous answer' },
            ], { preferredModel: 'gemini', systemPrompt: 'New instruction', maxTokens: 314, temperature: 0, signal }));

            expect(result).toBe('Visible answer');
            expect(client.getLastStreamInfo()).toEqual({ model: standby.id, provider: 'gemini' });
            expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
                `${GEMINI_API_BASE}/${geminiModel.id}:streamGenerateContent?key=mock-gemini-key-do-not-use&alt=sse`,
                `${GEMINI_API_BASE}/${standby.id}:streamGenerateContent?key=mock-gemini-key-do-not-use&alt=sse`,
            ]);
            const init = fetch.mock.calls[1][1];
            expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, signal });
            expect(init?.signal).toBe(signal);
            expect(JSON.parse(String(init?.body))).toEqual({
                contents: [
                    { role: 'user', parts: [{ text: 'Question' }] },
                    { role: 'model', parts: [{ text: 'Previous answer' }] },
                ],
                systemInstruction: { parts: [{ text: 'New instruction' }] },
                generationConfig: { maxOutputTokens: 314, temperature: 0 },
            });
        });

        it('falls back from Groq before emitting text and uses Gemini streaming defaults', async () => {
            vi.mocked(getActiveModels).mockResolvedValue([groqModel]);
            const fetch = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(new Response('service down', { status: 503 }))
                .mockResolvedValueOnce(streamResponse([geminiStream('fallback text')]));

            await expect(collect(client.generateStream(userMessages))).resolves.toBe('fallback text');
            expect(fetch.mock.calls[0][0]).toBe(GROQ_API_URL);
            expect(String(fetch.mock.calls[1][0])).toContain('/gemini-3.5-flash:streamGenerateContent?');
            expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
                contents: [{ role: 'user', parts: [{ text: userMessages[0].content }] }],
                generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
            });
            expect(client.getLastStreamInfo()).toEqual({ model: 'gemini-3.5-flash', provider: 'gemini' });
        });

        it('does not fall back after Groq has emitted text', async () => {
            const visible = 'An answer long enough to pass the streaming buffer.';
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: visible } }] })}\n\n`));
                },
                pull(controller) {
                    controller.error(new Error('upstream stream interrupted'));
                },
            }, { highWaterMark: 0 });
            const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream));
            const iterator = client.generateStream(userMessages);

            await expect(iterator.next()).resolves.toEqual({ value: visible.slice(0, -20), done: false });
            await expect(iterator.next()).rejects.toThrow('upstream stream interrupted');
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(client.getLastStreamInfo()).toEqual({ model: groqModel.id, provider: 'groq' });
        });

        it('does not retain a previous model after a new Gemini connection fails', async () => {
            vi.mocked(getActiveModels).mockResolvedValue([geminiModel]);
            const fetch = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(streamResponse([geminiStream('connected')]))
                .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }));

            await expect(collect(client.generateStream(userMessages, { preferredModel: 'gemini' }))).resolves.toBe('connected');
            await expect(collect(client.generateStream(userMessages, { preferredModel: 'gemini' })))
                .rejects.toThrow(`Gemini stream error — all models failed. Gemini ${geminiModel.id} (429): quota exceeded`);
            expect(client.getLastStreamInfo()).toBeNull();
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('model status and embeddings', () => {
        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it.each(['groq', 'gemini'] as const)('reports direct and representative status when %s is down', async (unavailable) => {
            const extraGroq = { ...groqModel, id: 'groq-secondary' };
            const extraGemini = { ...geminiModel, id: 'gemini-secondary' };
            vi.mocked(getActiveModels).mockResolvedValue([groqModel, extraGroq, geminiModel, extraGemini]);
            const requested: string[] = [];
            const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
                const body = JSON.parse(String(init?.body));
                const isGroq = url === GROQ_API_URL;
                requested.push(isGroq ? body.model : String(url));
                const success = isGroq
                    ? { choices: [{ message: { content: 'ok' } }] } : { candidates: [{ content: { parts: [{ text: 'ok' }] } }] };
                return unavailable === (isGroq ? 'groq' : 'gemini')
                    ? new Response('unavailable for health probe', { status: 400 }) : Response.json(success);
            });

            const status = await client.runHealthCheck();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(requested[0]).toBe(groqModel.id);
            expect(requested[1]).toContain(`/${geminiModel.id}:generateContent`);
            expect(Object.keys(status)).toEqual([groqModel.id, extraGroq.id, geminiModel.id, extraGemini.id]);
            for (const [model, method] of [
                [groqModel, 'direct_check'], [extraGroq, 'provider_representative_check'],
                [geminiModel, 'direct_check'], [extraGemini, 'provider_representative_check'],
            ] as const) {
                const available = model.provider !== unavailable;
                expect(status[model.id]).toEqual({
                    available, method, status: available ? 'available' : 'unavailable',
                    latency: available ? expect.any(Number) : undefined,
                    error: available ? undefined : expect.stringContaining('unavailable for health probe'),
                });
            }
        });

        it('checks a named model, reporting an unknown model and a timed-out request independently', async () => {
            vi.useFakeTimers();
            vi.mocked(getActiveModels).mockResolvedValue([groqModel]);
            const call = vi.spyOn(client, 'callModel').mockResolvedValueOnce({
                success: true, response: 'ok',
            }).mockImplementationOnce(() => new Promise(() => {}));

            await expect(client.checkSpecificModel('missing')).resolves.toEqual({
                available: false, error: 'Model ID missing not found in configuration', method: 'direct_check', status: 'unavailable',
            });
            await expect(client.checkSpecificModel(groqModel.id)).resolves.toEqual({
                available: true, latency: 0, method: 'direct_check', status: 'available',
            });
            const pending = client.checkSpecificModel(groqModel.id);
            const checked = expect(pending).resolves.toEqual({
                available: false, error: 'Health check timeout (3s)', method: 'direct_check', status: 'unavailable',
            });
            await vi.advanceTimersByTimeAsync(3000);
            await checked;
            expect(call).toHaveBeenCalledTimes(2);
            expect(call).toHaveBeenLastCalledWith(groqModel, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
        });

        it('sends each embedding input at the index dimensionality and preserves result order', async () => {
            const fetch = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(Response.json({ embedding: { values: [0.13, 0.17] } }))
                .mockResolvedValueOnce(Response.json({ embedding: { values: [0.23, 0.27] } }));

            await expect(client.embed(['first', 'second'])).resolves.toEqual({
                embeddings: [[0.13, 0.17], [0.23, 0.27]], modelUsed: 'gemini-embedding-001', dimensions: 2,
            });
            expect(fetch.mock.calls).toHaveLength(2);
            for (const [index, input] of ['first', 'second'].entries()) {
                const [url, init] = fetch.mock.calls[index];
                expect(String(url)).toBe(`${GEMINI_API_BASE}/gemini-embedding-001:embedContent?key=mock-gemini-key-do-not-use`);
                expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: expect.any(AbortSignal) });
                expect(JSON.parse(String(init?.body))).toEqual({ content: { parts: [{ text: input }] }, outputDimensionality: 768 });
            }
        });

        it.each([400, 200])('reports index unavailability on a bad embedding response (%i)', async (status) => {
            const systemEvent = vi.mocked(logSystemEvent);
            const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(status === 400
                ? new Response('embedding request rejected', { status }) : Response.json({ embedding: {} }));
            await expect(client.embed('question', { correlationId: 'embed-check' }))
                .rejects.toThrow('Embedding provider unavailable. RAG context unavailable.');
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(systemEvent).toHaveBeenNthCalledWith(1, { type: 'embedding_failed', provider: 'gemini', correlationId: 'embed-check' });
            expect(systemEvent).toHaveBeenNthCalledWith(2, { type: 'embedding_failed', errorMessage: 'Gemini embedding unavailable', correlationId: 'embed-check' });
        });
    });

    describe('routing and budget enforcement', () => {
        afterEach(() => vi.restoreAllMocks());

        it.each([
            ['daily_limit', "You've reached your daily usage limit. Your limit resets in a few hours."],
            ['session_limit', 'This session has reached its token limit. Please start a new session.'],
        ] as const)('returns the %s response without dispatching provider calls', async (reason, response) => {
            vi.mocked(checkTokenBudget).mockResolvedValueOnce({ allowed: false, reason, remaining_daily: 0, remaining_session: 0 });
            const dispatch = vi.spyOn(client, 'callModel');

            await expect(client.generateCompletion(userMessages, { userId: 'learner', sessionId: 'session' })).resolves.toEqual({
                success: true, modelUsed: 'budget_guard', response, attemptedModels: [], budgetExceeded: true,
            });
            expect(checkTokenBudget).toHaveBeenCalledExactlyOnceWith('learner', 'session', 500);
            expect(dispatch).not.toHaveBeenCalled();
            expect(recordTokenUsage).not.toHaveBeenCalled();
        });

        it('skips denied and previously attempted models across stages, then accounts for the successful response', async () => {
            const models = ['denied', 'failing', 'alternate'].map(id => ({ ...groqModel, id }));
            const route = (modelId: string, maxTokensOverride: number | null = null) => ({
                modelId, provider: 'groq' as const, priority: 1, maxTokensOverride,
            });
            vi.mocked(getActiveModels).mockResolvedValue(models);
            vi.mocked(isCrossTierFallbackEnabled).mockResolvedValueOnce(true);
            vi.mocked(buildRoutingStagePlan).mockReturnValueOnce([
                { stage: 'primary', useCase: 'analysis' },
                { stage: 'secondary', useCase: 'chat' },
                { stage: 'emergency', useCase: 'analysis' },
            ]);
            vi.mocked(getModelsForUseCase)
                .mockResolvedValueOnce([route('denied'), route('failing')])
                .mockResolvedValueOnce([route('failing'), route('alternate', 128)]);
            mockRateLimiter.canUseModel
                .mockResolvedValueOnce({ allowed: false })
                .mockResolvedValueOnce({ allowed: true })
                .mockResolvedValueOnce({ allowed: true });
            const dispatch = vi.spyOn(client, 'callModel')
                .mockResolvedValueOnce({ success: false, error: 'upstream failure' })
                .mockResolvedValueOnce({ success: true, response: '123456789' });
            const options = {
                userId: 'learner', sessionId: 'session', category: 'analysis',
                estimatedTokens: 80, maxTokens: 256, correlationId: 'trace-1',
            };

            await expect(client.generateCompletion(userMessages, options)).resolves.toEqual({
                success: true, modelUsed: 'alternate', provider: 'groq', response: '123456789',
                attemptedModels: ['failing', 'alternate'],
            });

            expect(checkTokenBudget).toHaveBeenCalledExactlyOnceWith('learner', 'session', 80);
            expect(buildRoutingStagePlan).toHaveBeenCalledExactlyOnceWith('analysis', true);
            expect(vi.mocked(getModelsForUseCase).mock.calls).toEqual([['analysis'], ['chat']]);
            expect(mockRateLimiter.canUseModel.mock.calls).toEqual([
                ['denied', models, 80], ['failing', models, 80], ['alternate', models, 80],
            ]);
            expect(dispatch.mock.calls.map(([model, messages, opts]) => [model.id, messages, opts])).toEqual([
                ['failing', userMessages, options],
                ['alternate', userMessages, { ...options, maxTokens: 128 }],
            ]);
            expect(mockRateLimiter.recordError).toHaveBeenCalledExactlyOnceWith('failing', 'upstream failure');
            expect(mockRateLimiter.recordRequest).toHaveBeenCalledExactlyOnceWith('alternate', 3);
            expect(recordTokenUsage).toHaveBeenCalledExactlyOnceWith('learner', 'session', 3);
            expect(logSystemEvent).toHaveBeenCalledExactlyOnceWith({
                type: 'llm_request', correlationId: 'trace-1',
                metadata: { useCase: 'analysis', model_id: 'alternate', provider: 'groq', duration_ms: expect.any(Number), messageCount: 1 },
            });
        });
    });
});
