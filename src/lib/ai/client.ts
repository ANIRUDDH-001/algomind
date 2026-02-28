// Unified AI Client with Multi-Provider Support
// Automatically falls back between Gemini and Groq based on rate limits
// DIRECT API CALLS implementation (No SDKs)

import { CHAT_MODELS, ModelConfig, Provider } from './providers';
import { getRateLimiter, IntelligentRateLimiter } from './rate-limiter';
import { getIntentClassifier } from './intent-classifier';
import { getModelTelemetry } from '../analytics/model-telemetry';
import { getResponseCache } from './response-cache';
import { getActiveModels } from './model-registry';
import { logSystemEvent } from '../monitoring/events';
import type { GenerateResponseOptions, AIResponse } from './types';

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
}

export interface CompletionResult {
    success: boolean;
    modelUsed?: string;
    provider?: Provider;
    response?: string;
    error?: string;
    attemptedModels: string[];
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
        const { preferredProvider = 'groq' } = options;
        const attemptedModels: string[] = [];

        // FALLBACK RULES:
        // 1. Groq fails -> Try other Groq models ONLY (never Gemini)
        // 2. Gemini fails -> Can try Groq models

        let primaryProvider = preferredProvider;
        if (primaryProvider === 'local') primaryProvider = 'groq'; // 'local' not supported for chat yet, default to groq

        // Strategy:
        // If preferred is Groq: Try Groq models. If all fail, STOP.
        // If preferred is Gemini: Try Gemini models. If all fail, Try Groq models.

        // 1. Try Primary Provider
        const models = await getActiveModels();
        const primaryResult = await this.tryProvider(
            primaryProvider,
            messages,
            options,
            attemptedModels,
            models
        );

        if (primaryResult.success) {
            return primaryResult;
        }

        // 2. Cross-Provider Fallback (Only allowed if Gemini was primary)
        if (primaryProvider === 'gemini') {
            console.warn(`[UnifiedAIClient] Gemini failed, falling back to Groq...`);
            const fallbackResult = await this.tryProvider(
                'groq',
                messages,
                options,
                attemptedModels,
                models
            );

            if (fallbackResult.success) {
                return fallbackResult;
            }
        }

        // 3. Bedrock as final fallback (when both Groq and Gemini fail)
        if (process.env.AWS_ACCESS_KEY_ID) {
            try {
                console.warn('[UnifiedAIClient] All primary providers failed, attempting Bedrock...');
                const { callBedrockClaude } = await import('./bedrock-client');
                const response = await callBedrockClaude(
                    messages,
                    options.systemPrompt,
                    options.maxTokens
                );
                return {
                    success: true,
                    modelUsed: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
                    provider: 'bedrock' as Provider,
                    response,
                    attemptedModels: [...attemptedModels, 'bedrock-claude-3-5-sonnet'],
                };
            } catch (bedrockErr) {
                console.error('[UnifiedAIClient] Bedrock also failed:', bedrockErr);
                attemptedModels.push('bedrock-claude-3-5-sonnet');
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
                const tokensUsed = (result.response?.length || 0) / 4;
                this.rateLimiter.recordRequest(model.id, tokensUsed);

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
                const { callBedrockClaude } = await import('./bedrock-client');
                const response = await callBedrockClaude(messages, options.systemPrompt, options.maxTokens);
                return { success: true, response };
            }
            return { success: false, error: "Unsupported provider" };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCodeMatch = errorMessage.match(/\((\d{3})\)/);
            const errorCode = errorCodeMatch ? errorCodeMatch[1] : undefined;

            if (errorCode === '429') {
                void logSystemEvent({ type: 'model_429', provider: model.provider, modelId: model.id, errorCode: '429' });
            } else if (errorCode === '404') {
                void logSystemEvent({ type: 'model_deprecated', provider: model.provider, modelId: model.id, errorCode: '404' });
            } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('fetch failed')) {
                void logSystemEvent({ type: 'model_timeout', provider: model.provider, modelId: model.id });
            } else {
                void logSystemEvent({ type: 'model_error', provider: model.provider, modelId: model.id, errorMessage });
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

        const body = {
            model: modelId,
            messages: apiMessages,
            max_tokens: options.maxTokens,
            temperature: options.temperature ?? 0.7,
        };

        const response = await fetch(this.GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
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
            body: JSON.stringify(body)
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
            const cached = await cache.get(cacheQuery);

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
        model: 'groq' | 'gemini',
        latencyMs: number
    ): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const forceEnable = process.env.CACHE_BACKEND === 'memory';
        const cacheEnabled = (
            (process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' || process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1') &&
            (!isProduction || forceEnable)
        );
        if (!cacheEnabled) return;

        const cache = getResponseCache();
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

    async embed(texts: string | string[]): Promise<{ embeddings: number[][]; modelUsed: string; dimensions: number }> {
        const textArray = Array.isArray(texts) ? texts : [texts];

        // Primary: Gemini Embedding
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
                void logSystemEvent({ type: 'embedding_failed', provider: 'gemini' });
            }
        }

        // Secondary: AWS Bedrock Titan (if configured)
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
                console.warn('⚠️ Bedrock embedding failed:', e instanceof Error ? e.message : e);
            }
        }

        // No local embedder. If both fail, RAG context is unavailable — graceful degradation.
        console.error('❌ All embedding providers failed. Interview will proceed without RAG context.');
        void logSystemEvent({ type: 'embedding_failed', errorMessage: 'All providers failed' });
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
            })
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
    texts: string | string[]
) {
    return getAIClient().embed(texts);
}
