// Model Provider Types and Registry
// Supports Groq + Gemini chat fallbacks and Gemini + local embedding fallback

export type Provider = 'gemini' | 'groq' | 'local' | 'bedrock';
export type ModelTier = number;

export interface ModelConfig {
    id: string;
    provider: Provider;
    tier: ModelTier;
    rpm: number;         // requests per minute
    tpm: number;         // tokens per minute
    rpd: number;         // requests per day
    contextWindow: number;
    supportsEmbeddings: boolean;
    description: string;
    notes?: string;
}

export interface EmbeddingModelConfig {
    id: string;
    provider: Provider;
    tier: number;
    rpm: number;
    tpm: number;
    rpd: number;
    dimensions: number;
    description: string;
}

const GROQ_GPT_OSS_MODEL_ID = process.env.GROQ_GPT_OSS_MODEL_ID || "openai/gpt-oss-120b";
const GROQ_GPT_OSS_20B_MODEL_ID = process.env.GROQ_GPT_OSS_20B_MODEL_ID || "openai/gpt-oss-20b";
const GEMINI_FREE_TIER_MODEL_ID = process.env.GEMINI_FREE_TIER_MODEL_ID || "gemini-3.5-flash";

// EMERGENCY FALLBACK: Static model list used only when model_routing DB table
// and Redis cache are both unavailable. Production routing uses model_routing table
// managed from the owner dashboard "AI Routing" tab.
// @deprecated — prefer DB-driven routing via getModelsForUseCase() in model-routing.ts
export const CHAT_MODELS: ModelConfig[] = [
    // --- GROQ MODELS ---
    {
        id: "llama-3.3-70b-versatile", // Mapped from llama-3.3-70b
        provider: 'groq',
        tier: 1,
        rpm: 25.5, // 30 * 0.85
        tpm: 5000, // Placeholder/Default if not specified (using low safe default)
        rpd: 850,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 3.3 70B"
    },
    {
        id: "llama-3.1-8b-instant", // Mapped from llama-3.1-8b
        provider: 'groq',
        tier: 2,
        rpm: 25.5,
        tpm: 5000,
        rpd: 12240,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 3.1 8B"
    },
    {
        id: "qwen/qwen3-32b",
        provider: 'groq',
        tier: 3,
        rpm: 60,
        tpm: 6000,
        rpd: 1000,
        contextWindow: 32768,
        supportsEmbeddings: false,
        description: "Qwen3 32B — 60 RPM, strong multilingual reasoning"
    },
    // gemma2-9b-it removed — decommissioned by Groq Oct 8 2025, replaced by llama-3.1-8b-instant
    // Note: llama-4-scout and llama-4-maverick are now verified IDs
    {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        provider: 'groq',
        tier: 4,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 4 Scout"
    },
    // llama-4-maverick removed — deprecated by Groq March 9 2026, replaced by openai/gpt-oss-120b
    // Replaced moonshotai/kimi-k2-instruct and kimi-k2-instruct-0905 (both deprecated 2025–2026)
    {
        id: GROQ_GPT_OSS_MODEL_ID,
        provider: 'groq',
        tier: 5,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 200000,
        supportsEmbeddings: false,
        description: "Groq GPT-OSS 120B"
    },
    {
        id: GROQ_GPT_OSS_20B_MODEL_ID,
        provider: 'groq',
        tier: 6,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 200000,
        supportsEmbeddings: false,
        description: "Groq GPT-OSS 20B"
    },
    {
        id: "openai/gpt-oss-safeguard-20b", // Safety guard model
        provider: 'groq',
        tier: 99, // Safety tier
        rpm: 100,
        rpd: 1000,
        tpm: 5000,
        contextWindow: 8192,
        supportsEmbeddings: false,
        description: "Safety GPT OSS 20B"
    },

    // --- GEMINI MODELS ---
    // gemini-3.1-flash-lite-preview shutdown May 25, 2026 → migrated to stable
    {
        id: "gemini-3.1-flash-lite",
        provider: 'gemini',
        tier: 10,
        rpm: 15,
        rpd: 500,
        tpm: 250000,
        contextWindow: 1048576,
        supportsEmbeddings: false,
        description: "Gemini 3.1 Flash Lite (Stable)"
    },
    // gemini-3-flash-preview → gemini-3.5-flash (stable release May 19, 2026)
    {
        id: GEMINI_FREE_TIER_MODEL_ID,
        provider: 'gemini',
        tier: 11,
        rpm: 5,
        rpd: 20,
        tpm: 250000,
        contextWindow: 1048576,
        supportsEmbeddings: true,
        description: "Gemini 3.5 Flash (Stable)"
    },
    {
        id: "gemini-2.5-flash",
        provider: 'gemini',
        tier: 12,
        rpm: 5,
        rpd: 20,
        tpm: 250000,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash"
    },
    {
        id: "gemini-2.5-flash-lite",
        provider: 'gemini',
        tier: 11,
        rpm: 10,
        rpd: 20,
        tpm: 250000,
        contextWindow: 1048576,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash Lite — 10 RPM / 20 RPD"
    },
    {
        id: "gemma-3-27b-it",
        provider: 'gemini',
        tier: 12,
        rpm: 30,
        rpd: 14400,
        tpm: 15000,
        contextWindow: 131072,
        supportsEmbeddings: false,
        description: "Gemma 3 27B IT"
    },
];

// Embedding Models
// gemini-embedding-001 shutdown July 14, 2026 → migrated to gemini-embedding-2
export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
    {
        id: "gemini-embedding-2",
        provider: 'gemini',
        tier: 1,
        rpm: 100,
        tpm: 30000,
        rpd: 1000,
        dimensions: 3072,        // gemini-embedding-2 supports up to 3072 dims; default recommended
        description: "Gemini Embedding 2 — primary embeddings provider (replaces gemini-embedding-001, shutdown July 14 2026)"
    }
    // Xenova/all-MiniLM-L6-v2 removed as local huggingface fallback is defunct
];

// Get model by ID
export function getModelConfig(modelId: string): ModelConfig | undefined {
    return CHAT_MODELS.find(m => m.id === modelId);
}

// Get models by provider
export function getModelsByProvider(provider: Provider): ModelConfig[] {
    return CHAT_MODELS.filter(m => m.provider === provider);
}

// Get models by tier (or lower)
export function getModelsUpToTier(tier: ModelTier): ModelConfig[] {
    return CHAT_MODELS.filter(m => m.tier <= tier);
}

// Calculate total daily capacity
export function getTotalDailyCapacity(): number {
    return CHAT_MODELS.reduce((sum, m) => sum + m.rpd, 0);
}

// Calculate total requests per minute capacity
export function getTotalRPMCapacity(): number {
    return CHAT_MODELS.reduce((sum, m) => sum + m.rpm, 0);
}
