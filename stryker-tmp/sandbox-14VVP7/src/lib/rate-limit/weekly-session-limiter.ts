/**
 * @codesage
 * @file      src/lib/rate-limit/weekly-session-limiter.ts
 * @purpose   Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Session state
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

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

async function isCoOwner(userId: string, email?: string | null): Promise<boolean> {
  const emailClause = email ? `,email.eq.${email}` : '';
  const { data: coOwner } = await getServiceClient()
    .from('co_owners')
    .select('id')
    .or(`user_id.eq.${userId}${emailClause}`)
    .limit(1)
    .maybeSingle();

  return Boolean(coOwner);
}

export type SessionType = 'interview' | 'learn';

export interface WeeklySessionLimitResult {
  allowed: boolean;
  sessionsUsed: number;
  limit: number | null;       // null = unlimited
  sessionsRemaining: number | null;
  reason: 'premium' | 'admin' | 'gating_disabled' | 'within_limit' | 'limit_exceeded';
}

/**
 * Read-only check to see if a user has reached their weekly session limit.
 * This does NOT consume a session. Use this for UI rendering only.
 */
export async function checkWeeklySessionLimitReadOnly(
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
    .select('account_type, rate_limit_override, email')
    .eq('id', userId)
    .single();

  const coOwner = await isCoOwner(userId, profile?.email);

  if (
    profile?.account_type === 'admin' ||
    profile?.account_type === 'owner' ||
    coOwner ||
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
 * Atomically checks AND increments the weekly session count for a user.
 *
 * IMPORTANT: This function ALWAYS increments the counter when called.
 * Do not call it unless you intend to consume a session slot.
 * If the result is allowed=false, the increment is rolled back internally.
 */
export async function checkAndIncrementWeeklySession(
  userId: string,
  sessionType: SessionType
): Promise<WeeklySessionLimitResult> {
  // First run the read-only check to see if they are bypassed (premium, admin, disabled)
  // If they are bypassed, we do not need to increment the free-tier counter in the DB
  const readOnlyCheck = await checkWeeklySessionLimitReadOnly(userId, sessionType);
  
  if (readOnlyCheck.reason === 'premium' || readOnlyCheck.reason === 'admin' || readOnlyCheck.reason === 'gating_disabled') {
    return readOnlyCheck;
  }

  // We are here -> user is subject to limits. The limit must be an actual number.
  const limit = readOnlyCheck.limit ?? 5;

  const { data, error } = await getServiceClient().rpc('check_and_increment_weekly_usage', {
    p_user_id: userId,
    p_session_type: sessionType,
    p_weekly_limit: limit,
  });

  if (error || !data || (data as any[]).length === 0) {
    console.error('[WeeklyLimiter] RPC failed:', error?.message);
    // Fail-closed: deny access if we can't check the limit
    return {
      allowed: false,
      sessionsUsed: -1,
      limit,
      sessionsRemaining: 0,
      reason: 'limit_exceeded',
    };
  }

  const result = (data as any[])[0] as { allowed: boolean; sessions_used: number; limit_value: number };
  
  return {
    allowed: result.allowed,
    sessionsUsed: result.sessions_used,
    limit: result.limit_value,
    sessionsRemaining: Math.max(0, result.limit_value - result.sessions_used),
    reason: result.allowed ? 'within_limit' : 'limit_exceeded',
  };
}

/**
 * @deprecated Use checkAndIncrementWeeklySession instead.
 * Kept for backward compatibility during migration.
 */
export async function checkWeeklySessionLimit(
  userId: string,
  sessionType: SessionType
): Promise<WeeklySessionLimitResult> {
  console.warn(
    '[WeeklyLimiter] checkWeeklySessionLimit is deprecated and has a TOCTOU race. ' +
    'Use checkAndIncrementWeeklySession instead.'
  );
  return checkAndIncrementWeeklySession(userId, sessionType);
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