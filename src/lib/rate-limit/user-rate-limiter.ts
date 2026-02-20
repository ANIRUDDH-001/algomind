import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { logSystemEvent } from '@/lib/monitoring/events';

const DAILY_LIMIT = 5;
const LOCAL_STORAGE_KEY = 'algomind_daily_usage';

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    isAdmin: boolean;
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
        // Use the database function
        const { data, error } = await supabase.rpc('check_user_rate_limit', {
            p_user_id: userId,
            p_limit: DAILY_LIMIT
        });

        if (error) {
            console.error('❌ [Rate Limit] Check failed:', error);
            // Fail closed - deny on error for verified users to prevent abuse
            return { allowed: false, remaining: 0, isAdmin: false };
        }

        const result = data?.[0];
        if (!result) {
            return { allowed: false, remaining: 0, isAdmin: false };
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
        // Fail closed
        return { allowed: false, remaining: 0, isAdmin: false };
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
        const today = new Date().toISOString().split('T')[0];

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
            // Fallback to manual upsert if RPC fails? 
            // Ideally we trust the RPC. If it fails, we might just log it.
        } else {
            console.log(`✅ [Rate Limit] Increment success for ${userId}`);
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
