// Unified AI Client with Multi-Provider Support
// When AWS Bedrock flag is ON, Bedrock models are PRIMARY (tried first).
// When OFF, uses Gemini/Groq with automatic rate-limit-based fallback.
// DB-driven model routing with cross-tier fallback
// DIRECT API CALLS implementation (No SDKs)

import { CHAT_MODELS, ModelConfig, Provider } from './providers';
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
    private readonly GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

    constructor() {
        this.rateLimiter = getRateLimiter();
        this.validateConfig();
    }

    private validateConfig() {
        if (!process.env.GROQ_API_KEY) {
            console.warn("Using UnifiedAIClient without GROQ_API_KEY");
        }
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
            console.warn("Using UnifiedAIClient without GEMINI_API_KEY or GOOGLE_API_KEY");
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

        // ── PRIMARY: Bedrock (when ENABLE_AWS_BEDROCK is ON) ────────────
        // When the flag is ON, Bedrock is the primary provider.
        // Free providers (Groq/Gemini) become the fallback.
        if (process.env.AWS_ACCESS_KEY_ID) {
            try {
                const { getGlobalFeatureFlag: getFlag } = await import('@/lib/feature-flags-server');
                const bedrockEnabled = await getFlag('ENABLE_AWS_BEDROCK');
                if (bedrockEnabled) {
                    const { callBedrockModel } = await import('./bedrock-client');
                    const { logAWSUsage, estimateBedrockCost } = await import('@/lib/aws/usage-logger');
                    // Get Bedrock models from DB routing table
                    const bedrockModels = (await getModelsForUseCase(useCase)).filter(m => m.provider === 'bedrock');
                    const modelId = bedrockModels.length > 0
                        ? bedrockModels[0].modelId
                        : 'openai.gpt-oss-120b-1:0'; // default Bedrock model when not in DB

                    try {
                        const response = await callBedrockModel(
                            modelId,
                            messages,
                            options.systemPrompt,
                            options.maxTokens
                        );
                        const tokensUsed = Math.ceil(response.length / 4);
                        if (options.userId && options.sessionId && tokensUsed > 0) {
                            void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                        }
                        void logSystemEvent({
                            type: 'llm_request',
                            correlationId,
                            metadata: {
                                useCase,
                                model_id: modelId,
                                provider: 'bedrock',
                                duration_ms: Date.now() - callStart,
                                messageCount: messages.length,
                            },
                        });
                        // Log Bedrock usage for budget tracking
                        const inputChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) + (options.systemPrompt?.length || 0);
                        logAWSUsage({
                            service: 'bedrock',
                            operation: 'InvokeModel',
                            region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
                            bytesProcessed: inputChars + response.length,
                            estimatedCostUsd: estimateBedrockCost(inputChars, response.length),
                            metadata: { model: modelId, useCase, primary: true },
                        }).catch(() => {});
                        return {
                            success: true,
                            modelUsed: modelId,
                            provider: 'bedrock' as Provider,
                            response,
                            attemptedModels: [...attemptedModels, `bedrock-${modelId}`],
                        };
                    } catch (bedrockErr) {
                        console.warn(`[UnifiedAIClient] Bedrock primary (${modelId}) failed, falling back to free providers:`, bedrockErr instanceof Error ? bedrockErr.message : bedrockErr);
                        attemptedModels.push(`bedrock-${modelId}`);
                        // Fall through to free providers below
                    }
                }
            } catch (flagErr) {
                console.warn('[UnifiedAIClient] Could not check Bedrock flag:', flagErr instanceof Error ? flagErr.message : flagErr);
            }
        }

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
            } else if (model.provider === 'bedrock') {
                const { callBedrockModel } = await import('./bedrock-client');
                const response = await callBedrockModel(model.id, messages, options.systemPrompt, options.maxTokens);
                return { success: true, response };
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
        if (!process.env.GROQ_API_KEY) return { success: false, error: "Missing GROQ_API_KEY" };

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
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
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
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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
                    response: cached.response,
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

    /**
     * Store a successful AI response in cache (if cache is enabled).
     * Called externally after streaming completes or response is finalized.
     */
    storeInCache(
        query: string,
        response: string,
        model: 'groq' | 'gemini' | 'bedrock',
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

        // We will test one model per provider to be efficient.
        const GROQ_PING_MODEL = "llama-3.1-8b-instant";
        const GEMINI_PING_MODEL = "gemini-2.0-flash";

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

        const models = await getActiveModels();

        // 3. Map status to all models with honest reporting
        for (const model of models) {
            // A. Handle Preview / Unverified Models (e.g. Gemini 2.5)
            if (model.id.includes('2.5')) {
                results[model.id] = {
                    available: false,
                    status: 'unknown',
                    method: 'heuristic',
                    error: 'Preview model - availability not verified',
                    latency: undefined
                };
                continue;
            }

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

        // When AWS Bedrock is configured, try Titan embeddings FIRST (primary when flag ON)
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            try {
                const { getGlobalFeatureFlag: getFlag } = await import('@/lib/feature-flags-server');
                const bedrockEnabled = await getFlag('ENABLE_AWS_BEDROCK');
                if (bedrockEnabled) {
                    const { generateBedrockEmbedding } = await import('./bedrock-client');
                    const results = await Promise.all(textArray.map(t => generateBedrockEmbedding(t)));
                    if (results.every((r: number[]) => r.length > 0)) {
                        return {
                            embeddings: results,
                            modelUsed: 'amazon.titan-embed-text-v2:0',
                            dimensions: results[0]?.length ?? 1024,
                        };
                    }
                }
            } catch (e) {
                console.warn('⚠️ Bedrock Titan embedding failed, falling back to Gemini:', e instanceof Error ? e.message : e);
                void logSystemEvent({ type: 'embedding_failed', provider: 'bedrock', correlationId: options.correlationId });
            }
        }

        // Fallback: Gemini Embedding
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (geminiKey) {
            try {
                const results = await Promise.all(textArray.map(t => this.embedWithGemini(t, geminiKey)));
                return {
                    embeddings: results,
                    modelUsed: 'gemini-embedding-001',
                    dimensions: results[0]?.length ?? 768,
                };
            } catch (e) {
                console.warn('⚠️ Gemini embedding failed:', e instanceof Error ? e.message : e);
                void logSystemEvent({ type: 'embedding_failed', provider: 'gemini', correlationId: options.correlationId });
            }
        }

        // Last resort: Bedrock Titan without flag check (credentials-only)
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            try {
                const { generateBedrockEmbedding } = await import('./bedrock-client');
                const results = await Promise.all(textArray.map(t => generateBedrockEmbedding(t)));
                if (results.every((r: number[]) => r.length > 0)) {
                    return {
                        embeddings: results,
                        modelUsed: 'amazon.titan-embed-text-v2:0',
                        dimensions: results[0]?.length ?? 1024,
                    };
                }
            } catch (e) {
                console.warn('⚠️ Bedrock embedding (last-resort) also failed:', e instanceof Error ? e.message : e);
            }
        }

        // No local embedder. If both fail, RAG context is unavailable — graceful degradation.
        console.error('❌ All embedding providers failed. Interview will proceed without RAG context.');
        void logSystemEvent({ type: 'embedding_failed', errorMessage: 'All providers failed', correlationId: options.correlationId });
        throw new Error('All embedding providers failed. RAG context unavailable.');
    }

    private async embedWithGemini(text: string, apiKey: string): Promise<number[]> {
        // Use v1beta for gemini-embedding-001
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: { parts: [{ text }] }
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
