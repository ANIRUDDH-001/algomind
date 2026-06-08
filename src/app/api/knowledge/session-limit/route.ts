/**
 * @codesage
 * @file      src/app/api/knowledge/session-limit/route.ts
 * @purpose   Checks and returns the user's weekly session quotas (interview/learn).
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/rate-limit/weekly-session-limiter, @/lib/supabase/user-preferences, @/lib/config/system-config
 * @apis      None
 * @db        None directly
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkWeeklySessionLimitReadOnly, getWeeklySessionCount } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { isSessionGatingEnabled } from '@/lib/config/system-config';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [counts, subStatus, interviewGate, learnGate, gatingEnabled] = await Promise.all([
      getWeeklySessionCount(user.id),
      getUserSubscriptionStatus(user.id),
      checkWeeklySessionLimitReadOnly(user.id, 'interview'),
      checkWeeklySessionLimitReadOnly(user.id, 'learn'),
      isSessionGatingEnabled(),
    ]);

    const interviewLimit = interviewGate.limit;
    const learnLimit = learnGate.limit;
    const interviewRemaining =
      typeof interviewLimit === 'number' ? Math.max(0, interviewLimit - counts.interview) : null;
    const learnRemaining =
      typeof learnLimit === 'number' ? Math.max(0, learnLimit - counts.learn) : null;

    return NextResponse.json({
      subscriptionStatus: subStatus.status,
      gatingEnabled,
      allowed: interviewGate.allowed,
      reason: interviewGate.reason,
      interview: {
        used: counts.interview,
        limit: interviewLimit,
        remaining: interviewRemaining,
        allowed: interviewGate.allowed,
        reason: interviewGate.reason,
      },
      learn: {
        used: counts.learn,
        limit: learnLimit,
        remaining: learnRemaining,
        allowed: learnGate.allowed,
        reason: learnGate.reason,
      },
      // Legacy combined field (backward compat for InterviewLimitBar)
      sessionsUsed: counts.interview,
      limit: interviewLimit,
      sessionsRemaining: interviewRemaining,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[session-limit] Error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
