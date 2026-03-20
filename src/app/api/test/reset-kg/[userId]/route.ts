import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/test/reset-kg/[userId]
 * 
 * Test-only route to reset a user's knowledge graph state.
 * Only active in development/test environments.
 * 
 * Headers:
 *   x-test-secret: must match TEST_API_SECRET env var
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

  const { userId } = await params;

  try {
    const { getServiceClient } = await import('@/lib/supabase/service');
    const supabase = getServiceClient();
    // Clear all concept states for this user
    await supabase
      .from('concept_states')
      .delete()
      .eq('user_id', userId);

    // Clear all learn sessions for this user
    await supabase
      .from('learn_sessions')
      .delete()
      .eq('user_id', userId);

    // Clear weekly usage tracking
    await supabase
      .from('user_weekly_usage')
      .delete()
      .eq('user_id', userId);

    // Clear interview sessions
    await supabase
      .from('interview_sessions')
      .delete()
      .eq('user_id', userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[test/reset-kg] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
