// Model Provider Types and Registry
// Supports Gemini (Google) and Groq for intelligent fallback

export type Provider = 'gemini' | 'groq';
export type ModelTier = 1 | 2 | 3 | 4 | 5;

export interface ModelConfig {
    id: string;
    provider: Provider;
    tier: ModelTier;
    rpm: number;         // requests per minute
    rpd: number;         // requests per day
    contextWindow: number;
    supportsEmbeddings: boolean;
    description: string;
}

export interface EmbeddingModelConfig {
    id: string;
    provider: Provider;
    rpm: number;
    dimensions: number;
    description: string;
}

// Chat Models Registry - ordered by preference
export const CHAT_MODELS: ModelConfig[] = [
    // Tier 1: Best quality (Gemini 3.0)
    {
        id: "gemini-2.5-flash",
        provider: 'gemini',
        tier: 1,
        rpm: 10,
        rpd: 1000,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash - Best quality, limited rate"
    },

    // Tier 2: Good balance (Gemini 2.5)
    {
        id: "gemini-2.5-flash-lite",
        provider: 'gemini',
        tier: 2,
        rpm: 15,
        rpd: 1500,
        contextWindow: 1000000,
        supportsEmbeddings: false,
        description: "Gemini 2.5 Flash lite - Good balance"
    },

    // Tier 3: Lighter model
    {
        id: "gemma-3-27b-it",
        provider: 'gemini',
        tier: 3,
        rpm: 30,
        rpd: 14400,
        contextWindow: 150000,
        supportsEmbeddings: false,
        description: "Gemma 3 27b - Lighter, faster"
    },

    // Tier 4: Groq - Powerful Fallback
    {
        id: "llama-3.3-70b-versatile",
        provider: 'groq',
        tier: 4,
        rpm: 30,
        rpd: 14400,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: "Groq Llama 3.3 70B - High performance, large context"
    },

    // Tier 5: Groq - Llama for backup
    {
        id: "llama-3.1-8b-instant",
        provider: 'groq',
        tier: 5,
        rpm: 30,
        rpd: 14400,
        contextWindow: 8192,
        supportsEmbeddings: false,
        description: "Groq Llama 3.1 8B - Fast fallback"
    },
];

// Embedding Models
export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
    {
        id: "text-embedding-004",
        provider: 'gemini',
        rpm: 1500,
        dimensions: 768,
        description: "Gemini text embedding - 768 dimensions"
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
