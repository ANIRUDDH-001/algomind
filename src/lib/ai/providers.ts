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
const GEMINI_FREE_TIER_MODEL_ID = process.env.GEMINI_FREE_TIER_MODEL_ID || "gemini-2.0-flash";

// Chat Models Registry - ordered by preference
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
    {
        id: "moonshotai/kimi-k2-instruct-0905",
        provider: 'groq',
        tier: 5,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 200000, // Assuming large context for Kimi
        supportsEmbeddings: false,
        description: "Kimi K2 Instruct"
    },

    // --- GEMINI MODELS ---
    // Verified Gemini models — always cross-check with https://ai.google.dev/models
    {
        id: "gemini-1.5-pro", // Mapped from gemini-2.5-pro/3-pro
        provider: 'gemini',
        tier: 10,
        rpm: 2, // Low RPM for Pro
        rpd: 50,
        tpm: 32000,
        contextWindow: 2000000,
        supportsEmbeddings: false,
        description: "Gemini 1.5 Pro"
    },
    {
        id: "gemini-1.5-flash", // Stable high-volume model
        provider: 'gemini',
        tier: 11,
        rpm: 15,
        rpd: 1500,
        tpm: 1000000,
        contextWindow: 1000000,
        supportsEmbeddings: true,
        description: "Gemini 1.5 Flash"
    },
    {
        id: GEMINI_FREE_TIER_MODEL_ID, // Newer Experimental
        provider: 'gemini',
        tier: 11,
        rpm: 10,
        rpd: 1500,
        tpm: 1000000,
        contextWindow: 1000000,
        supportsEmbeddings: true,
        description: "Gemini 2.0 Flash"
    },
    // Preview - may need verification
    { id: "gemini-2.5-pro", provider: 'gemini', tier: 10, rpm: 12.75, rpd: 1275, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2.5 Pro" },
    // Preview - may need verification
    { id: "gemini-2.5-flash", provider: 'gemini', tier: 12, rpm: 4.25, rpd: 17, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2.5 Flash" },
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
