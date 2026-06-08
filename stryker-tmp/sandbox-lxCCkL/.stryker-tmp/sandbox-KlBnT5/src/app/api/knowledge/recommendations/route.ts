/**
 * @codesage
 * @file      src/app/api/knowledge/recommendations/route.ts
 * @purpose   Fetches personalized learning recommendations based on knowledge context.
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/kai-context, @/lib/monitoring/events
 * @apis      None
 * @db        None directly (handled by kai-context)
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

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
      // Canonical keys
      nextConcept: studentContext.nextRecommendedConcept,
      weakest: studentContext.weakestConcepts,
      // Backward-compatible aliases
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
