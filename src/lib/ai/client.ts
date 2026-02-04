// Unified AI Client with Multi-Provider Support
// Automatically falls back between Gemini and Groq based on rate limits

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Groq from "groq-sdk";
import { CHAT_MODELS, EMBEDDING_MODELS, ModelConfig, ModelTier, Provider } from './providers';
import { getRateLimiter, IntelligentRateLimiter } from './rate-limiter';

// Types
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatOptions {
    preferredTier?: ModelTier;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
}

export interface ChatResult {
    response: string;
    modelUsed: string;
    provider: Provider;
    tokensUsed?: number;
}

export interface EmbeddingResult {
    embeddings: number[][];
    modelUsed: string;
    dimensions: number;
}

// Unified AI Client
export class UnifiedAIClient {
    private gemini: GoogleGenerativeAI | null = null;
    private groq: Groq | null = null;
    private rateLimiter: IntelligentRateLimiter;
    private geminiModels: Map<string, GenerativeModel> = new Map();

    constructor() {
        this.rateLimiter = getRateLimiter();
        this.initializeProviders();
    }

    private initializeProviders(): void {
        // Initialize Gemini if API key is available
        if (process.env.GEMINI_API_KEY) {
            this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }

        // Initialize Groq if API key is available
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        if (!this.gemini && !this.groq) {
            console.warn('No AI providers configured. Set GEMINI_API_KEY or GROQ_API_KEY.');
        }
    }

    /**
     * Send a chat request with automatic fallback
     */
    async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResult> {
        const { preferredTier, maxTokens = 2048, temperature = 0.7, systemPrompt } = options;

        // Get available model
        const result = await this.rateLimiter.getAvailableModel(preferredTier);

        if (!result.allowed || !result.model) {
            throw new Error(`Rate limited. ${result.reason} Wait ${result.waitMs}ms`);
        }

        const model = result.model;

        try {
            let response: string;

            if (model.provider === 'gemini') {
                response = await this.chatWithGemini(model.id, messages, { maxTokens, temperature, systemPrompt });
            } else {
                response = await this.chatWithGroq(model.id, messages, { maxTokens, temperature, systemPrompt });
            }

            // Record successful request
            this.rateLimiter.recordRequest(model.id);

            return {
                response,
                modelUsed: model.id,
                provider: model.provider,
            };
        } catch (error) {
            // Record error and try fallback
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.rateLimiter.recordError(model.id, errorMessage);

            // Check if this is a rate limit error and we should retry with next model
            if (this.isRateLimitError(error)) {
                console.warn(`Model ${model.id} rate limited, trying fallback...`);
                return this.chat(messages, { ...options, preferredTier: (model.tier + 1) as ModelTier });
            }

            throw error;
        }
    }

    /**
     * Chat with Gemini
     */
    private async chatWithGemini(
        modelId: string,
        messages: Message[],
        options: { maxTokens: number; temperature: number; systemPrompt?: string }
    ): Promise<string> {
        if (!this.gemini) {
            throw new Error('Gemini not configured. Set GEMINI_API_KEY.');
        }

        // Get or create model instance
        let model = this.geminiModels.get(modelId);
        if (!model) {
            model = this.gemini.getGenerativeModel({
                model: modelId,
                generationConfig: {
                    maxOutputTokens: options.maxTokens,
                    temperature: options.temperature,
                },
            });
            this.geminiModels.set(modelId, model);
        }

        // Build conversation history
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = messages[messages.length - 1];

        // Start chat with system prompt if provided
        const chat = model.startChat({
            history: options.systemPrompt
                ? [{ role: 'user', parts: [{ text: options.systemPrompt }] }, { role: 'model', parts: [{ text: 'Understood.' }] }, ...history]
                : history,
        });

        const result = await chat.sendMessage(lastMessage.content);
        return result.response.text();
    }

    /**
     * Chat with Groq
     */
    private async chatWithGroq(
        modelId: string,
        messages: Message[],
        options: { maxTokens: number; temperature: number; systemPrompt?: string }
    ): Promise<string> {
        if (!this.groq) {
            throw new Error('Groq not configured. Set GROQ_API_KEY.');
        }

        // Build messages array
        const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        if (options.systemPrompt) {
            groqMessages.push({ role: 'system', content: options.systemPrompt });
        }

        for (const msg of messages) {
            groqMessages.push({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
            });
        }

        const completion = await this.groq.chat.completions.create({
            model: modelId,
            messages: groqMessages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
        });

        return completion.choices[0]?.message?.content || '';
    }

    /**
     * Generate embeddings using Gemini
     */
    async embed(texts: string | string[]): Promise<EmbeddingResult> {
        if (!this.gemini) {
            throw new Error('Gemini not configured. Set GEMINI_API_KEY for embeddings.');
        }

        const textArray = Array.isArray(texts) ? texts : [texts];
        const embeddingModel = EMBEDDING_MODELS[0]; // Use primary embedding model

        const model = this.gemini.getGenerativeModel({ model: embeddingModel.id });

        const embeddings: number[][] = [];

        // Process in batches to avoid rate limits
        for (const text of textArray) {
            const result = await model.embedContent(text);
            embeddings.push(result.embedding.values);
        }

        return {
            embeddings,
            modelUsed: embeddingModel.id,
            dimensions: embeddingModel.dimensions,
        };
    }

    /**
     * Check if error is a rate limit error
     */
    private isRateLimitError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return message.includes('rate') ||
                message.includes('limit') ||
                message.includes('quota') ||
                message.includes('429');
        }
        return false;
    }

    /**
     * Check health of all providers
     */
    async healthCheck(): Promise<Record<string, { available: boolean; error?: string }>> {
        const results: Record<string, { available: boolean; error?: string }> = {};

        // Find standard models for health checks from the registry
        const geminiModel = CHAT_MODELS.find(m => m.provider === 'gemini')?.id;
        const groqModel = CHAT_MODELS.find(m => m.provider === 'groq')?.id;

        // Check Gemini
        if (this.gemini && geminiModel) {
            try {
                const model = this.gemini.getGenerativeModel({ model: geminiModel });
                await model.generateContent('Say "ok" if you can read this.');
                results['gemini'] = { available: true };
            } catch (error) {
                results['gemini'] = {
                    available: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        } else {
            results['gemini'] = { available: false, error: this.gemini ? 'No Gemini models in registry' : 'Not configured' };
        }

        // Check Groq
        if (this.groq && groqModel) {
            try {
                await this.groq.chat.completions.create({
                    model: groqModel,
                    messages: [{ role: 'user', content: 'Say "ok"' }],
                    max_tokens: 10,
                });
                results['groq'] = { available: true };
            } catch (error) {
                results['groq'] = {
                    available: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        } else {
            results['groq'] = { available: false, error: this.groq ? 'No Groq models in registry' : 'Not configured' };
        }

        return results;
    }

    /**
     * Get current rate limit status
     */
    getRateLimitStatus() {
        return {
            usage: this.rateLimiter.getUsageStats(),
            remaining: this.rateLimiter.getRemainingCapacity(),
        };
    }
}

// Singleton instance
let clientInstance: UnifiedAIClient | null = null;

export function getAIClient(): UnifiedAIClient {
    if (!clientInstance) {
        clientInstance = new UnifiedAIClient();
    }
    return clientInstance;
}

// Convenience function for simple chat
export async function chat(
    prompt: string,
    options?: ChatOptions
): Promise<ChatResult> {
    return getAIClient().chat([{ role: 'user', content: prompt }], options);
}

// Convenience function for embeddings
export async function embed(texts: string | string[]): Promise<EmbeddingResult> {
    return getAIClient().embed(texts);
}
