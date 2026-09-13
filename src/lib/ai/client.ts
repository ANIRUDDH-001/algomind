// Unified AI Client with Multi-Provider Support
// When AWS Bedrock flag is ON, Bedrock models are PRIMARY (tried first).
// When OFF, uses Gemini/Groq with automatic rate-limit-based fallback.
// DB-driven model routing with cross-tier fallback
// DIRECT API CALLS implementation (No SDKs)

import { EMBEDDING_MODELS, ModelConfig, Provider } from './providers';

// Single source of truth for embeddings (AWS Bedrock/Titan removed).
const EMBEDDING_MODEL_ID = EMBEDDING_MODELS[0]?.id ?? 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = EMBEDDING_MODELS[0]?.dimensions ?? 768;
import { getRateLimiter, IntelligentRateLimiter } from './rate-limiter';
import { getIntentClassifier } from './intent-classifier';
import { getModelTelemetry } from '../analytics/model-telemetry';
import { getResponseCache } from './response-cache';
import type { CacheIdentity } from './response-cache';
import { getActiveModels } from './model-registry';
import {
    buildRoutingStagePlan,
    getEmergencyFallbackModels,
    getModelsForUseCase,
    isCrossTierFallbackEnabled,
    resolveToModelConfig,
} from './model-routing';
import { logSystemEvent } from '../monitoring/events';
import type { GenerateResponseOptions, AIResponse } from './types';
import { checkTokenBudget, recordTokenUsage } from './cost-guard';

// --- API key pools (round-robin) ------------------------------------------
// Free-tier providers rate-limit per API key. Supplying several keys via the
// *_API_KEYS comma-list env spreads load across them (each key has its own
// RPM/RPD budget), multiplying throughput. Single-key setups keep working via
// the legacy *_API_KEY fallback. Rotation is per call/attempt so consecutive
// requests hit different keys, and a rate-limited key is naturally skipped past.
function parseKeyPool(...envValues: (string | undefined)[]): string[] {
    const keys: string[] = [];
    for (const v of envValues) {
        if (!v) continue;
        for (const raw of v.split(',')) {
            const k = raw.trim();
            if (k && !keys.includes(k)) keys.push(k);
        }
    }
    return keys;
}
let __geminiKeyIdx = 0;
let __groqKeyIdx = 0;
function geminiKeyPool(): string[] {
    return parseKeyPool(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY);
}
function groqKeyPool(): string[] {
    return parseKeyPool(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY);
}
function nextGeminiKey(): string | undefined {
    const pool = geminiKeyPool();
    if (pool.length === 0) return undefined;
    const key = pool[__geminiKeyIdx % pool.length];
    __geminiKeyIdx = (__geminiKeyIdx + 1) % pool.length;
    return key;
}
function nextGroqKey(): string | undefined {
    const pool = groqKeyPool();
    if (pool.length === 0) return undefined;
    const key = pool[__groqKeyIdx % pool.length];
    __groqKeyIdx = (__groqKeyIdx + 1) % pool.length;
    return key;
}

// Types
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface CompletionOptions {
    preferredProvider?: Provider;
    category?: string; // e.g. 'reasoning', 'coding', 'fast' - maps to tiers if needed
    maxTokens?: number;
    temperature?: number;
    estimatedTokens?: number;
    systemPrompt?: string; // Legacy support
    // Disables LLM intent classification pass when routing is smart
    enableLLMPass?: boolean;
    /** Optional external cancellation signal */
    signal?: AbortSignal;
    /** OpenAI-compatible response_format for structured output (e.g. { type: 'json_object' }) */
    responseFormat?: { type: string; [key: string]: unknown };
    correlationId?: string;
    userId?: string;
    sessionId?: string;
}

export interface CompletionResult {
    success: boolean;
    modelUsed?: string;
    provider?: Provider;
    response?: string;
    error?: string;
    attemptedModels: string[];
    budgetExceeded?: boolean;
}

// Unified AI Client
export class UnifiedAIClient {
    private rateLimiter: IntelligentRateLimiter;
    private readonly GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    /**
     * The concrete model/provider the most recent generateStream() actually connected with.
     * generateStream() is an AsyncGenerator<string> with no side channel, so streaming
     * callers (e.g. /api/chat's SSE `done` event) previously had to report the *selector*
     * ('auto') instead of the real model. Set at the moment a provider commits to a model.
     */
    private lastStream: { model: string; provider: 'groq' | 'gemini' } | null = null;
    getLastStreamInfo(): { model: string; provider: 'groq' | 'gemini' } | null {
        return this.lastStream;
    }
    private readonly GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

    constructor() {
        this.rateLimiter = getRateLimiter();
        this.validateConfig();
    }

    private validateConfig() {
        if (groqKeyPool().length === 0) {
            console.warn("Using UnifiedAIClient without GROQ_API_KEY");
        }
        if (geminiKeyPool().length === 0) {
            console.warn("Using UnifiedAIClient without GEMINI_API_KEY or GOOGLE_API_KEY");
        } else if (geminiKeyPool().length > 1) {
            console.log(`[AI] Gemini key pool active: ${geminiKeyPool().length} keys (round-robin)`);
        }
    }

    /**
     * Generate completion with automatic fallback based on provider rules
     */
    async generateCompletion(
        messages: Message[],
        options: CompletionOptions = {}
    ): Promise<CompletionResult> {
        const attemptedModels: string[] = [];
        const correlationId = options.correlationId ?? crypto.randomUUID();
        const callStart = Date.now();

        if (options.userId && options.sessionId) {
            const budget = await checkTokenBudget(
                options.userId,
                options.sessionId,
                options.estimatedTokens || 500
            );

            if (!budget.allowed) {
                return {
                    success: true,
                    modelUsed: 'budget_guard',
                    response: budget.reason === 'daily_limit'
                        ? "You've reached your daily usage limit. Your limit resets in a few hours."
                        : 'This session has reached its token limit. Please start a new session.',
                    attemptedModels,
                    budgetExceeded: true,
                };
            }
        }

        // Determine use case from options
        const useCase: 'chat' | 'analysis' =
            (options.category === 'intelligence' || options.category === 'analysis')
                ? 'analysis' : 'chat';

        // Compatibility path: explicit provider overrides keep legacy semantics.
        // Deterministic stage routing is used when provider is not explicitly forced.
        if (options.preferredProvider) {
            let forcedProvider = options.preferredProvider;
            if (forcedProvider === 'local') {
                forcedProvider = 'groq';
            }

            const models = await getActiveModels();
            const primaryResult = await this.tryProvider(
                forcedProvider,
                messages,
                { ...options, correlationId },
                attemptedModels,
                models
            );
            if (primaryResult.success) {
                if (primaryResult.modelUsed && primaryResult.provider) {
                    void logSystemEvent({
                        type: 'llm_request',
                        correlationId,
                        metadata: {
                            useCase,
                            model_id: primaryResult.modelUsed,
                            provider: primaryResult.provider,
                            duration_ms: Date.now() - callStart,
                            messageCount: messages.length,
                        },
                    });
                }
                return primaryResult;
            }

            if (forcedProvider === 'gemini') {
                console.warn('[UnifiedAIClient] Gemini failed, falling back to Groq');
                const fallbackResult = await this.tryProvider(
                    'groq',
                    messages,
                    { ...options, correlationId },
                    attemptedModels,
                    models
                );
                if (fallbackResult.success) {
                    if (fallbackResult.modelUsed && fallbackResult.provider) {
                        void logSystemEvent({
                            type: 'llm_request',
                            correlationId,
                            metadata: {
                                useCase,
                                model_id: fallbackResult.modelUsed,
                                provider: fallbackResult.provider,
                                duration_ms: Date.now() - callStart,
                                messageCount: messages.length,
                            },
                        });
                    }
                    return fallbackResult;
                }
            }

            return {
                success: false,
                error: 'All allowed models failed.',
                attemptedModels,
            };
        }

        // (AWS Bedrock primary path removed — free providers Groq/Gemini serve all traffic.)

        // ── FALLBACK: DB-routed free providers (Groq/Gemini) ────────────
        const crossTierFallbackEnabled = await isCrossTierFallbackEnabled();
        const routingStages = buildRoutingStagePlan(useCase, crossTierFallbackEnabled);
        const allActiveModels = await getActiveModels();

        for (const routingStage of routingStages) {
            const stageModels = routingStage.stage === 'emergency'
                ? getEmergencyFallbackModels(routingStage.useCase)
                : await getModelsForUseCase(routingStage.useCase);

            if (stageModels.length === 0) {
                continue;
            }

            if (routingStage.stage === 'secondary') {
                console.warn(
                    `[UnifiedAIClient] Primary ${useCase} routing exhausted, entering deterministic secondary stage (${routingStage.useCase}).`
                );
            }

            if (routingStage.stage === 'emergency') {
                console.warn(
                    `[UnifiedAIClient] Entering emergency fallback stage for ${routingStage.useCase}.`
                );
            }

            for (const routed of stageModels) {
                if (attemptedModels.includes(routed.modelId)) continue;

                const modelConfig = resolveToModelConfig(routed);
                const rateLimit = await this.rateLimiter.canUseModel(
                    modelConfig.id,
                    allActiveModels,
                    options.estimatedTokens
                );
                if (!rateLimit.allowed) continue;

                const maxTokens = routed.maxTokensOverride ?? options.maxTokens;
                const result = await this.callModel(modelConfig, messages, { ...options, maxTokens, correlationId });
                attemptedModels.push(modelConfig.id);

                if (result.success) {
                    const tokensUsed = Math.ceil((result.response?.length || 0) / 4);
                    this.rateLimiter.recordRequest(modelConfig.id, tokensUsed);
                    if (options.userId && options.sessionId && tokensUsed > 0) {
                        void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                    }
                    void logSystemEvent({
                        type: 'llm_request',
                        correlationId,
                        metadata: {
                            useCase,
                            model_id: modelConfig.id,
                            provider: modelConfig.provider,
                            duration_ms: Date.now() - callStart,
                            messageCount: messages.length,
                        },
                    });
                    return {
                        success: true,
                        modelUsed: modelConfig.id,
                        provider: modelConfig.provider,
                        response: result.response,
                        attemptedModels,
                    };
                }

                this.rateLimiter.recordError(modelConfig.id, result.error);
                console.warn(`[UnifiedAIClient] Model ${modelConfig.id} failed: ${result.error}`);
            }
        }

        return {
            success: false,
            error: "All allowed models failed.",
            attemptedModels
        };
    }

    /**
     * Try all available models for a specific provider
     */
    async tryProvider(
        provider: Provider,
        messages: Message[],
        options: CompletionOptions,
        attemptedModels: string[],
        activeModels: ModelConfig[]
    ): Promise<CompletionResult> {
        // Get models for this provider
        const models = activeModels.filter(m => m.provider === provider);

        // Sort by tier (lower is better/higher priority)
        models.sort((a, b) => a.tier - b.tier);

        for (const model of models) {
            // Check Rate Limiter
            const rateLimit = await this.rateLimiter.canUseModel(model.id, activeModels, options.estimatedTokens);
            if (!rateLimit.allowed) {
                continue;
            }

            // Attempt Call
            const result = await this.callModel(model, messages, options);
            attemptedModels.push(model.id);

            if (result.success) {
                // Record Success
                // Estimate tokens from response length if not provided (4 chars ~= 1 token)
                const tokensUsed = Math.ceil((result.response?.length || 0) / 4);
                this.rateLimiter.recordRequest(model.id, tokensUsed);
                if (options.userId && options.sessionId && tokensUsed > 0) {
                    void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                }

                return {
                    success: true,
                    modelUsed: model.id,
                    provider: model.provider,
                    response: result.response,
                    attemptedModels
                };
            } else {
                // Record Failure
                this.rateLimiter.recordError(model.id, result.error);
                console.warn(`[UnifiedAIClient] Model ${model.id} failed: ${result.error}`);
            }
        }

        return { success: false, attemptedModels };
    }

    /**
     * Execute specific model call via Fetch
     */
    async callModel(
        model: ModelConfig,
        messages: Message[],
        options: CompletionOptions
    ): Promise<{ success: boolean; response?: string; error?: string }> {
        try {
            if (model.provider === 'groq') {
                return await this.callGroq(model.id, messages, options);
            } else if (model.provider === 'gemini') {
                return await this.callGemini(model.id, messages, options);
            }
            return { success: false, error: "Unsupported provider" };
        } catch (error) {
            if (error instanceof Error && error.name === 'TimeoutError') {
                void logSystemEvent({ type: 'model_timeout', provider: model.provider, modelId: model.id, correlationId: options.correlationId });
                return {
                    success: false,
                    error: `Request timeout after ${model.provider === 'groq' ? '15' : model.provider === 'gemini' ? '25' : '30'}s`
                };
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCodeMatch = errorMessage.match(/\((\d{3})\)/);
            const errorCode = errorCodeMatch ? errorCodeMatch[1] : undefined;

            if (errorCode === '429') {
                void logSystemEvent({ type: 'model_429', provider: model.provider, modelId: model.id, errorCode: '429', correlationId: options.correlationId });
            } else if (errorCode === '404') {
                void logSystemEvent({ type: 'model_deprecated', provider: model.provider, modelId: model.id, errorCode: '404', correlationId: options.correlationId });
            } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('fetch failed')) {
                void logSystemEvent({ type: 'model_timeout', provider: model.provider, modelId: model.id, correlationId: options.correlationId });
            } else {
                void logSystemEvent({ type: 'model_error', provider: model.provider, modelId: model.id, errorMessage, correlationId: options.correlationId });
            }

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Call Groq API
     */
    private async callGroq(
        modelId: string,
        messages: Message[],
        options: CompletionOptions
    ) {
        const groqKey = nextGroqKey();
        if (!groqKey) return { success: false, error: "Missing GROQ_API_KEY" };

        const systemPrompt = options.systemPrompt;
        const apiMessages = [...messages];

        // Prepend system prompt if exists and not already in messages
        if (systemPrompt && apiMessages[0]?.role !== 'system') {
            apiMessages.unshift({ role: 'system', content: systemPrompt });
        }

        const body: Record<string, unknown> = {
            model: modelId,
            messages: apiMessages,
            max_tokens: options.maxTokens,
            temperature: options.temperature ?? 0.7,
        };

        if (options.responseFormat) {
            body.response_format = options.responseFormat;
        }

        const response = await fetch(this.GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: options.signal ?? AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Error (${response.status}): ${err}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) return { success: false, error: "Empty response from Groq" };

        return { success: true, response: content };
    }

    /**
     * Call Gemini API
     */
    private async callGemini(
        modelId: string,
        messages: Message[],
        options: CompletionOptions
    ) {
        const apiKey = nextGeminiKey();
        if (!apiKey) return { success: false, error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY" };

        const url = `${this.GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`;

        // Convert messages to Gemini format
        // System prompt is separate in v1beta
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const systemInstruction = options.systemPrompt
            ? { parts: [{ text: options.systemPrompt }] }
            : (messages.find(m => m.role === 'system')
                ? { parts: [{ text: messages.find(m => m.role === 'system')!.content }] }
                : undefined);

        const body: {
            contents: { role: string; parts: { text: string }[] }[];
            generationConfig: { maxOutputTokens?: number; temperature: number };
            systemInstruction?: { parts: { text: string }[] };
        } = {
            contents,
            generationConfig: {
                maxOutputTokens: options.maxTokens,
                temperature: options.temperature ?? 0.7,
            }
        };

        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options.signal ?? AbortSignal.timeout(25000),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${err}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) return { success: false, error: "Empty response from Gemini" };

        return { success: true, response: content };
    }

    /**
     * Helper to try all Groq models specifically
     */
    async tryAllGroqModels(messages: Message[], options: CompletionOptions) {
        const models = await getActiveModels();
        return this.tryProvider('groq', messages, options, [], models);
    }

    // --- Legacy / Compatibility Methods ---

    /**
     * Legacy chat method for backward compatibility
     */
    async chat(messages: Message[], options: { preferredTier?: string; maxTokens?: number; temperature?: number; systemPrompt?: string } = {}) {
        const result = await this.generateCompletion(messages, {
            preferredProvider: options.preferredTier ? 'groq' : undefined, // loose mapping
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            systemPrompt: options.systemPrompt
        });

        if (!result.success) {
            throw new Error(result.error || "Chat generation failed");
        }

        // Return format expected by legacy code
        return {
            response: result.response,
            modelUsed: result.modelUsed,
            provider: result.provider
        };
    }

    // --- Smart Routing (Intent-Classified) ---

    /**
     * Check if smart routing is enabled via env var.
     * The feature-flags module is 'use client', so we check the env var directly
     * for server-side code.
     */
    private isSmartRoutingEnabled(): boolean {
        const envVal = process.env.NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING;
        return envVal === 'true' || envVal === '1';
    }

    /**
     * Strip internal reasoning tokens from AI output before returning to callers.
     * Handles all known tag variants across providers.
     * Operates on the complete response string — for streaming use the stateful
     * buffer in generateStream() (Phase 2).
     */
    private stripThinkingTokens(raw: string): string {
        return raw
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            .trim();
    }

    /**
     * Generate a response with intelligent model routing.
     *
     * When `preferredModel` is `'auto'` (default when smart routing is enabled),
     * the last user message is classified and routed to the optimal provider.
     *
     * Backward-compatible: callers can still pass `'groq'` or `'gemini'` to
     * force a specific provider.
     */
    async generateResponse(
        messages: Message[],
        options: GenerateResponseOptions = {}
    ): Promise<AIResponse> {
        const totalStart = performance.now();

        // Resolve preferred model
        let preferredModel = options.preferredModel ?? 'auto';

        // If smart routing is disabled, 'auto' falls back to legacy behavior (groq-first)
        if (preferredModel === 'auto' && !this.isSmartRoutingEnabled()) {
            preferredModel = 'groq';
        }

        // ── Response Cache check (before any AI call) ─────────────────
        const isProduction = process.env.NODE_ENV === 'production';
        const forceEnable = process.env.CACHE_BACKEND === 'memory'; // Escape hatch
        const cacheEnabled = (
            (process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' || process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1') &&
            (!isProduction || forceEnable)
        );

        if (cacheEnabled) {
            const cache = getResponseCache();
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const cacheQuery = lastUserMsg?.content ?? '';
            const cacheIdentity: CacheIdentity = {
                modelId: preferredModel !== 'auto' ? preferredModel : undefined,
                promptVersion: options.promptVersion,
                ragContextHash: options.ragContextHash,
                languageCode: options.languageCode,
            };
            const cached = await cache.get(cacheQuery, cacheIdentity);

            if (cached) {
                const totalTimeMs = performance.now() - totalStart;
                console.log(
                    `⚡ [Cache HIT] "${cacheQuery.slice(0, 50)}" → ${cached.model} ` +
                    `(hits: ${cached.hitCount}, saved ~${cached.avgLatency.toFixed(0)}ms)`
                );
                return {
                    response: this.stripThinkingTokens(cached.response),
                    success: true,
                    modelUsed: cached.model,
                    attemptedModels: [],
                    routing: {
                        classification: {
                            complexity: 'simple' as const,
                            category: 'greeting' as const,
                            confidence: 1.0,
                            suggestedModel: cached.model,
                            reasoning: 'response_cache_hit',
                        },
                        routedTo: cached.model,
                        classificationTimeMs: 0,
                        totalTimeMs,
                        smartRoutingUsed: false,
                    },
                };
            }
        }

        // Direct provider override (no classification needed)
        if (preferredModel !== 'auto') {
            const result = await this.generateCompletion(messages, {
                preferredProvider: preferredModel as Provider,
                maxTokens: options.maxTokens,
                temperature: options.temperature,
                systemPrompt: options.systemPrompt,
                estimatedTokens: options.estimatedTokens,
                category: options.category,
                signal: options.signal,
                correlationId: options.correlationId,
                userId: options.userId,
                sessionId: options.sessionId,
            });

            if (result.response) {
                result.response = this.stripThinkingTokens(result.response);
            }

            return {
                ...result,
                routing: undefined, // No smart routing metadata
            };
        }

        // --- Smart Routing: classify and route ---
        const classifier = getIntentClassifier();
        const telemetry = getModelTelemetry();

        // Extract last user message for classification
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        const query = lastUserMsg?.content ?? '';

        // Classify intent
        const classifyStart = performance.now();
        const classification = await classifier.classify(query);
        const classificationTimeMs = performance.now() - classifyStart;

        const routedTo = classification.suggestedModel;

        console.log(
            `🧠 [SmartRouting] "${query.slice(0, 60)}${query.length > 60 ? '...' : ''}" → ` +
            `${classification.complexity}/${classification.category} → ${routedTo} ` +
            `(conf: ${classification.confidence.toFixed(2)}, ${classificationTimeMs.toFixed(1)}ms)`
        );

        // Streaming optimization: simple queries skip streaming for lower latency

        // Try routed provider first
        let result = await this.generateCompletion(messages, {
            preferredProvider: routedTo as Provider,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            systemPrompt: options.systemPrompt,
            estimatedTokens: options.estimatedTokens,
            category: options.category,
            signal: options.signal,
            correlationId: options.correlationId,
            userId: options.userId,
            sessionId: options.sessionId,
        });

        // Fallback: if routed provider failed, try the alternate (only if it was gemini)
        if (!result.success && routedTo === 'gemini') {
            const fallbackProvider = 'groq';
            console.warn(
                `⚠️ [SmartRouting] ${routedTo} failed, falling back to ${fallbackProvider}`
            );
            result = await this.generateCompletion(messages, {
                preferredProvider: fallbackProvider as Provider,
                maxTokens: options.maxTokens,
                temperature: options.temperature,
                systemPrompt: options.systemPrompt,
                estimatedTokens: options.estimatedTokens,
                category: options.category,
                signal: options.signal,
                correlationId: options.correlationId,
                userId: options.userId,
                sessionId: options.sessionId,
            });
        }

        const totalTimeMs = performance.now() - totalStart;

        // Record telemetry
        telemetry.recordDecision({
            timestamp: Date.now(),
            query,
            complexity: classification.complexity,
            category: classification.category,
            confidence: classification.confidence,
            routedTo,
            actualModel: result.modelUsed || 'unknown',
            smartRouting: true,
            classificationTimeMs,
            totalTimeMs,
            success: result.success,
        });

        if (result.response) {
            result.response = this.stripThinkingTokens(result.response);
        }

        return {
            ...result,
            routing: {
                classification,
                routedTo,
                classificationTimeMs,
                totalTimeMs,
                smartRoutingUsed: true,
            },
        };
    }

    // ─── Streaming (Phase 2) ────────────────────────────────────────────
    //
    // generateStream() yields AI response chunks as they arrive from the
    // provider. Think/reasoning tags are filtered with a stateful buffer
    // so tag boundaries split across chunks are handled correctly.
    //
    // Caller is responsible for assembling chunks into a full response.

    /**
     * Stream AI response tokens. Async generator — use `for await`.
     * Strips <think>, <thinking>, <reasoning> across chunk boundaries.
     */
    async *generateStream(
        messages: Message[],
        options: Pick<GenerateResponseOptions,
            | 'systemPrompt'
            | 'maxTokens'
            | 'temperature'
            | 'signal'
            | 'correlationId'
            | 'userId'
            | 'sessionId'
        > & { preferredModel?: 'groq' | 'gemini' | 'auto' } = {}
    ): AsyncGenerator<string> {
        const preferredModel = options.preferredModel ?? 'groq';
        this.lastStream = null; // reset so a stale value from a prior call is never reported

        // 'gemini' is forced only when explicitly requested. 'auto'/'groq' stream via Groq
        // (fast, with connection-level failover across Groq models) and fall back to Gemini
        // ONLY if the entire Groq stage fails before emitting any token — so a Groq outage
        // still yields a response, without ever duplicating a partially-streamed reply.
        if (preferredModel === 'gemini') {
            yield* this.streamGemini(messages, options);
            return;
        }

        let emitted = false;
        try {
            for await (const chunk of this.streamGroq(messages, options)) {
                emitted = true;
                yield chunk;
            }
        } catch (groqErr) {
            if (emitted) throw groqErr; // already streamed part of a reply — don't duplicate
            console.warn('[UnifiedAIClient] Groq streaming failed before any token; falling back to Gemini:', groqErr instanceof Error ? groqErr.message : groqErr);
            yield* this.streamGemini(messages, options);
        }
    }

    /**
     * Stateful think-tag filter. Wraps any AsyncIterable<string> and strips
     * <think|thinking|reasoning>...</...> regions even when tags span chunks.
     *
     * Maintains a small trailing buffer (20 chars) when not filtering, so a
     * partial tag start at the very end of a chunk is not yielded prematurely.
     */
    private async *filterThinkTags(
        source: AsyncIterable<string>,
        signal?: AbortSignal
    ): AsyncGenerator<string> {
        const TAG_PAIRS: Array<{ open: RegExp; close: string }> = [
            { open: /<think\b/i,     close: '</think>'     },
            { open: /<thinking\b/i,  close: '</thinking>'  },
            { open: /<reasoning\b/i, close: '</reasoning>' },
        ];

        let isFiltering = false;
        let activeClose = '';
        let buf = '';

        for await (const raw of source) {
            if (signal?.aborted) return;
            buf += raw;

            while (buf.length > 0) {
                if (!isFiltering) {
                    // Find earliest opening tag in buf
                    let earliest = -1;
                    let earliestClose = '';

                    for (const { open, close } of TAG_PAIRS) {
                        const m = open.exec(buf);
                        if (m && (earliest === -1 || m.index < earliest)) {
                            earliest = m.index;
                            earliestClose = close;
                        }
                    }

                    if (earliest === -1) {
                        // No opening tag found — yield everything except a
                        // trailing 20-char safety margin (protects partial tag starts)
                        if (buf.length > 20) {
                            yield buf.slice(0, buf.length - 20);
                            buf = buf.slice(buf.length - 20);
                        }
                        break;
                    }

                    // Yield content before the tag
                    if (earliest > 0) {
                        yield buf.slice(0, earliest);
                        buf = buf.slice(earliest);
                    }

                    // Find the end of the opening tag (the '>')
                    const closeAngle = buf.indexOf('>');
                    if (closeAngle === -1) {
                        // Tag not yet complete — wait for more chunks
                        break;
                    }

                    isFiltering = true;
                    activeClose = earliestClose;
                    buf = buf.slice(closeAngle + 1);
                } else {
                    // Inside a think tag — scan for closing tag
                    const closeIdx = buf.toLowerCase().indexOf(activeClose.toLowerCase());
                    if (closeIdx === -1) {
                        // Closing tag not in buffer yet — discard all but last
                        // activeClose.length chars (in case closer spans chunks)
                        const safeDiscard = buf.length - activeClose.length;
                        if (safeDiscard > 0) buf = buf.slice(safeDiscard);
                        break;
                    }

                    // Found closing tag — discard up to and including it
                    isFiltering = false;
                    buf = buf.slice(closeIdx + activeClose.length);
                    activeClose = '';
                }
            }
        }

        // Flush remaining buffer (only if not inside a tag)
        if (!isFiltering && buf.trim().length > 0) {
            yield buf;
        }
    }

    /** Groq streaming provider — OpenAI-compatible SSE */
    private async *streamGroq(
        messages: Message[],
        options: NonNullable<Parameters<UnifiedAIClient['generateStream']>[1]>
    ): AsyncGenerator<string> {
        if (groqKeyPool().length === 0) throw new Error('Missing GROQ_API_KEY');

        const models = await getActiveModels();
        const groqModels = models.filter(m => m.provider === 'groq');
        const candidates = groqModels.length ? groqModels.map(m => m.id) : ['openai/gpt-oss-120b'];

        const apiMessages = [...messages];
        if (options.systemPrompt && apiMessages[0]?.role !== 'system') {
            apiMessages.unshift({ role: 'system', content: options.systemPrompt });
        }

        // Connection-level failover: try each active Groq model until one connects OK.
        // We only commit to a model once the response is OK (before yielding any tokens),
        // so a dead/rate-limited model no longer dead-ends the whole stream (BUG-18).
        let response: Response | null = null;
        let lastErr = '';
        for (const modelId of candidates) {
            try {
                const r = await fetch(this.GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${nextGroqKey()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: apiMessages,
                        max_tokens: options.maxTokens ?? 4096,
                        temperature: options.temperature ?? 0.7,
                        stream: true,
                    }),
                    signal: options.signal ?? AbortSignal.timeout(30000),
                });
                if (r.ok && r.body) { response = r; this.lastStream = { model: modelId, provider: 'groq' }; break; }
                lastErr = `Groq ${modelId} (${r.status}): ${(await r.text().catch(() => '')).slice(0, 120)}`;
            } catch (e) {
                lastErr = `Groq ${modelId}: ${e instanceof Error ? e.message : String(e)}`;
            }
        }

        if (!response || !response.body) {
            throw new Error(`Groq stream error — all models failed. ${lastErr}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const rawChunks = this.readOpenAIStreamChunks(reader, decoder, options.signal);
        yield* this.filterThinkTags(rawChunks, options.signal);
    }

    /** Shared SSE reader for OpenAI-compatible streams (Groq). */
    private async *readOpenAIStreamChunks(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        decoder: TextDecoder,
        signal?: AbortSignal
    ): AsyncGenerator<string> {
        let leftover = '';
        while (true) {
            if (signal?.aborted) return;
            const { done, value } = await reader.read();
            if (done) break;

            const text = leftover + decoder.decode(value, { stream: true });
            const lines = text.split('\n');
            leftover = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') return;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (typeof delta === 'string' && delta) yield delta;
                } catch {
                    // Malformed SSE line — skip
                }
            }
        }
    }

    /** Gemini streaming provider — streamGenerateContent + alt=sse */
    private async *streamGemini(
        messages: Message[],
        options: NonNullable<Parameters<UnifiedAIClient['generateStream']>[1]>
    ): AsyncGenerator<string> {
        if (geminiKeyPool().length === 0) throw new Error('Missing GEMINI_API_KEY');

        const models = await getActiveModels();
        const geminiModels = models.filter(m => m.provider === 'gemini');
        const candidates = geminiModels.length ? geminiModels.map(m => m.id) : ['gemini-3.5-flash'];

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const systemInstruction = options.systemPrompt
            ? { parts: [{ text: options.systemPrompt }] }
            : undefined;

        // Connection-level failover: try each active Gemini model until one connects OK,
        // committing only before any tokens are yielded (BUG-18).
        let response: Response | null = null;
        let lastErr = '';
        for (const modelId of candidates) {
            try {
                const apiKey = nextGeminiKey()!;
                const url = `${this.GEMINI_API_BASE}/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        systemInstruction,
                        generationConfig: {
                            maxOutputTokens: options.maxTokens ?? 4096,
                            temperature: options.temperature ?? 0.7,
                        },
                    }),
                    signal: options.signal ?? AbortSignal.timeout(30000),
                });
                if (r.ok && r.body) { response = r; this.lastStream = { model: modelId, provider: 'gemini' }; break; }
                lastErr = `Gemini ${modelId} (${r.status}): ${(await r.text().catch(() => '')).slice(0, 120)}`;
            } catch (e) {
                lastErr = `Gemini ${modelId}: ${e instanceof Error ? e.message : String(e)}`;
            }
        }

        if (!response || !response.body) {
            throw new Error(`Gemini stream error — all models failed. ${lastErr}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const rawChunks = (async function* () {
            let leftover = '';
            while (true) {
                if (options.signal?.aborted) return;
                const { done, value } = await reader.read();
                if (done) break;
                const text = leftover + decoder.decode(value, { stream: true });
                const lines = text.split('\n');
                leftover = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') return;
                    try {
                        const parsed = JSON.parse(data);
                        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (typeof chunk === 'string' && chunk) yield chunk;
                    } catch {
                        // Skip malformed
                    }
                }
            }
        })();

        yield* this.filterThinkTags(rawChunks, options.signal);
    }

    /**
     * Store a successful AI response in cache (if cache is enabled).
     * Called externally after streaming completes or response is finalized.
     */
    storeInCache(
        query: string,
        response: string,
        model: 'groq' | 'gemini',
        latencyMs: number,
        identity?: CacheIdentity
    ): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const forceEnable = process.env.CACHE_BACKEND === 'memory';
        const cacheEnabled = (
            (process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' || process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1') &&
            (!isProduction || forceEnable)
        );
        if (!cacheEnabled) return;

        const cache = getResponseCache();
        if (identity) {
            void cache.set(query, response, {
                model,
                avgLatency: latencyMs,
                identity,
            });
            return;
        }

        void cache.set(query, response, model, latencyMs);
    }

    // --- Health Check & Admin Methods ---

    /**
     * Comprehensive health check for all models
     * Fails fast (timeout 3s) and returns detailed status
     */
    /**
     * Comprehensive health check for all models
     * Fails fast (timeout 3s) and returns detailed status
     */
    async checkAllModels(): Promise<Record<string, {
        available: boolean;
        latency?: number;
        error?: string;
        method: 'direct_check' | 'provider_representative_check' | 'heuristic';
        status: 'available' | 'unavailable' | 'unknown';
    }>> {
        const results: Record<string, {
            available: boolean;
            latency?: number;
            error?: string;
            method: 'direct_check' | 'provider_representative_check' | 'heuristic';
            status: 'available' | 'unavailable' | 'unknown';
        }> = {};

        const models = await getActiveModels();

        // Ping the first ACTIVE model of each provider (derived from config, never a
        // hardcoded/decommissioned id). Fallbacks are provider-verified live IDs.
        const GROQ_PING_MODEL = models.find(m => m.provider === 'groq')?.id ?? 'openai/gpt-oss-120b';
        const GEMINI_PING_MODEL = models.find(m => m.provider === 'gemini')?.id ?? 'gemini-3.5-flash';

        // 1. Check Groq Availability (Representative)
        let groqResult: { available: boolean; latency: number; error?: string } = { available: false, latency: 0, error: "Provider Unreachable" };
        try {
            const start = Date.now();
            await this.callGroq(GROQ_PING_MODEL, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
            groqResult = { available: true, latency: Date.now() - start, error: undefined };
        } catch (e: unknown) {
            groqResult.error = e instanceof Error ? e.message : String(e) || "Provider Unreachable";
        }

        // 2. Check Gemini Availability (Representative)
        let geminiResult: { available: boolean; latency: number; error?: string } = { available: false, latency: 0, error: "Provider Unreachable" };
        try {
            const start = Date.now();
            await this.callGemini(GEMINI_PING_MODEL, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
            geminiResult = { available: true, latency: Date.now() - start, error: undefined };
        } catch (e: unknown) {
            geminiResult.error = e instanceof Error ? e.message : String(e) || "Provider Unreachable";
        }

        // 3. Map status to all models with honest reporting.
        //    (A per-provider representative check; use the on-demand Verify for exact per-model status.)
        for (const model of models) {
            // B. Handle Groq Models
            if (model.provider === 'groq') {
                const isPingModel = model.id === GROQ_PING_MODEL;
                results[model.id] = {
                    available: groqResult.available,
                    latency: groqResult.available ? groqResult.latency : undefined,
                    error: groqResult.available ? undefined : groqResult.error,
                    method: isPingModel ? 'direct_check' : 'provider_representative_check',
                    status: groqResult.available ? 'available' : 'unavailable'
                };
            }
            // C. Handle Gemini Models
            else if (model.provider === 'gemini') {
                const isPingModel = model.id === GEMINI_PING_MODEL;
                results[model.id] = {
                    available: geminiResult.available,
                    latency: geminiResult.available ? geminiResult.latency : undefined,
                    error: geminiResult.available ? undefined : geminiResult.error,
                    method: isPingModel ? 'direct_check' : 'provider_representative_check',
                    status: geminiResult.available ? 'available' : 'unavailable'
                };
            }
        }

        return results;
    }

    /**
     * Check a SPECIFIC model on demand (Admin feature)
     * Real API call with 3s timeout
     */
    async checkSpecificModel(modelId: string): Promise<{
        available: boolean;
        latency?: number;
        error?: string;
        method: 'direct_check';
        status: 'available' | 'unavailable';
    }> {
        const models = await getActiveModels();
        const model = models.find(m => m.id === modelId);
        if (!model) {
            return {
                available: false,
                error: `Model ID ${modelId} not found in configuration`,
                method: 'direct_check',
                status: 'unavailable'
            };
        }

        try {
            const start = Date.now();

            // Create a promise that rejects after 3 seconds
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Health check timeout (3s)")), 3000);
            });

            // Call the model
            const callPromise = this.callModel(model, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });

            // Race against timeout
            const result = await Promise.race([callPromise, timeoutPromise]) as CompletionResult;

            if (!result.success) {
                throw new Error(result.error || "Unknown error");
            }

            return {
                available: true,
                latency: Date.now() - start,
                method: 'direct_check',
                status: 'available'
            };

        } catch (error: unknown) {
            return {
                available: false,
                error: error instanceof Error ? error.message : String(error),
                method: 'direct_check',
                status: 'unavailable'
            };
        }
    }

    /**
     * Health Check (Quick connectivity test)
     */
    async runHealthCheck() {
        return this.checkAllModels();
    }

    async getRateLimiterStatus() {
        const models = await getActiveModels();
        return {
            usage: await this.rateLimiter.getUsageStats(),
            remaining: await this.rateLimiter.getRemainingCapacity(models)
        };
    }

    // Kept for legacy compatibility if called directly
    async getRateLimitStatus() {
        return this.getRateLimiterStatus();
    }

    // --- Embedding Support (Restored for RAG compatibility) ---
    // User asked for "Direct API calls". I should implement Gemini Embeddings via REST.
    // Local Embeddings can remain as compatible via Xenova.

    async embed(
        texts: string | string[],
        options: { correlationId?: string } = {}
    ): Promise<{ embeddings: number[][]; modelUsed: string; dimensions: number }> {
        const textArray = Array.isArray(texts) ? texts : [texts];

        // Gemini is the sole embeddings provider (AWS Bedrock/Titan removed).
        const geminiKey = nextGeminiKey();
        if (geminiKey) {
            try {
                const results = await Promise.all(textArray.map(t => this.embedWithGemini(t, geminiKey)));
                if (results.every((r: number[]) => r.length > 0)) {
                    return {
                        embeddings: results,
                        modelUsed: EMBEDDING_MODEL_ID,
                        dimensions: results[0]?.length ?? EMBEDDING_DIMENSIONS,
                    };
                }
                throw new Error('Gemini returned an empty embedding vector');
            } catch (e) {
                console.warn('⚠️ Gemini embedding failed:', e instanceof Error ? e.message : e);
                void logSystemEvent({ type: 'embedding_failed', provider: 'gemini', correlationId: options.correlationId });
            }
        }

        // Embeddings provider unavailable — RAG context is unavailable (graceful degradation).
        console.error('❌ Embedding provider unavailable. Interview will proceed without RAG context.');
        void logSystemEvent({ type: 'embedding_failed', errorMessage: 'Gemini embedding unavailable', correlationId: options.correlationId });
        throw new Error('Embedding provider unavailable. RAG context unavailable.');
    }

    private async embedWithGemini(text: string, apiKey: string): Promise<number[]> {
        // gemini-embedding-001 defaults to 3072 dims; the knowledge_chunks corpus is 768-dim,
        // so we pin outputDimensionality to EMBEDDING_DIMENSIONS to keep query/corpus dims aligned.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL_ID}:embedContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: { parts: [{ text }] },
                outputDimensionality: EMBEDDING_DIMENSIONS,
            }),
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gemini embed API error (${response.status}): ${errBody.substring(0, 100)}`);
        }

        const data = await response.json();
        return data.embedding?.values || [];
    }

    // Remnant of local embedder removed
}

// Singleton instance
let clientInstance: UnifiedAIClient | null = null;

export function getAIClient(): UnifiedAIClient {
    if (!clientInstance) {
        clientInstance = new UnifiedAIClient();
    }
    return clientInstance;
}

// Helper exports for backward compatibility and RAG imports
export async function chat(
    messages: Message[],
    options: { preferredTier?: string; maxTokens?: number; temperature?: number; systemPrompt?: string } = {}
) {
    return getAIClient().chat(messages, options);
}

export async function embed(
    texts: string | string[],
    options: { correlationId?: string } = {}
) {
    return getAIClient().embed(texts, options);
}
