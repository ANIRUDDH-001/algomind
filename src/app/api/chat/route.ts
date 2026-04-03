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
import { detectSpokenLanguage } from '@/lib/voice/language-detector';
import { chunkTextForSpeech } from '@/lib/voice/text-chunker';
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

        // Read Hinglish feature flag once — used for language detection and prompt injection
        const hinglishEnabled = await getGlobalFeatureFlag('ENABLE_HINGLISH_SUPPORT');

        // 🔒 Auth Check
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch user's Hinglish preference (only relevant if global flag is ON)
        let userHinglishEnabled = false;
        if (user) {
            const { data: userPref } = await supabase
                .from('user_preferences')
                .select('hinglish_enabled')
                .eq('user_id', user.id)
                .maybeSingle();
            userHinglishEnabled = userPref?.hinglish_enabled ?? false;
        }

        // Detect spoken language from the most recent user turn
        const lastUserMessage = [...(messages || [])].reverse().find((m: { role: string }) => m.role === 'user');
        
        // Per-user preference: only activates if global flag is also ON
        const hinglishActive = hinglishEnabled && userHinglishEnabled;
        const spokenLanguage: 'english' | 'hinglish' =
            (hinglishActive && lastUserMessage)
                ? detectSpokenLanguage(lastUserMessage.content ?? '')
                : 'english';
        if (!guestMode && !user) {
            console.warn('⛔ [Chat API] Unauthorized access attempt');
            return withCorrelationIdResponse(ApiErrors.unauthorized('Unauthorized'));
        }

        if (user) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`👤 [Chat API] Authenticated user: ${user.id}`);
            }
            if (!guestMode) {
                const rateLimit = await checkUserRateLimit(user.id);
                if (!rateLimit.allowed) {
                    return withCorrelationIdResponse(ApiErrors.rateLimited('Rate limit exceeded'));
                }
            }
        } else if (guestMode) {
            console.log('👀 [Chat API] Guest mode access');
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? 'unknown';
            const ipRateLimit = await checkIpRateLimit(ip, {
                maxRequests: 100,
                windowSeconds: 86400,
                endpoint: 'chat',
            });
            if (!ipRateLimit.success) {
                return withCorrelationIdResponse(ApiErrors.rateLimited('Guest rate limit exceeded. Please try again later.'));
            }
        }

        if (!messages || !Array.isArray(messages)) {
            return withCorrelationIdResponse(ApiErrors.badRequest('Invalid messages format'));
        }

        if (clientSessionId) {
            const { data: session, error: sessionError } = await supabase
                .from('interview_sessions')
                .select('status')
                .eq('id', clientSessionId)
                .single();

            if (!sessionError && session?.status === 'completed') {
                return withCorrelationIdResponse(apiError(
                    409,
                    ErrorCodes.SESSION_NOT_ACTIVE,
                    'This interview session has been completed.'
                ));
            }
        }

        // ── Phase-aware RAG ───────────────────────────────────────────────
        const STATE_TO_PHASE: Record<string, InterviewPhase> = {
            'idle': 'intro',
            'problem-intro': 'intro',
            'user-thinking': 'approach',
            'ai-clarifying': 'approach',
            'user-solving': 'coding',
            'user-coding': 'coding',
            'ai-feedback': 'coding',
            'solution-review': 'wrap-up',
            'assessment': 'wrap-up',
            'completed': 'wrap-up',
        };

        let ragContext = '';
        if (!guestMode && interviewState && problemContext?.title) {
            // Server-side phase-aware RAG
            const phase = STATE_TO_PHASE[interviewState] ?? 'approach';
            try {
                const phaseRag = await getPhaseContext(
                    supabase,
                    clientSessionId || 'default',
                    phase,
                    problemContext.title,
                    problemContext.tags ?? []
                );
                if (phaseRag && phaseRag !== 'No relevant context found.') {
                    ragContext = phaseRag;
                    console.log(`📚 [RAG] Phase-aware context (${phase}): ${ragContext.length} chars`);
                }
            } catch (err) {
                console.warn('⚠️ [RAG] Phase-aware retrieval failed, falling back to static:', err);
            }
        }

        // Fallback to static pre-embedded context
        if (!ragContext && problemContext?.ragContext && problemContext.ragContext.length > 0) {
            ragContext = problemContext.ragContext;
            console.log(`📚 [RAG] Using pre-embedded context (${ragContext.length} chars) - fallback`);
        }

        const client = getAIClient();

        const effectiveSessionId = clientSessionId || sessionToken || null;
        const callerScope = user?.id || (guestMode ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'guest') : 'anon');
        const promptCacheKey = effectiveSessionId
            ? `ai:chat:system-prompt:${callerScope}:${effectiveSessionId}`
            : null;

        // Build and persist prompt server-side to avoid client-driven prompt overrides.
        let baseSystemPrompt = '';

        if (promptCacheKey) {
            const cached = await redisGet(promptCacheKey);
            if (cached) {
                baseSystemPrompt = cached;
            }
        }

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

        if (promptCacheKey) {
            await redisSet(promptCacheKey, baseSystemPrompt, 7200);
        }

        let enhancedSystemPrompt = `${buildPromptVersionHeader(PROMPT_VERSION_TAGS.interviewChat)}\n${baseSystemPrompt}`;
        if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
            enhancedSystemPrompt = `${buildPromptVersionHeader(PROMPT_VERSION_TAGS.interviewChat)}\n${systemPrompt.trim()}`;
        }
    const hasStudentContextBlock = /<student_context>[\s\S]*?<\/student_context>/i.test(enhancedSystemPrompt);

        const isFirstTurn = (messages?.filter((message) => message.role === 'user').length ?? 0) <= 1;
        const looksLikeInterviewerPrompt = enhancedSystemPrompt.includes('ROLE: Kai - Technical Interviewer')
            || enhancedSystemPrompt.includes('ROLE: Kai — Technical Interviewer');

        const isNewInterviewSession = !guestMode && Boolean(user?.id) && isFirstTurn && looksLikeInterviewerPrompt;

        if (isNewInterviewSession && user?.id) {
            const limitResult = await checkWeeklySessionLimit(user.id, 'interview');
            if (!limitResult.allowed) {
                return withCorrelationIdResponse(apiError(429, ErrorCodes.WEEKLY_LIMIT, 'Weekly interview session limit reached.', {
                    retryable: true,
                    user_action: 'upgrade',
                    headers: {
                        'X-Sessions-Used': String(limitResult.sessionsUsed),
                        'X-Sessions-Limit': String(limitResult.limit),
                    },
                }));
            }

            const incremented = await incrementWeeklyUsage(user.id, 'interview');
            if (!incremented) {
                return withCorrelationIdResponse(apiError(429, ErrorCodes.WEEKLY_LIMIT, 'Weekly interview session limit reached.', {
                    retryable: true,
                    user_action: 'upgrade',
                }));
            }
        }

        let studentContext: StudentContext | undefined;
        if (!guestMode && user?.id && isFirstTurn && looksLikeInterviewerPrompt) {
            try {
                studentContext = await buildStudentContext(user.id);
            } catch {
                // Student context build is non-fatal.
            }
        }

        if (studentContext && !hasStudentContextBlock) {
            enhancedSystemPrompt += `\n\n${buildStudentContextPromptBlock(studentContext)}`;
        }

        if (companyPersona) {
            enhancedSystemPrompt += `\n\n<company_persona>\n${companyPersona}\n</company_persona>`;
            console.log(`🏢 [AI] Applying Company Persona`);
        }

        // Only inject server RAG if it differs from what the client already sent
        if (ragContext) {
            enhancedSystemPrompt += `\n\n<server_rag_context>\n${ragContext}\n</server_rag_context>`;
        }

        // Append Hinglish instruction block when candidate is detected as Hinglish speaker
        const hinglishBlock = (hinglishEnabled && spokenLanguage === 'hinglish')
            ? '\n\nSPOKEN LANGUAGE: Candidate is speaking Hinglish. Mirror naturally with Hindi fillers ' +
            '(yaar, matlab, toh, basically, dekho). Technical terms stay English. NO Devanagari script.'
            : '';
        enhancedSystemPrompt += hinglishBlock;

        // Use the full model registry with proper fallback (same as assess/chat route)
        const result = await client.generateResponse(messages, {
            preferredModel: 'gemini' as any, // Note: when ENABLE_AWS_BEDROCK=ON, Bedrock (Haiku 4.5) runs FIRST regardless of this field. This is the fallback priority if Bedrock is OFF.
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500,
            enableLLMPass: false, // BUG-AI-004 regex only — saves one Groq RPM per request
            correlationId,
            userId: user?.id,
            sessionId: effectiveSessionId ?? undefined,
            promptVersion: PROMPT_VERSION_TAGS.interviewChat,
            languageCode: spokenLanguage,
            ragContextHash: ragContext
                ? createHash('sha256').update(ragContext).digest('hex').slice(0, 16)
                : undefined,
        });

        if (!result.success) {
            console.error('❌ [AI] Generation failed. All models exhausted:', result.error);
            throw new Error(result.error || 'Failed to generate response after exhausting all models');
        }

        console.log(`✨ [AI] Response generated using ${result.modelUsed} (${result.provider})`);

        // Track usage for authenticated users
        if (user && !guestMode) {
            incrementUserUsage(user.id, supabase).catch(err =>
                console.error('❌ [Chat API] Failed to track usage:', err)
            );
        }

        const cleanResponse = (result.response || '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .trim();

        // --- SSE Streaming branch ---
        const acceptsStream = req.headers.get('Accept') === 'text/event-stream';

        if (acceptsStream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        const chunks = chunkTextForSpeech(cleanResponse);
                        for (const chunk of chunks) {
                            const payload = JSON.stringify({ chunk, done: false });
                            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                            // Small delay so TTS can start processing chunk 1
                            await new Promise(r => setTimeout(r, 10));
                        }
                        const donePayload = JSON.stringify({
                            chunk: '',
                            done: true,
                            fullText: cleanResponse,
                            modelUsed: result.modelUsed,
                            provider: result.provider,
                        });
                        controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`));
                    } catch (err) {
                        const errPayload = JSON.stringify({ error: String(err), done: true });
                        controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
                    } finally {
                        controller.close();
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
