/**
 * @module rate-limit/weekly-session-limiter
 * @description Per-type weekly session limit enforcement for the freemium gate.
 *              Interview and learn sessions have independent limits, both configurable
 *              from the owner dashboard.
 *
 *              Key design decisions:
 *              - Increment is ATOMIC via DB function (no SELECT+UPDATE race condition)
 *              - Increment is AWAITED — failure blocks the session, not fire-and-forget
 *              - Per-type: interview and learn limits are independent
 *              - Premium users bypass all limits
 *              - Admin/owner accounts bypass all limits
 *              - enable_session_gating=false bypasses all limits globally
 */
import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getSystemConfig, isSessionGatingEnabled } from '@/lib/config/system-config';
import { SYSTEM_CONFIG_KEYS } from '@/lib/config/system-config-keys';

export type SessionType = 'interview' | 'learn';

export interface WeeklySessionLimitResult {
  allowed: boolean;
  sessionsUsed: number;
  limit: number | null;       // null = unlimited
  sessionsRemaining: number | null;
  reason: 'premium' | 'admin' | 'gating_disabled' | 'within_limit' | 'limit_exceeded';
}

/**
 * Check if a user can start a new session of the given type.
 * Call this BEFORE creating any session row.
 */
export async function checkWeeklySessionLimit(
  userId: string,
  sessionType: SessionType
): Promise<WeeklySessionLimitResult> {
  // 1. Global gate switch
  const gatingEnabled = await isSessionGatingEnabled();
  if (!gatingEnabled) {
    return { allowed: true, sessionsUsed: 0, limit: null, sessionsRemaining: null, reason: 'gating_disabled' };
  }

  // 2. Subscription status — premium/college bypass
  const { status: subscriptionStatus } = await getUserSubscriptionStatus(userId);
  if (subscriptionStatus !== 'free') {
    return { allowed: true, sessionsUsed: 0, limit: null, sessionsRemaining: null, reason: 'premium' };
  }

  // 3. Admin / owner bypass
  const { data: profile } = await getServiceClient()
    .from('profiles')
    .select('account_type, rate_limit_override')
    .eq('id', userId)
    .single();

  if (
    profile?.account_type === 'admin' ||
    profile?.account_type === 'owner' ||
    profile?.rate_limit_override === 0
  ) {
    return { allowed: true, sessionsUsed: 0, limit: null, sessionsRemaining: null, reason: 'admin' };
  }

  // 4. Get per-type limit from system_config
  const configKey = sessionType === 'interview'
    ? SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT
    : SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_LEARN_LIMIT;

  const rawLimit = await getSystemConfig(configKey);
  const effectiveLimit = profile?.rate_limit_override ?? (parseInt(rawLimit, 10) || 5);

  // 5. Get current per-type usage
  const sessionsUsed = await fetchWeeklyTypeCount(userId, sessionType);
  const sessionsRemaining = Math.max(0, effectiveLimit - sessionsUsed);

  return {
    allowed: sessionsUsed < effectiveLimit,
    sessionsUsed,
    limit: effectiveLimit,
    sessionsRemaining,
    reason: sessionsUsed < effectiveLimit ? 'within_limit' : 'limit_exceeded',
  };
}

/**
 * Atomically increment the per-type session counter.
 * Returns true if successfully incremented, false if limit was already reached.
 *
 * MUST be awaited — not fire-and-forget.
 * Throws on DB error so the caller can return 500 rather than silently skip.
 */
export async function incrementWeeklyUsage(
  userId: string,
  sessionType: SessionType
): Promise<boolean> {
  const configKey = sessionType === 'interview'
    ? SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT
    : SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_LEARN_LIMIT;

  const rawLimit = await getSystemConfig(configKey);
  const limit = parseInt(rawLimit, 10) || 5;

  const { data, error } = await getServiceClient().rpc('atomic_increment_weekly_usage', {
    p_user_id: userId,
    p_type: sessionType,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Weekly usage increment failed: ${error.message}`);
  }

  return Boolean(data);
}

/**
 * Get the current count for one session type this week.
 */
async function fetchWeeklyTypeCount(userId: string, sessionType: SessionType): Promise<number> {
  const weekStart = getMondayUTC();
  const col = sessionType === 'interview' ? 'interview_sessions_used' : 'learn_sessions_used';

  const { data } = await getServiceClient()
    .from('user_weekly_usage')
    .select(col)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (!data) return 0;
  return (data as Record<string, number>)[col] ?? 0;
}

/**
 * Get counts for BOTH types — used by /api/knowledge/session-limit and owner stats.
 */
export async function getWeeklySessionCount(userId: string): Promise<{
  interview: number;
  learn: number;
  total: number;
}> {
  const weekStart = getMondayUTC();
  const { data } = await getServiceClient()
    .from('user_weekly_usage')
    .select('interview_sessions_used, learn_sessions_used')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  const interview = data?.interview_sessions_used ?? 0;
  const learn = data?.learn_sessions_used ?? 0;
  return { interview, learn, total: interview + learn };
}

function getMondayUTC(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().split('T')[0] ?? '';
}