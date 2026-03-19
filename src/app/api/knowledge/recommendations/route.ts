import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildStudentContext } from '@/lib/kai-context';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentContext = await buildStudentContext(user.id);

    return NextResponse.json({
      hasCompletedDiagnostic: studentContext.hasCompletedDiagnostic,
      nextRecommendedConcept: studentContext.nextRecommendedConcept,
      weakestConcepts: studentContext.weakestConcepts,
      strongestConcepts: studentContext.strongestConcepts,
      allConceptSummaries: studentContext.allConceptSummaries,
      subscription: studentContext.subscription,
    });
  } catch (error: unknown) {
    await logSystemEvent({
      type: 'db_error',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { context: 'knowledge_recommendations.get' },
    });

    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 });
  }
}
