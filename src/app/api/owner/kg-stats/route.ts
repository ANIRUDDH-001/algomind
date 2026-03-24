import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export async function GET() {
  try {
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    const [
      sessionCountRes,
      conceptStateCountRes,
      diagnosticCountRes,
      weakestConceptRes,
    ] = await Promise.all([
      getServiceClient()
        .from('learn_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      getServiceClient()
        .from('concept_states')
        .select('id', { count: 'exact', head: true }),

      getServiceClient()
        .from('concept_states')
        .select('user_id', { count: 'exact' })
        .gt('evidence_count', 0),

      getServiceClient()
        .from('concept_states')
        .select('concept_slug, confidence')
        .order('confidence', { ascending: true })
        .limit(250),
    ]);

    const rows = weakestConceptRes.data ?? [];
    const slugCounts: Record<string, { total: number; count: number }> = {};
    for (const row of rows) {
      if (!slugCounts[row.concept_slug]) slugCounts[row.concept_slug] = { total: 0, count: 0 };
      slugCounts[row.concept_slug].total += row.confidence || 0;
      slugCounts[row.concept_slug].count += 1;
    }
    const avgBySlug = Object.entries(slugCounts)
      .map(([slug, { total, count }]) => ({ slug, avg: total / count }))
      .sort((a, b) => a.avg - b.avg);

    return NextResponse.json({
      usersWithDiagnostic: diagnosticCountRes.count ?? 0,
      learnSessionsThisWeek: sessionCountRes.count ?? 0,
      totalConceptStateRows: conceptStateCountRes.count ?? 0,
      hardestConcepts: avgBySlug.slice(0, 5),
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
