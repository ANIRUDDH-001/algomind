import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export async function GET() {
  try {
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    const svc = getServiceClient();

    const [
      sessionCountRes,
      conceptStateCountRes,
      diagnosticRes,
      hardestConceptRes,
    ] = await Promise.all([
      svc
        .from('learn_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      svc
        .from('concept_states')
        .select('id', { count: 'exact', head: true }),

      svc.rpc('count_distinct_diagnosed_users'),

      svc.rpc('get_hardest_concepts', { p_limit: 5 }),
    ]);

    if (diagnosticRes.error) {
      console.warn('[kg-stats] count_distinct_diagnosed_users RPC error:', diagnosticRes.error.message);
    }
    if (hardestConceptRes.error) {
      console.warn('[kg-stats] get_hardest_concepts RPC error:', hardestConceptRes.error.message);
    }

    const hardestConcepts = ((hardestConceptRes.data ?? []) as Array<{ concept_slug: string; avg_confidence: number }>)
      .map((row) => ({ slug: row.concept_slug, avg: row.avg_confidence }));

    return NextResponse.json({
      usersWithDiagnostic: (diagnosticRes.data as number | null) ?? 0,
      learnSessionsThisWeek: sessionCountRes.count ?? 0,
      totalConceptStateRows: conceptStateCountRes.count ?? 0,
      hardestConcepts,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'owner_kg_stats.get' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
