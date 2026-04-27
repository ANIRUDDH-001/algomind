// Shared AI types for the intent-classified routing system
// Extracted to avoid circular dependencies between client.ts and intent-classifier.ts

import type { Provider } from './providers';
import type { IntentClassification } from './intent-classifier';

// ── Re-exports (convenience) ────────────────────────────────────────

// Original types still live in client.ts for backward compat;
// import from here for new code.
export type { Message, CompletionOptions, CompletionResult } from './client';
export type { IntentClassification } from './intent-classifier';
export type { Provider } from './providers';

// ── New types for generateResponse() ────────────────────────────────

export interface GenerateResponseOptions {
    /** Model selection: 'auto' runs intent classification, 'groq'/'gemini'/'bedrock' forces provider */
    preferredModel?: 'groq' | 'gemini' | 'bedrock' | 'auto';
    /** Max output tokens */
    maxTokens?: number;
    /** LLM temperature */
    temperature?: number;
    /** System prompt prepended to messages */
    systemPrompt?: string;
    /** Estimated input tokens (for rate limiter) */
    estimatedTokens?: number;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** Category hint (e.g. 'speed', 'reasoning') — forwarded to rate limiter */
    category?: string;
    /** Disables LLM intent classification pass when routing is smart */
    enableLLMPass?: boolean;
    /** Correlation ID propagated from request middleware for tracing */
    correlationId?: string;
    /** Authenticated user identifier for per-user token budget checks */
    userId?: string;
    /** Session identifier for per-session token budget checks */
    sessionId?: string;
    /** Prompt version tag from centralized prompt registry */
    promptVersion?: string;
    /** Canonical language code used for prompt generation */
    languageCode?: string;
    /** Hash of effective RAG context injected into prompt */
    ragContextHash?: string;
}

export interface AIResponse {
    /** Whether the call succeeded */
    success: boolean;
    /** The generated text */
    response?: string;
    /** Which model actually served the response */
    modelUsed?: string;
    /** Which provider served the response */
    provider?: Provider;
    /** Models that were tried before success/failure */
    attemptedModels: string[];
    /** Error message if failed */
    error?: string;
    /** Whether response was degraded by cost guard limits */
    budgetExceeded?: boolean;
    /** Routing metadata (only present when smart routing is active) */
    routing?: {
        classification: IntentClassification;
        routedTo: 'groq' | 'gemini' | 'bedrock';
        classificationTimeMs: number;
        totalTimeMs: number;
        smartRoutingUsed: boolean;
    };
}
