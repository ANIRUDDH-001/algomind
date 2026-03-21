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

function isValidMessage(value: unknown): value is { role: 'user' | 'assistant'; content: string } {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildDiagnosticResults(messages: { role: 'user' | 'assistant'; content: string }[]): KGDiagnosticResult[] {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.toLowerCase())
    .join(' ');

  const keywordRules: Array<{ slug: typeof ALL_DSA_CONCEPT_SLUGS[number]; terms: RegExp[] }> = [
    { slug: 'arrays-strings', terms: [/array/i, /string/i, /substring/i] },
    { slug: 'hashmaps-sets', terms: [/hash/i, /map/i, /set/i] },
    { slug: 'two-pointers', terms: [/two pointer/i, /left right/i] },
    { slug: 'sliding-window', terms: [/sliding window/i, /window/i] },
    { slug: 'binary-search', terms: [/binary search/i, /sorted/i] },
    { slug: 'graphs-bfs-dfs', terms: [/graph/i, /bfs/i, /dfs/i] },
    { slug: 'trees-traversal', terms: [/tree/i, /traversal/i] },
    { slug: 'dynamic-programming', terms: [/dynamic programming/i, /dp/i, /memo/i, /tabulation/i] },
  ];

  const baseline = 0.35;

  return keywordRules.map((rule) => {
    const matches = rule.terms.reduce((count, regex) => (regex.test(userText) ? count + 1 : count), 0);
    const confidence = clamp(baseline + matches * 0.14, 0.2, 0.9);
    return {
      conceptSlug: rule.slug,
      confidence: Number(confidence.toFixed(2)),
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

      let nextRecommendedConcept: string | undefined;
      nextRecommendedConcept = (await getKnowledgeGraphService().getNextRecommendedConcept(user.id)) ?? undefined;

      return NextResponse.json({
        success: true,
        initializedCount: body.results.length,
        nextRecommendedConcept,
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
        await fallbackInitializeConceptStates(supabase, user.id, results);
        initializedWithFallback = true;
      }
      
      void invalidateStudentContext(user.id);

      let nextRecommendedConcept: string | undefined;
      try {
        nextRecommendedConcept = (await getKnowledgeGraphService().getNextRecommendedConcept(user.id)) ?? undefined;
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
      });
    }

    if (userTurns >= DIAGNOSTIC_QUESTIONS.length) {
      return NextResponse.json({
        response: "Excellent. I have enough signal to calibrate your AlgoMind profile. Tap 'Finish Diagnostic' and I will generate your personalized learning path.",
        shouldComplete: true,
      });
    }

    return NextResponse.json({
      response: DIAGNOSTIC_QUESTIONS[userTurns] ?? DIAGNOSTIC_QUESTIONS[DIAGNOSTIC_QUESTIONS.length - 1],
      shouldComplete: userTurns + 1 >= DIAGNOSTIC_QUESTIONS.length,
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
