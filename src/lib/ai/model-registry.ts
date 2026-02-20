import { createClient } from '@supabase/supabase-js';
import { ModelConfig, CHAT_MODELS } from './providers';
import { redisGet, redisSet, redisDel } from '../upstash/client';
import { logSystemEvent } from '../monitoring/events';

const CACHE_KEY = 'model_registry_v1';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface ModelRegistryEntry {
    model_id: string;
    provider: string;
    tier: number;
    rpm: number;
    tpm: number;
    rpd: number;
    context_window: number;
    is_active: boolean;
    is_verified: boolean;
    is_preview: boolean;
    deprecated_at: string | null;
    last_verified: string | null;
    notes: string | null;
}

/**
 * Creates a singleton Supabase service role client specifically for the model registry.
 * Bypasses RLS to allow server-side reading/writing of the registry.
 */
function getRegistryClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return null;
    }

    // Use the service role key to bypass RLS, this client is strictly server-side
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Fetches active models from the Supabase registry, with a Redis cache fallback.
 * If both DB and Cache fail, falls back to the static CHAT_MODELS array.
 */
export async function getActiveModels(): Promise<ModelConfig[]> {
    // 1. Check Upstash Cache
    try {
        const cachedModelsStr = await redisGet(CACHE_KEY);
        if (cachedModelsStr) {
            const cachedModels = JSON.parse(cachedModelsStr) as ModelConfig[];
            if (Array.isArray(cachedModels) && cachedModels.length > 0) {
                return cachedModels;
            }
        }
    } catch (error) {
        console.error('Error reading model registry cache:', error);
        // Continue to DB on cache read error
    }

    // 2. Query Supabase Database
    const supabase = getRegistryClient();
    if (supabase && typeof window === 'undefined') { // Server-side only check
        try {
            const { data, error } = await supabase
                .from('model_registry')
                .select('*')
                .eq('is_active', true)
                .order('tier', { ascending: true });

            if (error) {
                throw new Error(`Supabase query failed: ${error.message}`);
            }

            if (data && data.length > 0) {
                // 3. Map DB rows to ModelConfig
                const mappedModels: ModelConfig[] = (data as ModelRegistryEntry[]).map((row) => ({
                    id: row.model_id,
                    provider: row.provider as ModelConfig['provider'], // Cast to exact union type
                    tier: row.tier,
                    rpm: row.rpm,
                    tpm: row.tpm,
                    rpd: row.rpd,
                    contextWindow: row.context_window,
                    supportsEmbeddings: false, // Defaulting, adjust if needed or add to DB
                    description: row.notes || `${row.provider} model (Tier ${row.tier})`,
                    notes: row.notes || undefined,
                }));

                // 4. Cache the result
                try {
                    await redisSet(CACHE_KEY, JSON.stringify(mappedModels), CACHE_TTL_SECONDS);
                } catch (cacheWriteErr) {
                    console.error('Error writing model registry to cache:', cacheWriteErr);
                    // Don't fail the request if cache write fails
                }

                return mappedModels;
            }
        } catch (dbError) {
            console.error('Database error fetching model registry:', dbError);

            // Log db_error to system_events
            logSystemEvent({
                type: 'db_error',
                errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
                metadata: {
                    context: 'getActiveModels_fetch',
                }
            });
        }
    }

    // 5. Fallback to static CHAT_MODELS
    console.warn('Falling back to static CHAT_MODELS configuration.');
    return CHAT_MODELS;
}

/**
 * Marks a model as deprecated in the Supabase registry, logs a system event,
 * and clears the Redis cache to force a refresh.
 * Never throws an error.
 */
export async function markModelDeprecated(modelId: string, reason: string): Promise<void> {
    const supabase = getRegistryClient();

    if (!supabase || typeof window !== 'undefined') {
        return; // Silently fail if no client or client-side
    }

    try {
        // 1. Update Supabase
        const { error } = await supabase
            .from('model_registry')
            .update({
                is_active: false,
                deprecated_at: new Date().toISOString(),
                notes: reason,
            })
            .eq('model_id', modelId);

        if (error) {
            console.error(`Failed to deprecate model ${modelId} in DB:`, error);
            // We continue to try sending the system event even if DB update fails, 
            // as it might be a general DB issue we want to track.
        }

        // 2. Log system event
        await logSystemEvent({
            type: 'model_deprecated',
            modelId: modelId,
            errorMessage: reason,
            metadata: {
                action: 'markModelDeprecated',
            }
        });

        // 3. Invalidate cache
        await invalidateModelCache();

    } catch (error) {
        // 4. Never throw
        console.error(`Unexpected error deprecating model ${modelId}:`, error);
    }
}

/**
 * Invalidates the current model configuration cache in Redis.
 */
export async function invalidateModelCache(): Promise<void> {
    try {
        await redisDel(CACHE_KEY);
    } catch (error) {
        console.error('Error invalidating model cache:', error);
    }
}
