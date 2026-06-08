/**
 * @codesage
 * @file      src/app/api/learn/concept/route.ts
 * @purpose   Kai-Tutor concept-scoped teaching session API (Phase 2C).
 * @tech      Next.js, Supabase, AI Client
 * @connects  @/lib/supabase/server, @/lib/supabase/service, @/lib/ai/client, @/lib/learn/tutor-prompt, @/lib/kai-context, @/lib/knowledge-graph, @/lib/rate-limit/weekly-session-limiter, @/lib/rate-limit/ip-rate-limiter, @/lib/monitoring/events, @/lib/tracing/correlation
 * @apis      AI Providers via @/lib/ai/client
 * @db        learn_sessions, concept_tags
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck


import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getAIClient } from '@/lib/ai/client';
import { buildKaiTutorSystemPrompt } from '@/lib/learn/tutor-prompt';
import { buildStudentContext, invalidateStudentContext } from '@/lib/kai-context';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { checkAndIncrementWeeklySession } from '@/lib/rate-limit/weekly-session-limiter';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationIdFromRequest, withCorrelationIdHeaders } from '@/lib/tracing/correlation';
import type { ConceptTag } from '@/types/knowledge-graph';
import type { KaiTutorAssessment } from '@/lib/knowledge-graph/types';

export const maxDuration = 60;

const LEARN_SESSION_MAX_TURNS = 20;

interface LearnConceptRequestBody {
  conceptSlug: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  sessionId?: string;
  action?: 'start' | 'turn' | 'end';
}

interface ConceptProgressSnapshot {
  conceptSlug: string;
  confidenceBefore: number;
  confidenceAfter: number;
  confidenceDelta: number;
}

async function verifySessionOwnership(sessionId: string, userId: string): Promise<boolean> {
  const { data, error } = await getServiceClient()
    .from('learn_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(req);
  const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
    NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return jsonWithCorrelationId({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const ipRateLimit = await checkIpRateLimit(ip, {
      maxRequests: 30,
      windowSeconds: 60,
      endpoint: 'learn_concept',
    });
    if (ipRateLimit.allowed === false) {
      return jsonWithCorrelationId({ error: 'Too many requests' }, { status: 429 });
    }

    let body: LearnConceptRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonWithCorrelationId({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { conceptSlug, messages, sessionId, action = 'turn' } = body;

    if (!conceptSlug) {
      return jsonWithCorrelationId({ error: 'conceptSlug is required' }, { status: 400 });
    }

    if (!Array.isArray(messages)) {
      return jsonWithCorrelationId({ error: 'messages must be an array' }, { status: 400 });
    }

    const { data: conceptTag, error: tagError } = await getServiceClient()
      .from('concept_tags')
      .select('*')
      .eq('id', conceptSlug)
      .eq('is_active', true)
      .single();

    if (tagError || !conceptTag) {
      console.error('[learn/concept 400] tagError:', JSON.stringify(tagError), '| conceptSlug received:', conceptSlug);
      return jsonWithCorrelationId({ error: 'Invalid or unknown concept slug' }, { status: 400 });
    }

    let activeSessionId = sessionId;
    const isFirstTurn = action === 'start' || !sessionId;

    if (isFirstTurn) {
      const limitResult = await checkAndIncrementWeeklySession(user.id, 'learn');
      if (!limitResult.allowed) {
        return jsonWithCorrelationId(
          {
            error: 'Weekly learn session limit reached.',
            code: 'LIMIT_REACHED',
            sessionsUsed: limitResult.sessionsUsed,
            limit: limitResult.limit,
            sessionType: 'learn',
          },
          { status: 429 }
        );
      }

      const { data: newSession, error: sessionError } = await getServiceClient()
        .from('learn_sessions')
        .insert({
          user_id: user.id,
          concept_slug: conceptSlug,
          status: 'active',
          session_type: 'concept',
          transcript: [],
          exchange_count: 0,
        })
        .select('id')
        .single();

      if (sessionError || !newSession) {
        await logSystemEvent({
          type: 'db_error',
          userId: user.id,
          correlationId,
          errorMessage: sessionError?.message ?? 'create learn session failed',
          metadata: { context: 'learn_concept.create_session', conceptSlug },
        });
        return jsonWithCorrelationId({ error: 'Failed to start learning session' }, { status: 500 });
      }

      activeSessionId = newSession.id;
    } else {
      if (!activeSessionId) {
        return jsonWithCorrelationId({ error: 'sessionId is required for turn/end actions' }, { status: 400 });
      }
      const ownedByUser = await verifySessionOwnership(activeSessionId, user.id);
      if (!ownedByUser) {
        return jsonWithCorrelationId({ error: 'Session not found' }, { status: 404 });
      }
    }

    if (action === 'end' && activeSessionId) {
      return handleSessionEnd(activeSessionId, user.id, messages, conceptSlug, correlationId);
    }

    if (messages.length > LEARN_SESSION_MAX_TURNS * 2) {
      if (!activeSessionId) {
        return jsonWithCorrelationId({ error: 'sessionId is required to auto-complete this session' }, { status: 400 });
      }
      return handleSessionEnd(activeSessionId, user.id, messages, conceptSlug, correlationId);
    }

    let studentContext;
    try {
      studentContext = await buildStudentContext(user.id);
    } catch {
      // Context build failure is non-fatal.
    }

    let currentConfidence: number | undefined;
    try {
      const state = await getKnowledgeGraphService().getSingleConceptState(user.id, conceptSlug);
      currentConfidence = state?.confidence;
    } catch {
      // Confidence fetch failure is non-fatal.
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';

    const proactiveNudge = detectProactiveNudge(lastUserMessage);

    const systemPrompt = buildKaiTutorSystemPrompt({
      conceptTag: conceptTag as ConceptTag,
      studentContext,
      currentConfidence,
      exchangeCount: Math.floor(messages.length / 2),
      proactiveNudge,
    });

    const promptTokensEstimate = Math.round(systemPrompt.length / 4);
    if (promptTokensEstimate > 2000) {
      console.warn(`[Learn API] System prompt too large: ~${promptTokensEstimate} tokens`);
      await logSystemEvent({
        type: 'prompt_size_warning',
        userId: user.id,
        correlationId,
        metadata: { tokens: promptTokensEstimate, concept: conceptSlug },
      });
    }

    const aiClient = getAIClient();

    // --- Real SSE Streaming branch ---
    const acceptsStream = req.headers.get('Accept') === 'text/event-stream';

    if (acceptsStream) {
      const encoder = new TextEncoder();
      const capturedSessionId = activeSessionId;
      const capturedConceptSlug = conceptSlug;
      const capturedUserId = user.id;
      const exchangeCount = Math.floor(messages.length / 2) + 1;

      const stream = new ReadableStream({
        async start(controller) {
          const enqueue = (payload: object) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

          let fullText = '';
          try {
            for await (const chunk of aiClient.generateStream(
              messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
              {
                systemPrompt,
                maxTokens: 4096,
                temperature: 0.7,
                signal: req.signal,
                correlationId,
                userId: capturedUserId,
                sessionId: capturedSessionId ?? undefined,
                preferredModel: 'groq',
              }
            )) {
              if (req.signal.aborted) break;
              fullText += chunk;
              enqueue({ delta: chunk });
            }

            const cleaned = fullText.trim();
            let sessionCompleteData = {};

            if (capturedSessionId && cleaned) {
              const newTranscript = [
                ...messages,
                { role: 'assistant' as const, content: cleaned, at: new Date().toISOString() },
              ];

              // Check if we should auto-end or if AI gave a mastery signal (in a future iteration, we can parse `cleaned` for a specific closing string)
              const shouldAutoEnd = exchangeCount >= LEARN_SESSION_MAX_TURNS || cleaned.toLowerCase().includes("you can end the session whenever you're ready");

              if (shouldAutoEnd) {
                const { assessment, conceptProgress } = await processSessionEnd(
                  capturedSessionId, capturedUserId, newTranscript, capturedConceptSlug, correlationId
                );
                sessionCompleteData = { sessionComplete: true, assessment, conceptProgress };
              } else {
                await getServiceClient()
                  .from('learn_sessions')
                  .update({
                    transcript: newTranscript,
                    exchange_count: exchangeCount,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', capturedSessionId)
                  .eq('user_id', capturedUserId);
              }
            }

            enqueue({
              delta: '',
              done: true,
              sessionId: capturedSessionId,
              conceptSlug: capturedConceptSlug,
              exchangeCount,
              isFirstTurn,
              proactiveNudgeApplied: Boolean(proactiveNudge),
              fullText: cleaned,
              ...sessionCompleteData,
            });
          } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            console.error('❌ [learn/concept] Stream error:', err);
            await logSystemEvent({
              type: 'model_error',
              userId: capturedUserId,
              correlationId,
              errorMessage: err instanceof Error ? err.message : String(err),
              metadata: { context: 'learn_concept.stream', conceptSlug: capturedConceptSlug, sessionId: capturedSessionId },
            });
            enqueue({ error: String(err), done: true });
          } finally {
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            } catch {
              // already closed
            }
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...Object.fromEntries(withCorrelationIdHeaders(undefined, correlationId).entries()),
        },
      });
    }

    // --- JSON fallback ---
    const aiResult = await aiClient.generateResponse(
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        preferredModel: 'auto',
        category: 'chat',
        maxTokens: 4096,
        systemPrompt,
        estimatedTokens: 600,
        temperature: 0.7,
        correlationId,
      }
    );

    if (!aiResult.success || !aiResult.response) {
      await logSystemEvent({
        type: 'model_error',
        userId: user.id,
        correlationId,
        errorMessage: aiResult.error ?? 'AI response failed',
        metadata: { context: 'learn_concept.ai_call', conceptSlug, sessionId: activeSessionId },
      });
      return jsonWithCorrelationId({ error: 'AI response failed' }, { status: 503 });
    }

    const cleanResponse = (aiResult.response || '').trim();

    const response = cleanResponse;

    if (activeSessionId) {
      const newTranscript = [
        ...messages,
        { role: 'assistant' as const, content: response, at: new Date().toISOString() },
      ];

      await getServiceClient()
        .from('learn_sessions')
        .update({
          transcript: newTranscript,
          exchange_count: Math.floor(messages.length / 2) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeSessionId)
        .eq('user_id', user.id);
    }

    return jsonWithCorrelationId({
      response,
      sessionId: activeSessionId,
      conceptSlug,
      exchangeCount: Math.floor(messages.length / 2) + 1,
      isFirstTurn,
      proactiveNudgeApplied: Boolean(proactiveNudge),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      correlationId,
      errorMessage,
      metadata: { context: 'learn_concept.unhandled' },
    });
    return jsonWithCorrelationId({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processSessionEnd(
  sessionId: string,
  userId: string,
  messages: { role: string; content: string }[],
  conceptSlug: string,
  correlationId: string
) {
  const assessment = await generateSessionAssessment(messages, conceptSlug, correlationId);

  const startTime = await getSessionStartTime(sessionId, userId);
  const durationSeconds = startTime
    ? Math.round((Date.now() - new Date(startTime).getTime()) / 1000)
    : null;

  await getServiceClient()
    .from('learn_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      transcript: messages,
      duration_seconds: durationSeconds,
      exchange_count: Math.floor(messages.length / 2),
      kai_assessment: {
        notes: assessment.notes,
        confidence_delta: assessment.confidenceDelta,
      },
      concepts_understood: assessment.understood,
      concepts_struggled: assessment.struggled,
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  await getKnowledgeGraphService().onLearnSessionCompleted(sessionId, assessment);
  void invalidateStudentContext(userId);

  const progress = await getConceptProgressSnapshot(userId, conceptSlug, assessment.confidenceDelta);

  return { assessment, conceptProgress: progress };
}

async function handleSessionEnd(
  sessionId: string,
  userId: string,
  messages: { role: string; content: string }[],
  conceptSlug: string,
  correlationId: string
): Promise<NextResponse> {
  try {
    const { assessment, conceptProgress } = await processSessionEnd(
      sessionId, userId, messages, conceptSlug, correlationId
    );

    return NextResponse.json({
      sessionComplete: true,
      sessionId,
      assessment,
      conceptProgress,
    }, {
      headers: withCorrelationIdHeaders(undefined, correlationId),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      userId,
      correlationId,
      errorMessage,
      metadata: { context: 'learn_concept.handle_session_end', sessionId },
    });
    return NextResponse.json({ error: 'Failed to complete session' }, {
      status: 500,
      headers: withCorrelationIdHeaders(undefined, correlationId),
    });
  }
}

async function getConceptProgressSnapshot(
  userId: string,
  conceptSlug: string,
  fallbackDelta: number,
): Promise<ConceptProgressSnapshot> {
  let confidenceAfter = 0.5;
  try {
    const state = await getKnowledgeGraphService().getSingleConceptState(userId, conceptSlug);
    if (typeof state?.confidence === 'number') {
      confidenceAfter = state.confidence;
    }
  } catch {
    // Non-fatal: keep default confidence.
  }

  const confidenceDelta = Number.isFinite(fallbackDelta) ? fallbackDelta : 0;
  const confidenceBefore = Math.max(0, Math.min(1, confidenceAfter - confidenceDelta));

  return {
    conceptSlug,
    confidenceBefore: Number(confidenceBefore.toFixed(3)),
    confidenceAfter: Number(confidenceAfter.toFixed(3)),
    confidenceDelta: Number(confidenceDelta.toFixed(3)),
  };
}

async function generateSessionAssessment(
  messages: { role: string; content: string }[],
  conceptSlug: string,
  correlationId: string
): Promise<KaiTutorAssessment> {
  const assessmentPrompt = `You are analyzing a Kai-Tutor learning session transcript.
Concept taught: ${conceptSlug}

Transcript:
${messages.map((message) => `${message.role}: ${message.content}`).join('\n')}

Assess this session. Respond in JSON only:
{
  "understood": ["concept-slug-1"],
  "struggled": ["concept-slug-2"],
  "notes": "Brief qualitative note about student's understanding",
  "confidence_delta": 0.05
}
understood/struggled are subsets of [${conceptSlug}] - only include if clearly evident.
confidence_delta: -0.1 to +0.15 (positive if understood, negative if struggled, 0 if neutral).`;

  try {
    const aiClient = getAIClient();
    const result = await aiClient.generateResponse(
      [{ role: 'user', content: assessmentPrompt }],
      {
        preferredModel: 'auto',
        category: 'analysis',
        maxTokens: 800,
        systemPrompt: 'You are an assessment AI. Respond with valid JSON only.',
        estimatedTokens: 500,
        temperature: 0.2,
        correlationId,
      }
    );

    if (result.success && result.response) {
      const parsed = JSON.parse(result.response.replace(/```json|```/g, '').trim()) as {
        understood?: unknown;
        struggled?: unknown;
        notes?: unknown;
        confidence_delta?: unknown;
      };
      return {
        understood: Array.isArray(parsed.understood)
          ? parsed.understood.filter((value): value is string => typeof value === 'string')
          : [],
        struggled: Array.isArray(parsed.struggled)
          ? parsed.struggled.filter((value): value is string => typeof value === 'string')
          : [],
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        confidenceDelta: Number(parsed.confidence_delta) || 0,
      };
    }
  } catch {
    // Non-fatal: neutral assessment fallback below.
  }

  return {
    understood: [],
    struggled: [],
    notes: 'Assessment unavailable',
    confidenceDelta: 0,
  };
}

async function getSessionStartTime(sessionId: string, userId: string): Promise<string | null> {
  if (!sessionId) {
    return null;
  }

  const { data } = await getServiceClient()
    .from('learn_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  return data?.started_at ?? null;
}

function detectProactiveNudge(lastUserMessage: string): string | null {
  const trimmed = lastUserMessage.trim().toLowerCase();
  if (!trimmed) {
    return 'Learner appears silent. Offer a gentle nudge and ask one simple guiding question.';
  }

  const silencePatterns = [
    /20\s*s(ec(onds?)?)?\s*(silence|pause)/i,
    /\b(still thinking|thinking\.\.\.|hmm+|umm+)\b/i,
    /^\.{3,}$/,
  ];

  const isSilentPattern = silencePatterns.some((pattern) => pattern.test(trimmed));
  if (!isSilentPattern) {
    return null;
  }

  return 'Learner likely paused for around 20 seconds. Provide a supportive nudge before the next Socratic question.';
}
