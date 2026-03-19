import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkWeeklySessionLimit } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [limitStatus, subscription] = await Promise.all([
      checkWeeklySessionLimit(user.id),
      getUserSubscriptionStatus(user.id),
    ]);

    const sessionsRemaining = subscription.status === 'free'
      ? Math.max(0, limitStatus.limit - limitStatus.sessionsUsed)
      : null;

    return NextResponse.json({
      allowed: limitStatus.allowed,
      sessionsUsed: limitStatus.sessionsUsed,
      limit: limitStatus.limit,
      sessionsRemaining,
      status: subscription.status,
      gatingEnabled: limitStatus.gatingEnabled,
    });
  } catch (error: unknown) {
    await logSystemEvent({
      type: 'db_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { context: 'knowledge_session_limit.get' },
    });

    return NextResponse.json({ error: 'Failed to load weekly session limit' }, { status: 500 });
  }
}
