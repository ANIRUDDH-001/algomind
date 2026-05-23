import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { incrementUserUsage, checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';
import { checkWeeklySessionLimit, incrementWeeklyUsage } from '@/lib/rate-limit/weekly-session-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getPhaseContext, type InterviewPhase } from '@/lib/rag/phase-retriever';
import type { InterviewState } from '@/lib/interview/state-machine';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { buildStudentContext, buildStudentContextPromptBlock } from '@/lib/kai-context';
import type { StudentContext } from '@/lib/kai-context';
import { buildPromptVersionHeader, generateSystemPromptLegacy, PROMPT_VERSION_TAGS } from '@/lib/interview/prompts';
import { createHash } from 'crypto';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';
import { getCorrelationIdFromRequest, withCorrelationId, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const withCorrelationIdResponse = <T extends Response>(response: T): T => withCorrelationId(response, correlationId);

    try {

        interface ChatRequestBody {
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            systemPrompt?: string;
            problemContext?: {
                title?: string;
                content?: string;
                ragContext?: string;
                tags?: string[];
            };
            guestMode?: boolean;
            companyPersona?: string;
            interviewState?: InterviewState;
            sessionId?: string;
            sessionToken?: string;
            systemPromptTurnLayer?: string;
        }

        let body: ChatRequestBody = { messages: [] };
        try {
            const text = await req.text();
            if (text && text.trim()) {
                body = JSON.parse(text);
            }
        } catch (_parseError) {
            return withCorrelationIdResponse(ApiErrors.badRequest('Invalid JSON body'));
        }
        const {
            messages,
            systemPrompt,
            problemContext,
            guestMode,
            companyPersona,
            interviewState,
            sessionId: clientSessionId,
            sessionToken,
        } = body;

        // 🔒 Auth Check
        const supabase = await createServerSupabase();
        const userIdHeader = req.headers.get('x-user-id');
        let user: { id: string } | null = null;
        
        if (userIdHeader) {
            user = { id: userIdHeader };
        } else if (!guestMode) {
            // Fallback just in case middleware was bypassed
            const { data } = await supabase.auth.getUser();
            user = data.user;
        }

        if (!guestMode && !user) {
            console.warn('⛔ [Chat API] Unauthorized access attempt');
            return withCorrelationIdResponse(ApiErrors.unauthorized('Unauthorized'));
        }

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'unknown';

        // ── Parallelize Pre-AI Data Fetching ──────────────────────────────
        const rateLimitPromise = user && !guestMode
            ? checkUserRateLimit(user.id)
            : guestMode
                ? checkIpRateLimit(ip, { maxRequests: 100, windowSeconds: 86400, endpoint: 'chat' })
                : Promise.resolve({ allowed: true, success: true });

        const sessionStatusPromise = clientSessionId
            ? supabase.from('interview_sessions').select('status').eq('id', clientSessionId).single()
            : Promise.resolve(null);

        const STATE_TO_PHASE: Record<string, InterviewPhase> = {
            'idle': 'intro', 'problem-intro': 'intro', 'user-thinking': 'approach', 'ai-clarifying': 'approach',
            'user-solving': 'coding', 'user-coding': 'coding', 'ai-feedback': 'coding',
            'solution-review': 'wrap-up', 'assessment': 'wrap-up', 'completed': 'wrap-up',
        };

        const ragPromise = (!guestMode && interviewState && problemContext?.title)
            ? getPhaseContext(
                supabase,
                clientSessionId || 'default',
                STATE_TO_PHASE[interviewState] ?? 'approach',
                problemContext.title,
                problemContext.tags ?? []
            ).catch(err => {
                console.warn('⚠️ [RAG] Phase-aware retrieval failed:', err);
                return null;
            })
            : Promise.resolve(null);

        const effectiveSessionId = clientSessionId || sessionToken || null;
        const callerScope = user?.id || (guestMode ? ip : 'anon');
        const promptCacheKey = effectiveSessionId
            ? `ai:chat:system-prompt:${callerScope}:${effectiveSessionId}`
            : null;

        const promptCachePromise = promptCacheKey ? redisGet(promptCacheKey).catch(() => null) : Promise.resolve(null);

        const [rateLimitResult, sessionStatusResult, ragResult, cachedPrompt] = await Promise.all([
            rateLimitPromise,
            sessionStatusPromise,
            ragPromise,
            promptCachePromise
        ]);

        // Evaluate results
        if (user && !guestMode) {
            if (!(rateLimitResult as { allowed: boolean }).allowed) {
                return withCorrelationIdResponse(ApiErrors.rateLimited('Rate limit exceeded'));
            }
        } else if (guestMode) {
            if (!(rateLimitResult as { success: boolean }).success) {
                return withCorrelationIdResponse(ApiErrors.rateLimited('Guest rate limit exceeded. Please try again later.'));
            }
        }

        if (sessionStatusResult?.data?.status === 'completed') {
            return withCorrelationIdResponse(apiError(409, ErrorCodes.SESSION_NOT_ACTIVE, 'This interview session has been completed.'));
        }

        let ragContext = ragResult && ragResult !== 'No relevant context found.' ? ragResult : '';
        if (!ragContext && problemContext?.ragContext) {
            ragContext = problemContext.ragContext;
        }

        let baseSystemPrompt = cachedPrompt || '';
        if (!baseSystemPrompt && problemContext?.title && problemContext?.content) {
            baseSystemPrompt = generateSystemPromptLegacy(
                {
                    id: 'server-generated',
                    title: problemContext.title,
                    content: problemContext.content,
                    description: problemContext.content,
                    difficulty: 'medium',
                },
                ragContext,
                'practice'
            );
        }
        if (!baseSystemPrompt) {
            baseSystemPrompt = generateSystemPromptLegacy(undefined, ragContext, 'practice');
        }

        if (promptCacheKey && !cachedPrompt) {
            redisSet(promptCacheKey, baseSystemPrompt, 7200).catch(() => {});
        }

        let enhancedSystemPrompt = `${buildPromptVersionHeader(PROMPT_VERSION_TAGS.interviewChat)}\n${baseSystemPrompt}`;
        if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
            enhancedSystemPrompt = `${buildPromptVersionHeader(PROMPT_VERSION_TAGS.interviewChat)}\n${systemPrompt.trim()}`;
        }
        const hasStudentContextBlock = /<student_context>[\s\S]*?<\/student_context>/i.test(enhancedSystemPrompt);

        const isFirstTurn = (messages?.filter((message) => message.role === 'user').length ?? 0) <= 1;
        const looksLikeInterviewerPrompt = enhancedSystemPrompt.includes('ROLE: Kai - Technical Interviewer') || enhancedSystemPrompt.includes('ROLE: Kai — Technical Interviewer');
        const isNewInterviewSession = !guestMode && Boolean(user?.id) && isFirstTurn && looksLikeInterviewerPrompt;

        let studentContext: StudentContext | undefined;
        if (isNewInterviewSession && user?.id) {
            const [limitResult, scResult] = await Promise.all([
                checkWeeklySessionLimit(user.id, 'interview'),
                buildStudentContext(user.id).catch(() => undefined)
            ]);

            if (!limitResult.allowed) {
                return withCorrelationIdResponse(apiError(429, ErrorCodes.WEEKLY_LIMIT, 'Weekly interview session limit reached.', {
                    retryable: true,
                    user_action: 'upgrade',
                    headers: { 'X-Sessions-Used': String(limitResult.sessionsUsed), 'X-Sessions-Limit': String(limitResult.limit) },
                }));
            }

            const incremented = await incrementWeeklyUsage(user.id, 'interview');
            if (!incremented) {
                return withCorrelationIdResponse(apiError(429, ErrorCodes.WEEKLY_LIMIT, 'Weekly interview session limit reached.', {
                    retryable: true,
                    user_action: 'upgrade',
                }));
            }
            studentContext = scResult;
        }

        if (studentContext && !hasStudentContextBlock) {
            enhancedSystemPrompt += `\n\n${buildStudentContextPromptBlock(studentContext)}`;
        }

        if (companyPersona) {
            enhancedSystemPrompt += `\n\n<company_persona>\n${companyPersona}\n</company_persona>`;
            if (process.env.NODE_ENV === 'development') {
                console.info('🏢 [AI] Applying Company Persona');
            }
        }

        // Only inject server RAG if it differs from what the client already sent
        if (ragContext) {
            enhancedSystemPrompt += `\n\n<server_rag_context>\n${ragContext}\n</server_rag_context>`;
        }



        // --- Real SSE Streaming branch ---
        // When the client sends `Accept: text/event-stream` we stream tokens from
        // the provider directly. This bypasses the classification / smart-routing
        // layer of generateResponse() in favour of first-token latency.
        const acceptsStream = req.headers.get('Accept') === 'text/event-stream';

        if (acceptsStream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const enqueue = (payload: object) =>
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

                    let fullText = '';
                    let finalProvider = 'auto';
                    try {
                        for await (const chunk of client.generateStream(messages, {
                            systemPrompt: enhancedSystemPrompt,
                            maxTokens: 4096,
                            signal: req.signal,
                            correlationId,
                            userId: user?.id,
                            sessionId: effectiveSessionId ?? undefined,
                            preferredModel: 'auto',
                        })) {
                            if (req.signal.aborted) break;
                            fullText += chunk;
                            enqueue({ delta: chunk });
                        }

                        // NOTE: the client stream does not expose which provider was actually used in chunk mode
                        // We will set modelUsed to 'auto' for now.
                        enqueue({
                            delta: '',
                            done: true,
                            modelUsed: 'auto',
                            provider: 'auto',
                            fullText: fullText.trim(),
                        });
                    } catch (err) {
                        if ((err as Error)?.name === 'AbortError') {
                            // client disconnect — silently close
                            return;
                        }
                        console.error('❌ [Chat API] Stream error:', err);
                        void logSystemEvent({
                            type: 'model_error',
                            errorMessage: err instanceof Error ? err.message : String(err),
                            correlationId,
                        });
                        enqueue({ error: String(err), done: true });
                    } finally {
                        try {
                            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        } catch {
                            // controller may already be closed on abort
                        }
                        try {
                            controller.close();
                        } catch {
                            // already closed
                        }

                        // Track usage for authenticated users (fire-and-forget)
                        if (user && !guestMode) {
                            incrementUserUsage(user.id, supabase).catch(err =>
                                console.error('❌ [Chat API] Failed to track usage:', err)
                            );
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

        // --- JSON fallback (non-streaming clients) ---
        // Use the full model registry with proper fallback (same as assess/chat route)
        const result = await client.generateResponse(messages, {
            // Note: when ENABLE_AWS_BEDROCK=ON, Bedrock (Haiku 4.5) runs FIRST regardless of this field.
            // This is the fallback priority if Bedrock is OFF.
            preferredModel: 'gemini',
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500,
            enableLLMPass: false, // BUG-AI-004 regex only — saves one Groq RPM per request
            correlationId,
            userId: user?.id,
            sessionId: effectiveSessionId ?? undefined,
            promptVersion: PROMPT_VERSION_TAGS.interviewChat,
            languageCode: 'english',
            ragContextHash: ragContext
                ? createHash('sha256').update(ragContext).digest('hex').slice(0, 16)
                : undefined,
        });

        if (!result.success) {
            console.error('❌ [AI] Generation failed. All models exhausted:', result.error);
            throw new Error(result.error || 'Failed to generate response after exhausting all models');
        }

        if (process.env.NODE_ENV === 'development') {
            console.info(`✨ [AI] Response generated using ${result.modelUsed} (${result.provider})`);
        }

        // Track usage for authenticated users
        if (user && !guestMode) {
            incrementUserUsage(user.id, supabase).catch(err =>
                console.error('❌ [Chat API] Failed to track usage:', err)
            );
        }

        const cleanResponse = (result.response || '').trim();

        return NextResponse.json({
            response: cleanResponse,
            modelUsed: result.modelUsed,
            provider: result.provider,
        }, {
            headers: withCorrelationIdHeaders(undefined, correlationId),
        });

    } catch (error: unknown) {
        console.error('❌ [Chat API] Error:', error);
        void logSystemEvent({
            type: 'model_error',
            errorMessage: error instanceof Error ? error.message : String(error),
            correlationId,
        });
        return withCorrelationIdResponse(ApiErrors.serverError(error instanceof Error ? error.message : 'Internal Server Error'));
    }
}
