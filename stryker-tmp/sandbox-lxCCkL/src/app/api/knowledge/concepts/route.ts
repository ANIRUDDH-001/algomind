/**
 * @codesage
 * @file      src/app/api/knowledge/concepts/route.ts
 * @purpose   Fetches user knowledge graph concept summaries and diagnostic status.
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/knowledge-graph, @/lib/monitoring/events
 * @apis      None
 * @db        None directly (handled by knowledge-graph service)
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [concepts, hasCompletedDiagnostic] = await Promise.all([
      getKnowledgeGraphService().getConceptSummaries(user.id),
      getKnowledgeGraphService().hasCompletedDiagnostic(user.id),
    ]);

    return NextResponse.json({
      concepts,
      hasCompletedDiagnostic,
    });
  } catch (error: unknown) {
    await logSystemEvent({
      type: 'db_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { context: 'knowledge_concepts.get' },
    });

    return NextResponse.json({ error: 'Failed to load concept summaries' }, { status: 500 });
  }
}
