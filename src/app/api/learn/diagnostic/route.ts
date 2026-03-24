import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { invalidateStudentContext } from '@/lib/kai-context';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { KGDiagnosticResult } from '@/lib/knowledge-graph/types';
import { ALL_DSA_CONCEPT_SLUGS } from '@/types/knowledge-graph';
import { mapValueToConfidence, applyMetaDampening } from '@/lib/diagnostic/questions';

interface DiagnosticAnswer {
  questionId: number;
  selectedValue: 1 | 2 | 3 | 4 | 5;
}

interface DiagnosticRequestBody {
  answers?: DiagnosticAnswer[];
  results?: KGDiagnosticResult[];
  messages?: { role: 'user' | 'assistant'; content: string }[];
  sessionId?: string;
  action?: 'turn' | 'complete';
}

// MCQ diagnostic question-to-concept mapping
// Each question tests specific DSA concepts
// Questions 7-8 (Q7: edge cases, Q8: complexity) are meta-skills applying to all concepts
const QUESTION_TO_CONCEPTS_MAP: Record<number, { concepts: readonly string[]; isMeta?: boolean }> = {
  1: { concepts: ['arrays-strings'] },                                      // Q1: Arrays & Strings
  2: { concepts: ['hashmaps-sets'] },                                       // Q2: Hashmaps & Sets
  3: { concepts: ['two-pointers', 'sliding-window'] },                      // Q3: Two-Pointers & Sliding Window
  4: { concepts: ['trees-traversal', 'graphs-bfs-dfs'] },                   // Q4: Trees, Graphs, Recursion
  5: { concepts: ['dynamic-programming'] },                                 // Q5: Dynamic Programming
  6: { concepts: ['binary-search'] },                                       // Q6: Binary Search
  7: { concepts: ALL_DSA_CONCEPT_SLUGS, isMeta: true },                     // Q7: Edge Case Validation (meta)
  8: { concepts: ALL_DSA_CONCEPT_SLUGS, isMeta: true },                     // Q8: Complexity Analysis (meta)
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Build diagnostic results from MCQ answers
 * Maps answer values (1-5) to confidence scores (0.20-0.90)
 * Applies meta-dampening for questions 7-8
 */
function buildDiagnosticResultsFromAnswers(answers: DiagnosticAnswer[]): KGDiagnosticResult[] {
  // Initialize confidence scores for all concepts
  const confidenceMap = new Map<string, number[]>();
  ALL_DSA_CONCEPT_SLUGS.forEach(slug => {
    confidenceMap.set(slug, []);
  });

  // Process each answer
  answers.forEach(({ questionId, selectedValue }) => {
    const mapping = QUESTION_TO_CONCEPTS_MAP[questionId];
    if (!mapping) {
      console.warn(`[Diagnostic] Unknown question ID: ${questionId}`);
      return;
    }

    // Map answer value (1-5) to base confidence (0.20-0.90)
    let baseConfidence = mapValueToConfidence(selectedValue);

    // Apply meta-dampening for meta-skill questions (Q7, Q8)
    if (mapping.isMeta) {
      baseConfidence = applyMetaDampening(baseConfidence, selectedValue);
    }

    // Record score for each concept this question maps to
    mapping.concepts.forEach(concept => {
      const scores = confidenceMap.get(concept) ?? [];
      scores.push(baseConfidence);
      confidenceMap.set(concept, scores);
    });
  });

  // Average the scores for each concept, clamp to [0.2, 0.9]
  return Array.from(confidenceMap.entries()).map(([slug, scores]) => {
    const avgConfidence = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0.35;

    return {
      conceptSlug: slug,
      confidence: Number(clamp(avgConfidence, 0.2, 0.9).toFixed(2)),
    };
  });
}

function isValidDiagnosticResult(value: unknown): value is KGDiagnosticResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.conceptSlug === 'string'
    && item.conceptSlug.length > 0
    && typeof item.confidence === 'number'
    && Number.isFinite(item.confidence)
    && item.confidence >= 0
    && item.confidence <= 1;
}

function isValidAnswer(value: unknown): value is DiagnosticAnswer {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.questionId === 'number'
    && [1, 2, 3, 4, 5, 6, 7, 8].includes(item.questionId)
    && [1, 2, 3, 4, 5].includes(item.selectedValue as number);
}

function isValidMessage(value: unknown): value is { role: 'user' | 'assistant'; content: string } {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
}

async function fallbackInitializeConceptStates(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  results: KGDiagnosticResult[],
): Promise<void> {
  const now = new Date().toISOString();
  const rows = results.map((result) => ({
    user_id: userId,
    concept_slug: result.conceptSlug,
    confidence: result.confidence,
    evidence_count: 1,
    last_session_type: 'diagnostic',
    last_signal_at: now,
    signal_history: [
      {
        type: 'diagnostic_mcq',
        delta: 0,
        at: now,
      },
    ],
  }));

  const { error } = await supabase
    .from('concept_states')
    .upsert(rows, { onConflict: 'user_id,concept_slug' });

  if (!error) {
    return;
  }

  // Secondary fallback when onConflict index differs across environments.
  const slugs = results.map((r) => r.conceptSlug);
  const { error: deleteError } = await supabase
    .from('concept_states')
    .delete()
    .eq('user_id', userId)
    .in('concept_slug', slugs);

  if (deleteError) {
    throw new Error(`fallbackInitializeConceptStates delete failed: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase
    .from('concept_states')
    .insert(rows);

  if (insertError) {
    throw new Error(`fallbackInitializeConceptStates insert failed: ${insertError.message}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const ipRateLimit = await checkIpRateLimit(ip, {
      maxRequests: 30,
      windowSeconds: 60,
      endpoint: 'learn_diagnostic',
    });
    if (ipRateLimit.allowed === false) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: DiagnosticRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Handle direct results submission (legacy support)
    if (Array.isArray(body.results) && body.results.length > 0) {
      if (!body.results.every(isValidDiagnosticResult)) {
        return NextResponse.json({ error: 'results must be a non-empty array of { conceptSlug, confidence }' }, { status: 400 });
      }

      await getKnowledgeGraphService().initializeFromDiagnostic(user.id, body.results);
      void invalidateStudentContext(user.id);

      const nextRecommendedConcept = (await getKnowledgeGraphService().getNextRecommendedConcept(user.id)) ?? undefined;

      return NextResponse.json({
        success: true,
        initializedCount: body.results.length,
        nextRecommendedConcept,
      });
    }

    // Handle MCQ answers submission (new format)
    if (Array.isArray(body.answers) && body.answers.length > 0) {
      if (!body.answers.every(isValidAnswer)) {
        return NextResponse.json({ error: 'answers must be an array of { questionId, selectedValue }' }, { status: 400 });
      }

      // Build diagnostic results from MCQ answers
      const results = buildDiagnosticResultsFromAnswers(body.answers);
      console.log('[Diagnostic API] Generated results from answers:', results);

      let initializedWithFallback = false;
      try {
        await getKnowledgeGraphService().initializeFromDiagnostic(user.id, results);
      } catch (kgError: unknown) {
        const kgErrorMsg = kgError instanceof Error ? kgError.message : String(kgError);
        console.error('[Diagnostic API] KG initialization failed:', kgErrorMsg);
        await logSystemEvent({
          type: 'db_error',
          errorMessage: `KG initialization failed: ${kgErrorMsg}`,
          metadata: { context: 'learn_diagnostic.mcq', userId: user.id, resultsCount: results.length },
        });

        // Fallback: write concept states directly so diagnostic completion still persists.
        await fallbackInitializeConceptStates(supabase, user.id, results);
        initializedWithFallback = true;
      }

      void invalidateStudentContext(user.id);

      let nextRecommendedConcept: string | undefined;
      try {
        nextRecommendedConcept = (await getKnowledgeGraphService().getNextRecommendedConcept(user.id)) ?? undefined;
      } catch (recommendError: unknown) {
        const recErrorMsg = recommendError instanceof Error ? recommendError.message : String(recommendError);
        console.error('[Diagnostic API] KG recommendation failed:', recErrorMsg);
        await logSystemEvent({
          type: 'db_error',
          errorMessage: `KG recommendation failed: ${recErrorMsg}`,
          metadata: { context: 'learn_diagnostic.mcq', userId: user.id },
        });
      }

      return NextResponse.json({
        success: true,
        initializedCount: results.length,
        initializedWithFallback,
        nextRecommendedConcept,
      });
    }

    // Fallback to legacy messages-based flow for backward compatibility
    if (!Array.isArray(body.messages) || !body.messages.every(isValidMessage)) {
      return NextResponse.json({ error: 'Invalid request: must provide answers or messages' }, { status: 400 });
    }

    // Legacy message-based completion flow
    if (body.action === 'complete') {
      return NextResponse.json({ error: 'Message-based diagnostic is deprecated. Use MCQ answers format.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Diagnostic API] Error:', errorMessage);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'learn_diagnostic.post' },
    });

    return NextResponse.json({ error: 'Failed to complete diagnostic' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has completed diagnostic by querying concept_states for evidenceCount
    const { data: conceptStates, error } = await supabase
      .from('concept_states')
      .select('concept_slug, evidence_count')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If any concept_state has evidenceCount > 0, diagnostic has been completed
    const hasCompletedDiagnostic = conceptStates && conceptStates.length > 0 && 
      conceptStates.some((cs: Record<string, unknown>) => (cs.evidence_count as number) > 0);

    return NextResponse.json({
      hasCompletedDiagnostic,
      conceptStateCount: conceptStates?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'learn_diagnostic.verify' },
    });

    return NextResponse.json({ error: 'Failed to verify diagnostic completion' }, { status: 500 });
  }
}
