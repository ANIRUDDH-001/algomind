import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { logSystemEvent } from '@/lib/monitoring/events';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

interface KaiAssessmentPayload {
  notes?: string;
  confidence_delta?: number;
}

function parseAssessment(payload: unknown): KaiAssessmentPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const record = payload as Record<string, unknown>;
  return {
    notes: typeof record.notes === 'string' ? record.notes : undefined,
    confidence_delta: typeof record.confidence_delta === 'number' ? record.confidence_delta : undefined,
  };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params;

  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { data: session, error: sessionError } = await getServiceClient()
      .from('learn_sessions')
      .select('id,user_id,status,concept_slug,duration_seconds,exchange_count,created_at,started_at,completed_at,concepts_understood,concepts_struggled,kai_assessment')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'completed') {
      return NextResponse.json({ error: 'Session is not completed yet' }, { status: 409 });
    }

    const [{ data: conceptTag }, state] = await Promise.all([
      getServiceClient()
        .from('concept_tags')
        .select('id,display_name,icon')
        .eq('id', session.concept_slug)
        .maybeSingle(),
      getKnowledgeGraphService().getSingleConceptState(user.id, session.concept_slug),
    ]);

    const parsed = parseAssessment(session.kai_assessment);
    const confidenceAfter = typeof state?.confidence === 'number' ? state.confidence : 0.5;
    const confidenceDelta = typeof parsed.confidence_delta === 'number' ? parsed.confidence_delta : 0;
    const confidenceBefore = Math.max(0, Math.min(1, confidenceAfter - confidenceDelta));

    return NextResponse.json({
      session: {
        id: session.id,
        conceptSlug: session.concept_slug,
        durationSeconds: session.duration_seconds,
        exchangeCount: session.exchange_count,
        startedAt: session.started_at,
        completedAt: session.completed_at,
      },
      concept: {
        slug: session.concept_slug,
        displayName: conceptTag?.display_name ?? session.concept_slug,
        icon: conceptTag?.icon ?? null,
        confidenceBefore: Number(confidenceBefore.toFixed(3)),
        confidenceAfter: Number(confidenceAfter.toFixed(3)),
        confidenceDelta: Number(confidenceDelta.toFixed(3)),
      },
      assessment: {
        understood: session.concepts_understood ?? [],
        struggled: session.concepts_struggled ?? [],
        notes: parsed.notes ?? '',
        confidenceDelta: Number(confidenceDelta.toFixed(3)),
      },
    });
  } catch (error: unknown) {
    await logSystemEvent({
      type: 'db_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { context: 'learn_results.get', sessionId },
    });

    return NextResponse.json({ error: 'Failed to load learn results' }, { status: 500 });
  }
}
