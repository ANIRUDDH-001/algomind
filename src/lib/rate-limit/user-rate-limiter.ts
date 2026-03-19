import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkCoOwnerStatus } from '@/app/actions/co-owner';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getWeeklySessionLimit, isSessionGatingEnabled } from '@/lib/config/system-config';

const DAILY_LIMIT = 10; // Free tier: ~1 full interview per day

// Production rate limits. Free tier: 10 questions/day. Owners/admins: unlimited.
const HACKATHON_UNLIMITED = false;
const LOCAL_STORAGE_KEY = 'algomind_daily_usage';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    isAdmin: boolean;
    error?: boolean;
}

interface LocalUsage {
    date: string;
    count: number;
}

/**
 * Check if user has remaining questions for today
 * Admins are exempt from limits
 */
export async function checkUserRateLimit(userId: string | null): Promise<RateLimitResult> {
    // HACKATHON MODE: disabled for production
    if (HACKATHON_UNLIMITED) {
        return { allowed: true, remaining: 9999, isAdmin: false };
    }

    // Guest users have no rate limit (they have trial limit instead)
    if (!userId || userId === 'guest-user') {
        return { allowed: true, remaining: 999, isAdmin: false };
    }

    const supabase = getSupabase();

    // If Supabase not configured, use localStorage
    if (!supabase || !isSupabaseConfigured()) {
        return checkLocalRateLimit();
    }

    try {
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
                isCoOwner = await checkCoOwnerStatus(userId);
                await redisSet(cacheKey, String(isCoOwner), 300); // 5-minute TTL
            }
        } catch {
            // Redis unavailable — fall through to direct check
            isCoOwner = await checkCoOwnerStatus(userId);
        }

        if (profile?.account_type === 'owner' || isCoOwner) {
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
            // Fail CLOSED safely
            return { allowed: false, remaining: 0, isAdmin: false, error: true };
        }

        const result = data?.[0];
        if (!result) {
            // No data returned - fail CLOSED safely
            console.error('❌ [Rate Limit] No data returned from RPC.');
            return { allowed: false, remaining: 0, isAdmin: false, error: true };
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
        // Fail CLOSED safely
        return { allowed: false, remaining: 0, isAdmin: false, error: true };
    }
}


/**
 * Increment user usage count in DB
 */
export async function incrementUserUsage(userId: string, supabaseClient?: SupabaseClient): Promise<void> {
    if (!userId || userId === 'guest-user') {
        recordLocalQuestion();
        return;
    }

    const supabase = supabaseClient || getSupabase();

    if (!supabase) {
        console.warn('⚠️ [Rate Limit] No Supabase client available to increment usage');
        return;
    }

    try {
        // We use upsert to simplify the logic: 
        // if row exists, we want to increment. 
        // BUT standard REST upsert overrides the row. 
        // So safest is to use RPC if available, or just insert and handle conflict if we don't have an atomic increment RPC.
        // Given constraints, we will rely on strict rate limit checking which calls RPC.
        // Use a simple upsert for now designed to just "ensure" a record exists, 
        // but for accurate incrementing we should probably use an RPC or careful logic.
        // Actually, the requirement says: "increment questions_used by 1 for today, or insert a new row with questions_used = 1"
        // Let's use the `record_user_question` RPC if it exists (it was called in the original code! line 79)
        // RPC: check_user_rate_limit was mentioned. 
        // Wait, the original code had: await supabase.rpc('record_user_question', { p_user_id: userId });
        // I should USE that if it works. 

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
 * LocalStorage fallback for when Supabase isn't configured
 */
function checkLocalRateLimit(): RateLimitResult {
    try {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (!stored) {
            return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
        }

        const usage: LocalUsage = JSON.parse(stored);

        // Reset if different day
        if (usage.date !== today) {
            return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
        }

        const remaining = Math.max(0, DAILY_LIMIT - usage.count);

        if (remaining === 0) {
            void logSystemEvent({
                type: 'user_rate_limit',
                userId: 'local',
                metadata: { count: usage.count, limit: DAILY_LIMIT }
            });
        }

        return {
            allowed: remaining > 0,
            remaining,
            isAdmin: false
        };
    } catch {
        return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
    }
}

function recordLocalQuestion(): void {
    try {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        const usage: LocalUsage = { date: today, count: 1 };

        if (stored) {
            const existing: LocalUsage = JSON.parse(stored);
            if (existing.date === today) {
                usage.count = existing.count + 1;
            }
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(usage));
    } catch {
        // Ignore storage errors
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

/**
 * Check if a user has remaining weekly sessions.
 * Used by freemium gating and /api/learn/concept.
 */
export async function checkWeeklySessionLimit(userId: string): Promise<{
    allowed: boolean;
    sessionsUsed: number;
    limit: number;
}> {
    const [subscriptionData, weeklyLimit, gatingEnabled] = await Promise.all([
        getUserSubscriptionStatus(userId),
        getWeeklySessionLimit(),
        isSessionGatingEnabled(),
    ]);

    // Premium and college users bypass limits.
    if (subscriptionData.status !== 'free') {
        return { allowed: true, sessionsUsed: 0, limit: Number.POSITIVE_INFINITY };
    }

    if (!gatingEnabled) {
        return { allowed: true, sessionsUsed: 0, limit: weeklyLimit };
    }

    const { data: profile } = await getServiceClient()
        .from('profiles')
        .select('rate_limit_override')
        .eq('id', userId)
        .single();

    if (profile?.rate_limit_override === 0) {
        return { allowed: true, sessionsUsed: 0, limit: weeklyLimit };
    }

    const sessionsUsed = await fetchWeeklySessionCount(userId);
    const effectiveLimit = profile?.rate_limit_override ?? weeklyLimit;

    return {
        allowed: sessionsUsed < effectiveLimit,
        sessionsUsed,
        limit: effectiveLimit,
    };
}

/**
 * Increment learn session weekly usage counters.
 */
export async function incrementWeeklyUsage(userId: string, type: 'learn' | 'interview'): Promise<void> {
    try {
        const weekStart = getMonday();
        const client = getServiceClient();
        const { data } = await client
            .from('user_weekly_usage')
            .select('interview_sessions_used, learn_sessions_used')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        const nextInterview = (data?.interview_sessions_used ?? 0) + (type === 'interview' ? 1 : 0);
        const nextLearn = (data?.learn_sessions_used ?? 0) + (type === 'learn' ? 1 : 0);

        await client
            .from('user_weekly_usage')
            .upsert(
                {
                    user_id: userId,
                    week_start: weekStart,
                    interview_sessions_used: nextInterview,
                    learn_sessions_used: nextLearn,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,week_start' }
            );
    } catch (error) {
        console.error('❌ [Rate Limit] Failed to increment weekly usage:', error);
    }
}

async function fetchWeeklySessionCount(userId: string): Promise<number> {
    const weekStart = getMonday();
    const { data } = await getServiceClient()
        .from('user_weekly_usage')
        .select('interview_sessions_used, learn_sessions_used')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle();

    if (!data) return 0;
    return (data.interview_sessions_used ?? 0) + (data.learn_sessions_used ?? 0);
}

function getMonday(): string {
    const now = new Date();
    const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = utc.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    utc.setUTCDate(utc.getUTCDate() - offset);
    return utc.toISOString().split('T')[0] ?? '';
}
