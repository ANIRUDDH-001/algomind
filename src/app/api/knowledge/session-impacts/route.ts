/**
 * GET /api/knowledge/session-impacts?sessionId=X
 * Returns concept confidence deltas for a given interview session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: signals, error: signalsError } = await getServiceClient()
    .from('learning_signals')
    .select('concept_slug, delta, confidence_before, confidence_after')
    .eq('session_id', sessionId)
    .eq('user_id', user.id);

  if (signalsError) {
    return NextResponse.json({ error: 'Failed to fetch learning signals' }, { status: 500 });
  }

  if (!signals || signals.length === 0) {
    return NextResponse.json({ impacts: [] });
  }

  const slugs = signals.map((signal) => signal.concept_slug).filter(Boolean);
  const { data: tags } = await getServiceClient()
    .from('concept_tags')
    .select('id, display_name')
    .in('id', slugs);

  const tagMap = new Map((tags ?? []).map((tag) => [tag.id, tag.display_name]));

  const impacts = signals.map((signal) => ({
    slug: signal.concept_slug,
    displayName: tagMap.get(signal.concept_slug) ?? signal.concept_slug,
    delta: Number(signal.delta),
    confidenceAfter: Number(signal.confidence_after),
  }));

  return NextResponse.json({ impacts });
}
