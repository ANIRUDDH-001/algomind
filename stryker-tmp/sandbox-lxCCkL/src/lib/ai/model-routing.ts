/**
 * DB-Driven Model Routing
 * Reads model_routing table to determine which models serve chat vs analysis requests.
 * Falls back to CHAT_MODELS (emergency fallback) if DB and cache are both unavailable.
 */
// @ts-nocheck


import { redisGet, redisSet } from '@/lib/upstash/client';
import type { ModelConfig, Provider } from './providers';
import { CHAT_MODELS } from './providers';

const CACHE_PREFIX = 'model_routing:';
const CACHE_TTL = 60; // 60 seconds

export interface RoutedModel {
    modelId: string;
    provider: Provider;
    priority: number;
    maxTokensOverride: number | null;
}

export type RoutingStage = 'primary' | 'secondary' | 'emergency';

export interface RoutingStagePlan {
    stage: RoutingStage;
    useCase: 'chat' | 'analysis';
}

/**
 * Get ordered models for a use case from DB (cached in Redis, 60s TTL).
 * Returns RoutedModel[] sorted by priority ASC (lowest = highest priority).
 */
export async function getModelsForUseCase(useCase: 'chat' | 'analysis'): Promise<RoutedModel[]> {
    const cacheKey = `${CACHE_PREFIX}${useCase}`;

    // 1. Redis cache check
    try {
        const cached = await redisGet(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as RoutedModel[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // Redis unavailable — continue to DB
    }

    // 2. Query model_routing table
    try {
        const { getServiceClient } = await import('@/lib/supabase/service');
        const supabase = getServiceClient();

        const { data, error } = await supabase
            .from('model_routing')
            .select('model_id, provider, priority, max_tokens_override')
            .eq('use_case', useCase)
            .eq('is_active', true)
            .order('priority', { ascending: true })
            .order('model_id', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            const models: RoutedModel[] = data.map((row) => ({
                modelId: row.model_id,
                provider: row.provider as Provider,
                priority: row.priority,
                maxTokensOverride: row.max_tokens_override,
            }));

            // Cache in Redis
            await redisSet(cacheKey, JSON.stringify(models), CACHE_TTL).catch(() => {});
            return models;
        }
    } catch {
        // DB unavailable — fall through to emergency fallback
    }

    // 3. Emergency fallback: derive from static CHAT_MODELS
    return getEmergencyFallback(useCase);
}

/**
 * Deterministic routing matrix by endpoint class (useCase):
 * primary -> secondary (cross-tier) -> emergency.
 */
export function buildRoutingStagePlan(
    useCase: 'chat' | 'analysis',
    crossTierFallbackEnabled: boolean
): RoutingStagePlan[] {
    const secondaryUseCase = useCase === 'chat' ? ('analysis' as const) : ('chat' as const);
    return [
        { stage: 'primary', useCase },
        ...(crossTierFallbackEnabled ? [{ stage: 'secondary' as const, useCase: secondaryUseCase }] : []),
        { stage: 'emergency', useCase },
    ];
}

/**
 * Check if cross-tier fallback is enabled.
 * When true, if all models in a use-case are exhausted,
 * the other use-case's models are tried as fallback.
 * Default: true (enabled).
 */
export async function isCrossTierFallbackEnabled(): Promise<boolean> {
    const cacheKey = 'system_config:cross_tier_fallback_enabled';
    
    // 1. Check Redis cache
    try {
        const cached = await redisGet(cacheKey);
        if (cached !== null) {
            return cached === 'true';
        }
    } catch {
        // Redis unavailable — fall through to DB
    }

    // 2. Query DB
    try {
        const { getServiceClient } = await import('@/lib/supabase/service');
        const supabase = getServiceClient();

        const { data } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'cross_tier_fallback_enabled')
            .maybeSingle();

        if (data?.value !== undefined) {
            const isEnabled = data.value === true || data.value === 'true';
            
            // Cache in Redis for 5 minutes
            await redisSet(cacheKey, String(isEnabled), 300).catch(() => {});
            return isEnabled;
        }
    } catch {
        // DB unavailable — default to enabled
    }
    return true;
}

/**
 * Emergency fallback when both Redis and DB are unavailable.
 * Derives from the static CHAT_MODELS array in providers.ts.
 * NOTE: Bedrock models are DB-driven (model_routing table) and NOT in
 * the static CHAT_MODELS array, so they won't appear here.
 * When ENABLE_AWS_BEDROCK is ON, the client handles Bedrock priority
 * separately in generateCompletion() before reaching this path.
 */
function getEmergencyFallback(useCase: 'chat' | 'analysis'): RoutedModel[] {
    if (useCase === 'analysis') {
        // For analysis, prefer Gemini models (better at structured JSON output)
        const geminiModels = CHAT_MODELS
            .filter((m) => m.provider === 'gemini')
            .map((m, i) => ({
                modelId: m.id,
                provider: m.provider,
                priority: (i + 1) * 10,
                maxTokensOverride: null,
            }));
        const groqModels = CHAT_MODELS
            .filter((m) => m.provider === 'groq' && m.tier <= 5)
            .map((m, i) => ({
                modelId: m.id,
                provider: m.provider,
                priority: (geminiModels.length + i + 1) * 10,
                maxTokensOverride: null,
            }));
        return [...geminiModels, ...groqModels];
    }

    // For chat, prefer Groq (faster) then Gemini
    const groqModels = CHAT_MODELS
        .filter((m) => m.provider === 'groq' && m.tier < 99)
        .sort((a, b) => a.tier - b.tier)
        .map((m, i) => ({
            modelId: m.id,
            provider: m.provider,
            priority: (i + 1) * 10,
            maxTokensOverride: null,
        }));
    const geminiModels = CHAT_MODELS
        .filter((m) => m.provider === 'gemini')
        .map((m, i) => ({
            modelId: m.id,
            provider: m.provider,
            priority: (groqModels.length + i + 1) * 10,
            maxTokensOverride: null,
        }));
    return [...groqModels, ...geminiModels];
}

export function getEmergencyFallbackModels(useCase: 'chat' | 'analysis'): RoutedModel[] {
    return getEmergencyFallback(useCase);
}

/**
 * Resolve a RoutedModel to a full ModelConfig by looking up the model registry.
 * Falls back to a synthetic ModelConfig if not found in static registry.
 */
export function resolveToModelConfig(routed: RoutedModel): ModelConfig {
    const existing = CHAT_MODELS.find((m) => m.id === routed.modelId);
    if (existing) {
        return {
            ...existing,
            tier: routed.priority, // Use DB priority as effective tier
        };
    }
    // Synthetic config for models only in DB (not in static array)
    return {
        id: routed.modelId,
        provider: routed.provider,
        tier: routed.priority,
        rpm: 25,
        tpm: 5000,
        rpd: 850,
        contextWindow: 128000,
        supportsEmbeddings: false,
        description: `${routed.provider} model (priority ${routed.priority})`,
    };
}
