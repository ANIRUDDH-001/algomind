/**
 * @codesage
 * @file      src/app/api/knowledge/session-impacts/route.ts
 * @purpose   Returns concept confidence deltas for a given interview session.
 * @tech      Next.js, Supabase Service Client
 * @connects  @/lib/supabase/server, @/lib/supabase/service, @/lib/monitoring/events
 * @apis      None
 * @db        learning_signals, concept_tags
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET(req: NextRequest) {
  try {
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
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[knowledge/session-impacts] Error:', errMsg);
    void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'knowledge/session-impacts' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
