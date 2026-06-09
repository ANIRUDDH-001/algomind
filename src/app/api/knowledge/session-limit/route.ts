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
import { checkWeeklySessionLimitReadOnly } from '@/lib/rate-limit/weekly-session-limiter';
import { getServiceClient } from '@/lib/supabase/service';
import { isSessionGatingEnabled } from '@/lib/config/system-config';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await getServiceClient()
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    const [gatingEnabled, checkResult] = await Promise.all([
      isSessionGatingEnabled(),
      checkWeeklySessionLimitReadOnly(user.id, 'interview'),
    ]);

    return NextResponse.json({
      // Identity
      accountType: profile?.account_type ?? 'candidate',

      // Gate status
      gatingEnabled,

      // Unified result
      allowed: checkResult.allowed,
      reason: checkResult.reason,

      // Combined usage (interview + learn)
      sessionsUsed: checkResult.sessionsUsed,
      limit: checkResult.limit,           // null = unlimited
      sessionsRemaining: checkResult.sessionsRemaining,
      isUnlimited: checkResult.limit === null,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[session-limit] Error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
