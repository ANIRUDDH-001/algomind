import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export async function GET() {
  // Auth: must be owner account
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await getServiceClient()
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (profile?.account_type !== 'owner' && profile?.account_type !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Aggregate stats (no PII — aggregates only)
  const [
    userCountRes,
    sessionCountRes,
    conceptStateCountRes,
    diagnosticCountRes,
    weakestConceptRes,
  ] = await Promise.all([
    // Users with at least one concept_state
    getServiceClient()
      .from('concept_states')
      .select('user_id', { count: 'exact', head: true })
      .gt('evidence_count', 0),

    // Total learn sessions this week
    getServiceClient()
      .from('learn_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // Total concept_state records
    getServiceClient()
      .from('concept_states')
      .select('id', { count: 'exact', head: true }),

    // Users who completed diagnostic
    getServiceClient()
      .from('concept_states')
      .select('user_id', { count: 'exact' })
      .gt('evidence_count', 0),

    // Most-struggled concept across all users
    getServiceClient()
      .from('concept_states')
      .select('concept_slug, confidence')
      .order('confidence', { ascending: true })
      .limit(250),
  ]);

  // Compute most-struggled concept
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
}
