/**
 * @module system-config
 * @description Server-side helper to read system_config values with Redis caching.
 *              Always use this instead of querying system_config directly.
 * @phase Phase 1C
 */

import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';
import { SYSTEM_CONFIG_DEFAULTS, SYSTEM_CONFIG_KEYS, SystemConfigKey } from './system-config-keys';

const CACHE_TTL_SECONDS = 300; // 5 minutes — same as feature flags

/**
 * Get a single system_config value with Redis caching.
 * Falls back to default if Redis and DB both fail.
 */
export async function getSystemConfig(key: SystemConfigKey): Promise<string> {
    const cacheKey = `system_config:${key}`;

    try {
        // Try Redis cache first
        const redis = getRedis();
        if (redis) {
            const cached = await redis.get<string>(cacheKey);
            if (cached !== null && cached !== undefined) {
                return cached;
            }
        }
    } catch {
        // Redis failure is non-fatal — proceed to DB
    }

    try {
        const { data, error } = await getServiceClient()
            .from('system_config')
            .select('value')
            .eq('key', key)
            .single();

        if (error || !data) {
            return SYSTEM_CONFIG_DEFAULTS[key];
        }

        // Cache the result
        try {
            const redis = getRedis();
            if (redis) {
                await redis.set(cacheKey, data.value, { ex: CACHE_TTL_SECONDS });
            }
        } catch {
            // Cache write failure is non-fatal
        }

        return data.value;
    } catch {
        return SYSTEM_CONFIG_DEFAULTS[key];
    }
}

/**
 * Get multiple system_config values in one DB round trip.
 */
export async function getSystemConfigs(
    keys: SystemConfigKey[]
): Promise<Record<SystemConfigKey, string>> {
    const result = {} as Record<SystemConfigKey, string>;

    // Set defaults first
    for (const key of keys) {
        result[key] = SYSTEM_CONFIG_DEFAULTS[key];
    }

    try {
        const { data } = await getServiceClient()
            .from('system_config')
            .select('key, value')
            .in('key', keys);

        if (data) {
            for (const row of data) {
                if (keys.includes(row.key as SystemConfigKey)) {
                    result[row.key as SystemConfigKey] = row.value;
                }
            }
        }
    } catch {
        // Return defaults on failure
    }

    return result;
}

/**
 * Typed getters for commonly used config values
 */
export async function getWeeklySessionLimit(): Promise<number> {
    const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT);
    return Number.parseInt(value, 10) || 5;
}

export async function isSessionGatingEnabled(): Promise<boolean> {
    const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING);
    return value === 'true';
}

export async function getInterviewConfidenceWeight(): Promise<number> {
    const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.CONCEPT_CONFIDENCE_INTERVIEW_WEIGHT);
    return Number.parseFloat(value) || 0.2;
}
