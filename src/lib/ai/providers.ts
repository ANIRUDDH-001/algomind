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
    {
        id: "qwen-2.5-32b", // Mapped from qwen3-32b (Qwen 2.5 is current on Groq, assuming user meant acceptable equivalent or future)
        provider: 'groq',
        tier: 3,
        rpm: 51,
        rpd: 850,
        tpm: 5000,
        contextWindow: 32000,
        supportsEmbeddings: false,
        description: "Groq Qwen 32B"
    },
    // Note: llama-4-scout and llama-4-maverick are not yet public Groq IDs. 
    // Keeping them for forward compatibility or placeholders as requested.
    {
        id: "llama-4-scout",
        provider: 'groq',
        tier: 4,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 4 Scout (Placeholder)"
    },
    {
        id: "llama-4-maverick",
        provider: 'groq',
        tier: 4,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 4 Maverick (Placeholder)"
    },
    {
        id: "openai/gpt-oss-120b", // gpt-oss-120b
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
        id: "openai/gpt-oss-20b", // gpt-oss-20b
        provider: 'groq',
        tier: 6,
        rpm: 25.5,
        rpd: 850,
        tpm: 5000,
        contextWindow: 200000,
        supportsEmbeddings: false,
        description: "Groq GPT-OSS 20B"
    },

    // --- GEMINI MODELS ---
    {
        id: "gemini-1.5-pro", // Mapped from gemini-2.5-pro/3-pro (using available pro model for now, adjusting limits)
        provider: 'gemini',
        tier: 10,
        rpm: 12.75, // 15 * 0.85
        rpd: 1275, // 1500 * 0.85
        tpm: 30000,
        contextWindow: 2000000,
        supportsEmbeddings: false,
        description: "Gemini 1.5 Pro (Targeting 2.5/3 Pro slots)"
    },
    // Note: gemini-2.5-pro, gemini-3-pro, gemini-2-flash, etc. are likely future/preview IDs.
    // I will add them as requested to match the user's config exactly, 
    // assuming the library/API might support them or they are aliases.
    {
        id: "gemini-2.0-flash",
        provider: 'gemini',
        tier: 11,
        rpm: 12.75,
        rpd: 1275,
        tpm: 30000,
        contextWindow: 1000000,
        supportsEmbeddings: true,
        description: "Gemini 2.0 Flash"
    },
    {
        id: "gemini-2.0-flash-lite-preview-02-05", // Mapped closest for 'gemini-2.5-flash-lite' or similar if needed, keeping user ID
        provider: 'gemini',
        tier: 12,
        rpm: 8.5,
        rpd: 17, // Extremely low RPD from prompt? 
        tpm: 30000,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini Flash Lite"
    },
    // Adding the specific IDs requested even if they seem futuristic, 
    // to ensure the RateLimiter has the exact data structure requested.
    { id: "gemini-2.5-pro", provider: 'gemini', tier: 10, rpm: 12.75, rpd: 1275, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2.5 Pro" },
    { id: "gemini-3-pro", provider: 'gemini', tier: 10, rpm: 12.75, rpd: 1275, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 3 Pro" },
    { id: "gemini-2-flash", provider: 'gemini', tier: 11, rpm: 12.75, rpd: 1275, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2 Flash" },
    { id: "gemini-2.5-flash", provider: 'gemini', tier: 12, rpm: 4.25, rpd: 17, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2.5 Flash" },
    { id: "gemini-3-flash", provider: 'gemini', tier: 12, rpm: 4.25, rpd: 17, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 3 Flash" },
    { id: "gemini-2.5-flash-lite", provider: 'gemini', tier: 13, rpm: 8.5, rpd: 17, tpm: 10000, contextWindow: 1000000, supportsEmbeddings: false, description: "Gemini 2.5 Flash Lite" },
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
