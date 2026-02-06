import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

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
            target_user_id: userId,
            daily_limit: DAILY_LIMIT
        });

        if (error) {
            console.warn('Rate limit check failed, allowing:', error);
            return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
        }

        const result = data?.[0];
        if (!result) {
            return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
        }

        return {
            allowed: result.allowed,
            remaining: result.remaining,
            isAdmin: result.remaining >= 999
        };
    } catch (error) {
        console.error('Rate limit error:', error);
        // Fail open - allow on error
        return { allowed: true, remaining: DAILY_LIMIT, isAdmin: false };
    }
}

/**
 * Record that user started a question
 */
export async function recordUserQuestion(userId: string | null): Promise<void> {
    if (!userId || userId === 'guest-user') {
        return; // Don't track guests
    }

    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        recordLocalQuestion();
        return;
    }

    try {
        await supabase.rpc('record_user_question', {
            target_user_id: userId
        });
    } catch (error) {
        console.error('Failed to record question:', error);
        // Fail silently
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

        let usage: LocalUsage = { date: today, count: 1 };

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

// Export constants
export const RATE_LIMIT = {
    DAILY_LIMIT
};
