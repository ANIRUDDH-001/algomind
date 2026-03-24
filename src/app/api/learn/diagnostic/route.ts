import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { invalidateStudentContext } from '@/lib/kai-context';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { KGDiagnosticResult } from '@/lib/knowledge-graph/types';
import { ALL_DSA_CONCEPT_SLUGS } from '@/types/knowledge-graph';

interface DiagnosticRequestBody {
  results?: KGDiagnosticResult[];
  messages?: { role: 'user' | 'assistant'; content: string }[];
  sessionId?: string;
  action?: 'turn' | 'complete';
}

const DIAGNOSTIC_QUESTIONS = [
  'Great start. When you read a new problem, what is your first mental checklist?',
  'How comfortable are you with arrays and hashmaps in interviews? Give me a recent example.',
  'When would you choose two-pointers or sliding window over brute force?',
  'How do you decide between recursion and iterative approaches for trees/graphs?',
  'How confident are you with dynamic programming state design and transitions?',
  'How do you usually validate edge cases before finalizing code?',
  'How strong are you at complexity analysis under interview pressure?',
  'Last one: what type of problems currently feels most intimidating to you?',
];

const TOTAL_DIAGNOSTIC_QUESTIONS = DIAGNOSTIC_QUESTIONS.length;

function isValidMessage(value: unknown): value is { role: 'user' | 'assistant'; content: string } {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Score user answer sentiment (quality/confidence level)
 * Returns number in [0, 1] range
 */
function scoreAnswerSentiment(answer: string): number {
  const lower = answer.toLowerCase();
  
  // High confidence: strong positive responses
  if (/\b(very well|excellent|strong|confident|master|expert|easy)\b/i.test(lower)) {
    return 0.80;
  }
  
  // Medium-high: "can do" / situational responses
  if (/\b(well|good|comfortable|depending|situation|sometimes|usually|case by case)\b/i.test(lower)) {
    return 0.60;
  }
  
  // Medium: unsure but has some knowledge
  if (/\b(not sure|maybe|some|bit|decent|alright|okay)\b/i.test(lower)) {
    return 0.40;
  }
  
  // Low: clearly weak areas
  if (/\b(don't know|no idea|weak|intimidat|fear|never|don't|lack)\b/i.test(lower)) {
    return 0.25;
  }
  
  // Fallback for dry run / testing / process-based answers
  if (/\b(dry run|test|edge case|validate|check|trace)\b/i.test(lower)) {
    return 0.50;
  }
  
  // Default for unmapped answers
  return 0.35;
}

function buildDiagnosticResults(messages: { role: 'user' | 'assistant'; content: string }[]): KGDiagnosticResult[] {
  const userMessages = messages.filter((message) => message.role === 'user');

  // Question-to-concept mapping per diagnostic flow
  // Each question maps to specific DSA concepts that are tested
  // Meta-skills like edge case validation apply to all concepts
  // Q1: first mental checklist → arrays-strings, hashmaps-sets (general readiness)
  // Q2: comfort with arrays/hashmaps → arrays-strings, hashmaps-sets
  // Q3: two-pointers vs sliding window → two-pointers, sliding-window
  // Q4: recursion vs iterative on trees/graphs → trees-traversal, graphs-bfs-dfs
  // Q5: dynamic programming state design → dynamic-programming, binary-search
  // Q6: validate edge cases → all concepts (meta-skill, apply 0.10 boost)
  // Q7: complexity analysis → all concepts (meta-skill, apply 0.10 boost)
  // Q8: intimidating problems → weak areas, apply 0.15 penalty

  const questionToConceptsMap: Array<{ concepts: (typeof ALL_DSA_CONCEPT_SLUGS[number])[]; isMetaSkill?: boolean; penalty?: number }> = [
    { concepts: ['arrays-strings', 'hashmaps-sets'] },              // Q1: mental checklist
    { concepts: ['arrays-strings', 'hashmaps-sets'] },              // Q2: comfort with arrays/hashmaps
    { concepts: ['two-pointers', 'sliding-window'] },               // Q3: two-pointers vs sliding window
    { concepts: ['trees-traversal', 'graphs-bfs-dfs'] },            // Q4: recursion vs iterative
    { concepts: ['dynamic-programming', 'binary-search'] },         // Q5: DP state design
    { concepts: ['arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window', 'trees-traversal', 'graphs-bfs-dfs', 'binary-search', 'dynamic-programming'], isMetaSkill: true }, // Q6: edge cases (meta)
    { concepts: ['arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window', 'trees-traversal', 'graphs-bfs-dfs', 'binary-search', 'dynamic-programming'], isMetaSkill: true }, // Q7: complexity (meta)
    { concepts: ['dynamic-programming', 'binary-search'], penalty: 0.15 },  // Q8: intimidating (recursion/bit manipulation) → weak areas
  ];

  // Initialize confidence scores for all concepts
  const confidenceMap = new Map<typeof ALL_DSA_CONCEPT_SLUGS[number], number[]>();
  ALL_DSA_CONCEPT_SLUGS.forEach(slug => {
    confidenceMap.set(slug, []);
  });

  // Score each user answer and apply to mapped concepts
  userMessages.forEach((msg, idx) => {
    const answerConfidence = scoreAnswerSentiment(msg.content);
    const conceptMapping = questionToConceptsMap[idx];

    if (conceptMapping) {
      const { concepts, isMetaSkill, penalty } = conceptMapping;
      let adjustedConfidence = answerConfidence;

      // Meta-skills (edge cases, complexity analysis) apply softer boost/penalty
      if (isMetaSkill) {
        adjustedConfidence = 0.5 + (answerConfidence - 0.5) * 0.5; // Dampen swing
      }

      // Apply penalty for intimidating problems
      if (penalty) {
        adjustedConfidence = Math.max(0.2, answerConfidence - penalty);
      }

      // Record score for each concept this question maps to
      concepts.forEach(concept => {
        const scores = confidenceMap.get(concept) ?? [];
        scores.push(adjustedConfidence);
        confidenceMap.set(concept, scores);
      });
    }
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

async function fallbackInitializeConceptStates(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  results: KGDiagnosticResult[],
  sessionId?: string,
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
        type: 'diagnostic_initial',
        delta: 0,
        at: now,
        diagnostic_session_id: sessionId,
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
        totalQuestions: TOTAL_DIAGNOSTIC_QUESTIONS,
      });
    }

    if (!Array.isArray(body.messages) || !body.messages.every(isValidMessage)) {
      return NextResponse.json({ error: 'messages must be an array of { role, content }' }, { status: 400 });
    }

    const userTurns = body.messages.filter((message) => message.role === 'user').length;

    if (body.action === 'complete') {
      const results = buildDiagnosticResults(body.messages);
      
      let initializedWithFallback = false;
      try {
        await getKnowledgeGraphService().initializeFromDiagnostic(user.id, results);
      } catch (kgError: unknown) {
        const kgErrorMsg = kgError instanceof Error ? kgError.message : String(kgError);
        await logSystemEvent({
          type: 'db_error',
          errorMessage: `KG initialization failed: ${kgErrorMsg}`,
          metadata: { context: 'learn_diagnostic.complete', userId: user.id, resultsCount: results.length },
        });

        // Fallback: write concept states directly so diagnostic completion still persists.
        await fallbackInitializeConceptStates(supabase, user.id, results, body.sessionId);
        initializedWithFallback = true;
      }
      
      void invalidateStudentContext(user.id);

      let nextRecommendedConcept: string | undefined;
      try {
        nextRecommendedConcept = (await getKnowledgeGraphService().getNextRecommendedConcept(user.id)) ?? undefined; // Can be reassigned in catch
      } catch (recommendError: unknown) {
        const recErrorMsg = recommendError instanceof Error ? recommendError.message : String(recommendError);
        await logSystemEvent({
          type: 'db_error',
          errorMessage: `KG recommendation failed: ${recErrorMsg}`,
          metadata: { context: 'learn_diagnostic.complete', userId: user.id },
        });
      }

      return NextResponse.json({
        success: true,
        initializedCount: results.length,
        initializedWithFallback,
        nextRecommendedConcept,
        totalQuestions: TOTAL_DIAGNOSTIC_QUESTIONS,
      });
    }

    if (userTurns >= TOTAL_DIAGNOSTIC_QUESTIONS) {
      return NextResponse.json({
        response: "Excellent. I have enough signal to calibrate your AlgoMind profile. Tap 'Finish Diagnostic' and I will generate your personalized learning path.",
        shouldComplete: true,
        userTurns,
        totalQuestions: TOTAL_DIAGNOSTIC_QUESTIONS,
      });
    }

    return NextResponse.json({
      response: DIAGNOSTIC_QUESTIONS[userTurns] ?? DIAGNOSTIC_QUESTIONS[TOTAL_DIAGNOSTIC_QUESTIONS - 1],
      shouldComplete: userTurns + 1 >= TOTAL_DIAGNOSTIC_QUESTIONS,
      userTurns,
      totalQuestions: TOTAL_DIAGNOSTIC_QUESTIONS,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'learn_diagnostic.post' },
    });

    return NextResponse.json({ error: 'Failed to initialize diagnostic results' }, { status: 500 });
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
