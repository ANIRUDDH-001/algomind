/**
 * Server-side feature flag reader.
 * Reads from Redis cache (30s TTL) → Supabase fallback.
 * Used in ALL API routes to enforce admin kill switches.
 */

import { redisGet, redisSet, redisDel } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { FEATURE_FLAGS, type FeatureFlagKey } from './feature-flags';

const CACHE_PREFIX = 'global_flag:';
const CACHE_TTL = 30; // seconds — fast propagation

interface GlobalFlag {
    key: string;
    is_enabled: boolean;
    updated_at: string;
}

/**
 * Get a single flag value from Redis → Supabase.
 * Always prefer this over getFeatureFlag() in server-side code.
 */
export async function getGlobalFeatureFlag(key: FeatureFlagKey): Promise<boolean> {
    // 1. Check Redis cache
    try {
        const cached = await redisGet(`${CACHE_PREFIX}${key}`);
        if (cached !== null) {
            return cached === 'true';
        }
    } catch {
        // Redis unavailable — fall through to DB
    }

    // 2. Read from Supabase
    try {
        const supabase = getServiceClient();
        const { data, error } = await supabase
            .from('global_feature_flags')
            .select('is_enabled')
            .eq('key', key)
            .single();

        if (error || !data) {
            // Flag doesn't exist in DB — return compiled default
            return FEATURE_FLAGS[key].defaultValue;
        }

        // Cache the result
        await redisSet(`${CACHE_PREFIX}${key}`, String(data.is_enabled), CACHE_TTL)
            .catch(() => { }); // Don't fail if Redis is down

        return data.is_enabled;
    } catch {
        // DB unavailable — fail OPEN (return default) to avoid breaking interviews
        return FEATURE_FLAGS[key].defaultValue;
    }
}

/**
 * Get all flags at once (for admin dashboard).
 */
export async function getAllGlobalFeatureFlags(): Promise<Record<string, { value: boolean; description: string }>> {
    // Start with compiled defaults
    const result: Record<string, { value: boolean; description: string }> = {};
    for (const [key, def] of Object.entries(FEATURE_FLAGS)) {
        result[key] = { value: def.defaultValue, description: def.description };
    }

    try {
        const supabase = getServiceClient();
        const { data } = await supabase
            .from('global_feature_flags')
            .select('key, is_enabled');

        // Override with DB values
        if (data) {
            for (const row of data as GlobalFlag[]) {
                if (row.key in result) {
                    result[row.key].value = row.is_enabled;
                }
            }
        }
    } catch {
        // Return all defaults on DB failure
    }

    return result;
}

/**
 * Set a flag (admin only — verify admin status in the route handler).
 * Writes to DB and invalidates Redis cache.
 */
export async function setGlobalFeatureFlag(
    key: FeatureFlagKey,
    isEnabled: boolean,
    adminUserId: string
): Promise<void> {
    const supabase = getServiceClient();

    await supabase
        .from('global_feature_flags')
        .upsert({
            key,
            is_enabled: isEnabled,
            updated_by: adminUserId,
            updated_at: new Date().toISOString()
        });

    // Invalidate Redis cache immediately
    try {
        await redisDel(`${CACHE_PREFIX}${key}`);
    } catch {
        // Redis unavailable — flag update still persisted to DB
    }
}
