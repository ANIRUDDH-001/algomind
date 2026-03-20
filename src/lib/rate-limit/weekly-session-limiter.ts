import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getWeeklySessionLimit, isSessionGatingEnabled } from '@/lib/config/system-config';

export interface WeeklySessionLimitResult {
  allowed: boolean;
  sessionsUsed: number;
  limit: number;
  gatingEnabled: boolean;
}

export async function checkWeeklySessionLimit(userId: string): Promise<WeeklySessionLimitResult> {
  const [subscriptionData, weeklyLimit, gatingEnabled] = await Promise.all([
    getUserSubscriptionStatus(userId),
    getWeeklySessionLimit(),
    isSessionGatingEnabled(),
  ]);

  // Premium and college users bypass weekly session limits.
  if (subscriptionData.status !== 'free') {
    return {
      allowed: true,
      sessionsUsed: 0,
      limit: weeklyLimit,
      gatingEnabled,
    };
  }

  if (!gatingEnabled) {
    return {
      allowed: true,
      sessionsUsed: 0,
      limit: weeklyLimit,
      gatingEnabled,
    };
  }

  const { data: profile } = await getServiceClient()
    .from('profiles')
    .select('rate_limit_override')
    .eq('id', userId)
    .single();

  if (profile?.rate_limit_override === 0) {
    return {
      allowed: true,
      sessionsUsed: 0,
      limit: weeklyLimit,
      gatingEnabled,
    };
  }

  const sessionsUsed = await fetchWeeklySessionCount(userId);
  const effectiveLimit = profile?.rate_limit_override ?? weeklyLimit;

  return {
    allowed: sessionsUsed < effectiveLimit,
    sessionsUsed,
    limit: effectiveLimit,
    gatingEnabled,
  };
}

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
    console.error('❌ [Weekly Session Limit] Failed to increment weekly usage:', error);
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

export async function getWeeklySessionCount(userId: string): Promise<number> {
  return fetchWeeklySessionCount(userId);
}

function getMonday(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().split('T')[0] ?? '';
}
