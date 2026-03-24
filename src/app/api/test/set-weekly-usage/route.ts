import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/set-weekly-usage
 * 
 * Test-only route to set a user's weekly session usage.
 * Used to test freemium gate behavior.
 * Only active in development/test environments.
 * 
 * Body:
 *   userId: string - User ID
 *   sessionsUsed: number - Number of sessions used this week
 * 
 * Headers:
 *   x-test-secret: must match TEST_API_SECRET env var
 */
export async function POST(req: NextRequest) {
  // Only allow in development or test
  if (
    process.env.NODE_ENV !== 'test' &&
    process.env.NODE_ENV !== 'development'
  ) {
    return NextResponse.json(
      { error: 'Test route disabled' },
      { status: 404 }
    );
  }

  // Verify test secret
  if (!process.env.TEST_API_SECRET) {
    return NextResponse.json(
      { error: 'TEST_API_SECRET not configured' },
      { status: 500 }
    );
  }

  const testSecret = req.headers.get('x-test-secret');
  if (testSecret !== process.env.TEST_API_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { userId, sessionsUsed } = body;

    if (!userId || typeof sessionsUsed !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    const { getServiceClient } = await import('@/lib/supabase/service');
    const supabase = getServiceClient();

    // Calculate week start date (Monday UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - offset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Upsert weekly usage record
    const { error } = await supabase.from('user_weekly_usage').upsert(
      {
        user_id: userId,
        week_start_date: weekStartStr,
        sessions_used: sessionsUsed,
      },
      { onConflict: 'user_id, week_start_date' }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[test/set-weekly-usage] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
