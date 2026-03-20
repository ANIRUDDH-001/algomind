import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/seed-concept-state
 * 
 * Test-only route to create or update a concept state for a user.
 * Used to set up test scenarios (e.g., returning user state).
 * Only active in development/test environments.
 * 
 * Body:
 *   userId: string - User ID
 *   conceptId: string - Concept ID
 *   due?: string - Due date (ISO string)
 *   interval?: number - FSRS interval
 *   ease?: number - FSRS ease factor
 *   repetitions?: number - FSRS repetitions
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
    const { userId, conceptId, due, interval, ease, repetitions } = body;

    if (!userId || !conceptId) {
      return NextResponse.json(
        { error: 'Missing userId or conceptId' },
        { status: 400 }
      );
    }

    const { getServiceClient } = await import('@/lib/supabase/service');
    const supabase = getServiceClient();

    // Default FSRS values for new concept states
    const now = new Date();
    const defaultDue = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

    const { error } = await supabase.from('concept_states').upsert(
      {
        user_id: userId,
        concept_id: conceptId,
        due: due ?? defaultDue.toISOString(),
        interval: interval ?? 1,
        ease: ease ?? 2.5,
        repetitions: repetitions ?? 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id, concept_id' }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[test/seed-concept-state] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
