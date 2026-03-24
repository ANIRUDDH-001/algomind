import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeeklySessionCount } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getSystemConfig, isSessionGatingEnabled } from '@/lib/config/system-config';
import { SYSTEM_CONFIG_KEYS } from '@/lib/config/system-config-keys';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [counts, subStatus, interviewLimit, learnLimit, gatingEnabled] = await Promise.all([
      getWeeklySessionCount(user.id),
      getUserSubscriptionStatus(user.id),
      getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT),
      getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_LEARN_LIMIT),
      isSessionGatingEnabled(),
    ]);

    const isPremium = subStatus.status !== 'free';
    const interviewLimitNum = parseInt(interviewLimit, 10) || 5;
    const learnLimitNum = parseInt(learnLimit, 10) || 5;

    return NextResponse.json({
      subscriptionStatus: subStatus.status,
      gatingEnabled,
      interview: {
        used: counts.interview,
        limit: isPremium ? null : interviewLimitNum,
        remaining: isPremium ? null : Math.max(0, interviewLimitNum - counts.interview),
      },
      learn: {
        used: counts.learn,
        limit: isPremium ? null : learnLimitNum,
        remaining: isPremium ? null : Math.max(0, learnLimitNum - counts.learn),
      },
      // Legacy combined field (backward compat for InterviewLimitBar)
      sessionsUsed: counts.total,
      limit: isPremium ? null : interviewLimitNum,
      sessionsRemaining: isPremium ? null : Math.max(0, interviewLimitNum - counts.interview),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[session-limit] Error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
