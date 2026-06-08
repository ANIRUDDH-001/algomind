/**
 * @codesage
 * @file      src/lib/rate-limit/user-rate-limiter.ts
 * @purpose   Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
import { createServerSupabase } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkCoOwnerStatus } from '@/app/actions/co-owner';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { getFailureMode } from './decision-layer';

const DAILY_LIMIT = 10; // Free tier: ~1 full interview per day

// Production rate limits. Free tier: 10 questions/day. Owners/admins: unlimited.
const HACKATHON_UNLIMITED = false;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    isAdmin: boolean;
    error?: boolean;
}

/**
 * Check if user has remaining questions for today
 * Admins are exempt from limits
 */
export async function checkUserRateLimit(userId: string | null): Promise<RateLimitResult> {
    const failureMode = getFailureMode('user_rate_limit');

    // HACKATHON MODE: disabled for production
    if (HACKATHON_UNLIMITED) {
        return { allowed: true, remaining: 9999, isAdmin: false };
    }

    // Guest users have no rate limit (they have trial limit instead)
    if (!userId || userId === 'guest-user') {
        return { allowed: true, remaining: 999, isAdmin: false };
    }

    try {
        const supabase = await createServerSupabase();

        // Check if user is owner or co-owner — they get unlimited access
        // co_owners check via server action to bypass RLS (A6 fix)
        const { data: profile } = await supabase.from('profiles').select('account_type, rate_limit_override').eq('id', userId).single();
        // Cache co-owner status in Redis for 5 minutes — this is called on every chat request
        let isCoOwner = false;
        try {
            const cacheKey = `coowner:${userId}`;
            const cached = await redisGet(cacheKey);
            if (cached !== null) {
                isCoOwner = cached === 'true';
            } else {
                const coOwnerResult = await checkCoOwnerStatus(userId);
                isCoOwner = coOwnerResult.success ? coOwnerResult.data.isCoOwner : false;
                await redisSet(cacheKey, String(isCoOwner), 300); // 5-minute TTL
            }
        } catch {
            // Redis unavailable — fall through to direct check
            const coOwnerResult = await checkCoOwnerStatus(userId);
            isCoOwner = coOwnerResult.success ? coOwnerResult.data.isCoOwner : false;
        }

        if (profile?.account_type === 'owner' || profile?.account_type === 'admin' || isCoOwner || profile?.rate_limit_override === 0) {
            return { allowed: true, remaining: 999, isAdmin: true };
        }

        // Per-user rate limit override from owner dashboard
        const effectiveLimit = profile?.rate_limit_override ?? DAILY_LIMIT;

        // Use the database function
        const { data, error } = await supabase.rpc('check_user_rate_limit', {
            p_user_id: userId,
            p_limit: effectiveLimit
        });

        if (error) {
            console.error('❌ [Rate Limit] Check failed:', error.message || error);
            if (error.code === 'PGRST202') {
                console.error('🚨 [CRITICAL SECURITY] Missing RPC function "check_user_rate_limit". Blocking request to prevent silent bypass. PLEASE RUN MIGRATIONS!');
            }
            return failureMode === 'fail-open'
                ? { allowed: true, remaining: DAILY_LIMIT, isAdmin: false }
                : { allowed: false, remaining: 0, isAdmin: false, error: true };
        }

        const result = data?.[0];
        if (!result) {
            // No data returned - fail CLOSED safely
            console.error('❌ [Rate Limit] No data returned from RPC.');
            return failureMode === 'fail-open'
                ? { allowed: true, remaining: DAILY_LIMIT, isAdmin: false }
                : { allowed: false, remaining: 0, isAdmin: false, error: true };
        }

        if (!result.allowed && !result.is_admin_user) {
            void logSystemEvent({
                type: 'user_rate_limit',
                userId: userId,
                metadata: { count: DAILY_LIMIT - result.remaining, limit: DAILY_LIMIT }
            });
        }

        return {
            allowed: result.allowed,
            remaining: result.remaining,
            isAdmin: result.is_admin_user
        };
    } catch (error: unknown) {
        console.error('❌ [Rate Limit] Unexpected error:', error);
        return failureMode === 'fail-open'
            ? { allowed: true, remaining: DAILY_LIMIT, isAdmin: false }
            : { allowed: false, remaining: 0, isAdmin: false, error: true };
    }
}


/**
 * Increment user usage count in DB
 */
export async function incrementUserUsage(userId: string, supabaseClient?: SupabaseClient): Promise<void> {
    if (!userId || userId === 'guest-user') {
        return;
    }

    try {
        const supabase = supabaseClient || await createServerSupabase();

        const { error } = await supabase.rpc('record_user_question', {
            p_user_id: userId
        });

        if (error) {
            console.error('❌ [Rate Limit] Failed to record usage via RPC:', error);
        }

    } catch (error: unknown) {
        console.error('❌ [Rate Limit] Error recording usage:', error);
    }
}

/**
 * @deprecated Use incrementUserUsage instead. kept for backward compatibility.
 */
export async function recordUserQuestion(userId: string | null): Promise<void> {
    if (!userId) return;
    return incrementUserUsage(userId);
}

// Export constants
export const RATE_LIMIT = {
    DAILY_LIMIT
};
