// Model Provider Types and Registry
// Supports Groq + Gemini chat fallbacks and Gemini + local embedding fallback

export type Provider = 'gemini' | 'groq' | 'local';
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
const GEMINI_FREE_TIER_MODEL_ID = process.env.GEMINI_FREE_TIER_MODEL_ID || "gemini-2.0-flash";

// Chat Models Registry - ordered by preference
export const CHAT_MODELS: ModelConfig[] = [
    // Priority 1: Primary high-quality reasoning
    {
        id: "llama-3.3-70b-versatile",
        provider: 'groq',
        tier: 1,
        rpm: 30,
        tpm: 300000,
        rpd: 12000,
        contextWindow: 100000,
        supportsEmbeddings: false,
        description: "Groq Llama 3.3 70B - Primary model for complex reasoning",
        notes: "Large model tier"
    },

    // Priority 2: Fast path for simple tasks
    {
        id: "llama-3.1-8b-instant",
        provider: 'groq',
        tier: 2,
        rpm: 30,
        tpm: 250000,
        rpd: 6000,
        contextWindow: 500000,
        supportsEmbeddings: false,
        description: "Groq Llama 3.1 8B Instant - Low-latency fallback"
    },

    // Priority 3: Heavy open model fallback
    {
        id: GROQ_GPT_OSS_MODEL_ID,
        provider: 'groq',
        tier: 3,
        rpm: 30,
        tpm: 250000,
        rpd: 8000,
        contextWindow: 200000,
        supportsEmbeddings: false,
        description: "Groq GPT-OSS 120B - Multi-step reasoning fallback"
    },

    // Priority 4: Medium-tier OSS fallback
    {
        id: GROQ_GPT_OSS_20B_MODEL_ID,
        provider: 'groq',
        tier: 4,
        rpm: 30,
        tpm: 250000,
        rpd: 8000,
        contextWindow: 200000,
        supportsEmbeddings: false,
        description: "Groq GPT-OSS 20B - Medium fallback for scale"
    },

    // Priority 6: Gemini free-tier high-context fallback
    {
        id: GEMINI_FREE_TIER_MODEL_ID,
        provider: 'gemini',
        tier: 6,
        rpm: 15,
        tpm: 1000000,
        rpd: 1500,
        contextWindow: 1048576,
        supportsEmbeddings: false,
        description: "Gemini 3 Flash free-tier slot (model id configurable if needed)",
        notes: "RPD is shared with flash-lite in free-tier quota pools"
    },

    // Priority 7: High-quality Gemini, use sparingly
    {
        id: "gemini-2.5-flash",
        provider: 'gemini',
        tier: 7,
        rpm: 5,
        tpm: 250000,
        rpd: 20,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash - Highest quality but heavily rate-limited",
        notes: "RPD shared with Gemini 2.5 Flash Lite"
    },

    // Priority 8: Gemini fast variant, still constrained
    {
        id: "gemini-2.5-flash-lite",
        provider: 'gemini',
        tier: 8,
        rpm: 10,
        tpm: 250000,
        rpd: 20,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash Lite - Fast quality fallback",
        notes: "RPD shared with Gemini 2.5 Flash"
    },

    // Priority 9: Open-weight Google fallback
    {
        id: "gemma-3-27b-it",
        provider: 'gemini',
        tier: 9,
        rpm: 30,
        tpm: 15000,
        rpd: 14400,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Gemma 3 27B - Final text fallback"
    },
];

// Embedding Models
export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
    {
        id: "gemini-embedding-001",
        provider: 'gemini',
        tier: 1,
        rpm: 100,
        tpm: 30000,
        rpd: 1000,
        dimensions: 768,
        description: "Gemini Embedding 1 - primary embeddings provider"
    },
    {
        id: "Xenova/all-MiniLM-L6-v2",
        provider: 'local',
        tier: 999,
        rpm: Number.MAX_SAFE_INTEGER,
        tpm: Number.MAX_SAFE_INTEGER,
        rpd: Number.MAX_SAFE_INTEGER,
        dimensions: 384,
        description: "Local all-MiniLM-L6-v2 fallback via @xenova/transformers"
    },
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
