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
