/**
 * @codesage
 * @file      src/app/api/assess/chat/route.ts
 * @purpose   Handles candidate AI interviews via streaming (SSE) or JSON, applying rate limits and persisting transcripts.
 * @tech      Next.js, jose, Redis, TypeScript, AWS SDK, Groq SDK
 * @connects  @/lib/ai/client, @/lib/assess/jwt, @/lib/monitoring/events, @/lib/upstash/client, @/lib/supabase/service
 * @apis      AI Providers (Groq/Bedrock via getAIClient)
 * @db        candidate_submissions, assessment_campaigns
 * @state     Redis (rate limiting message counts)
 * @env       AWS_ACCESS_KEY_ID (implicitly checked)
 * @issues    Removed console.error and console.warn statements. Empty catch blocks flagged? None found here besides parse Error which returns 400.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getRedis } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { buildPromptVersionHeader, PROMPT_VERSION_TAGS } from '@/lib/interview/prompts';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';
import { getCorrelationIdFromRequest, withCorrelationId } from '@/lib/tracing/correlation';

validateEnv();

const MESSAGE_LIMIT = 30; // Max AI turns per assessment session

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const withCorrelationIdResponse = <T extends Response>(response: T): T => withCorrelationId(response, correlationId);

    try {
        interface ChatRequestBody {
            sessionToken: string;
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            problemContext?: {
                title?: string;
                content?: string;
            };
        }

        let body: ChatRequestBody;
        try {
            const text = await req.text();
            body = JSON.parse(text);
        } catch (_parseError) {
            return withCorrelationIdResponse(ApiErrors.badRequest('Invalid JSON body'));
        }

        const { sessionToken, messages } = body;

        if (!sessionToken) {
            return withCorrelationIdResponse(ApiErrors.unauthorized('Missing session token'));
        }

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return withCorrelationIdResponse(ApiErrors.serverError('Server misconfiguration. Contact administrator.'));
        }

        // 🔒 Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            return withCorrelationIdResponse(ApiErrors.unauthorized('Invalid or expired session'));
        }

        const submissionId = payload.submissionId as string;
        const { data: submission, error: subError } = await getServiceClient()
            .from('candidate_submissions')
            .select('status, analysis_status')
            .eq('id', submissionId)
            .single();

        if (subError || !submission) {
            return withCorrelationIdResponse(ApiErrors.notFound('Submission not found'));
        }

        if (submission.status !== 'in_progress') {
            return apiError(
                409,
                ErrorCodes.SESSION_NOT_ACTIVE,
                `Assessment is ${submission.status}. No further messages allowed.`
            );
        }

        if (submission.analysis_status && submission.analysis_status !== 'pending') {
            return apiError(
                409,
                ErrorCodes.ANALYSIS_STARTED,
                'Assessment analysis has already begun.'
            );
        }

        if (!messages || !Array.isArray(messages)) {
            return withCorrelationIdResponse(ApiErrors.badRequest('Invalid messages format'));
        }

        // ── Per-session message rate limit ────────────────────────────────────
        let sessionMessageLimit = MESSAGE_LIMIT;
        const { data: subForLimit } = await getServiceClient()
            .from('candidate_submissions')
            .select('campaign_id')
            .eq('id', submissionId)
            .single();
        if (subForLimit?.campaign_id) {
            const { data: campForLimit } = await getServiceClient()
                .from('assessment_campaigns')
                .select('max_turns')
                .eq('id', subForLimit.campaign_id)
                .single();
            if (campForLimit?.max_turns) {
                sessionMessageLimit = campForLimit.max_turns;
            }
        }
        const redis = getRedis();
        let currentCount = 0;

        if (redis && submissionId) {
            const messageCountKey = `assess:${submissionId}:msgCount`;
            const jwtExp = payload.exp as number | undefined;
            const expirySeconds = jwtExp
                ? Math.max(jwtExp - Math.floor(Date.now() / 1000), 60)
                : 90 * 60;

            try {
                const existingCount = await redis.get(messageCountKey);

                if (existingCount === null) {
                    // Key does not exist — fetch DB count and initialise atomically
                    const { data: submission } = await getServiceClient()
                        .from('candidate_submissions')
                        .select('current_transcript')
                        .eq('id', submissionId)
                        .single();

                    const dbCount = submission?.current_transcript
                        ? (Array.isArray(submission.current_transcript)
                            ? submission.current_transcript.length
                            : 0)
                        : 0;

                    const initialValue = dbCount + 1; // +1 for the current message

                    // SET key value EX ttl NX — only sets if key does not exist
                    const wasSet = await redis.set(messageCountKey, initialValue, {
                        ex: expirySeconds,
                        nx: true,
                    });

                    if (wasSet === 'OK') {
                        // We won the race — use the value we set
                        currentCount = initialValue;
                    } else {
                        // Another request set the key between our GET and SET — increment that value
                        currentCount = await redis.incr(messageCountKey);
                    }
                } else {
                    // Key exists — just increment
                    currentCount = await redis.incr(messageCountKey);
                }
            } catch (redisErr) {
                const { data: submission } = await getServiceClient()
                    .from('candidate_submissions')
                    .select('current_transcript')
                    .eq('id', submissionId)
                    .single();

                currentCount = submission?.current_transcript
                    ? (Array.isArray(submission.current_transcript)
                        ? submission.current_transcript.length
                        : 0) + 1
                    : 1;
            }

            if (currentCount > sessionMessageLimit) {
                // Return 429 - keep existing response shape for backward compat
                return NextResponse.json(
                    {
                        error: 'Message limit reached for this assessment session.',
                        code: 'message_limit_reached',
                        retryable: false,
                        limitReached: true,
                        messagesUsed: currentCount - 1,
                        messageLimit: sessionMessageLimit,
                    },
                    {
                        status: 429,
                        headers: {
                            'X-Messages-Used': String(currentCount - 1),
                            'X-Messages-Limit': String(sessionMessageLimit),
                        },
                    }
                );
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        const client = getAIClient();

        let enhancedSystemPrompt = `${buildPromptVersionHeader(PROMPT_VERSION_TAGS.assessmentChat)}\n`;

        // Add minimal instructions prioritizing standard assessment style
        enhancedSystemPrompt += '\n\n## CANDIDATE INTERVIEW GUIDELINES\nYou are conducting a technical interview. Keep your answers concise, ask probing questions about space/time complexity, and do not write the code for the candidate.';


        // Helper to persist transcript with retries (shared by both SSE + JSON paths)
        const persistTranscript = async (cleanResponseText: string): Promise<void> => {
            const newTranscript = [...messages, { role: 'assistant', content: cleanResponseText }];
            const supabaseAdmin = getServiceClient();
            for (let attempt = 1; attempt <= 3; attempt++) {
                const { error } = await supabaseAdmin
                    .from('candidate_submissions')
                    .update({ current_transcript: newTranscript })
                    .eq('id', submissionId);
                if (!error) return;
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 200 * attempt));
                } else {
                    await logSystemEvent({
                        type: 'transcript_save_failed',
                        correlationId,
                        metadata: { submissionId, attempts: 3, errorCode: error.code },
                    });
                }
            }
        };

        // --- Real SSE Streaming branch ---
        const acceptsStream = req.headers.get('Accept') === 'text/event-stream';
        const userIdFromJwt = typeof payload.sub === 'string' ? payload.sub : undefined;

        if (acceptsStream) {
            // Pick a streaming provider: Bedrock if configured+enabled, else Groq.
            const bedrockEnabled = !!process.env.AWS_ACCESS_KEY_ID
                && await getGlobalFeatureFlag('ENABLE_AWS_BEDROCK');
            const streamProvider: 'bedrock' | 'groq' = bedrockEnabled ? 'bedrock' : 'groq';

            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const enqueue = (payload: object) =>
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

                    let fullText = '';
                    try {
                        for await (const chunk of client.generateStream(messages, {
                            systemPrompt: enhancedSystemPrompt,
                            maxTokens: 4096,
                            signal: req.signal,
                            correlationId,
                            userId: userIdFromJwt,
                            sessionId: submissionId,
                            preferredModel: streamProvider,
                        })) {
                            if (req.signal.aborted) break;
                            fullText += chunk;
                            enqueue({ delta: chunk });
                        }

                        const cleaned = fullText.trim();

                        // Persist transcript (fire-and-forget to not block stream close)
                        void persistTranscript(cleaned);

                        enqueue({
                            delta: '',
                            done: true,
                            modelUsed: streamProvider,
                            provider: streamProvider,
                            fullText: cleaned,
                            messagesUsed: currentCount,
                            messageLimit: sessionMessageLimit,
                        });
                    } catch (err) {
                        if ((err as Error)?.name === 'AbortError') return;
                        await logSystemEvent({
                            type: 'model_error',
                            correlationId,
                            errorMessage: err instanceof Error ? err.message : String(err),
                            metadata: { context: 'assess_chat.stream', submissionId },
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

            const sseHeaders: Record<string, string> = {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'x-correlation-id': correlationId,
            };
            if (currentCount > 0) {
                sseHeaders['X-Messages-Used'] = String(currentCount);
                sseHeaders['X-Messages-Limit'] = String(sessionMessageLimit);
            }

            return new Response(stream, { headers: sseHeaders });
        }

        // --- JSON fallback ---
        const result = await client.generateResponse(messages, {
            preferredModel: 'auto',
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500,
            correlationId,
            userId: userIdFromJwt,
            sessionId: submissionId,
            promptVersion: PROMPT_VERSION_TAGS.assessmentChat,
            languageCode: 'english',
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate response');
        }

        const cleanResponse = (result.response || '').trim();

        const response = NextResponse.json({
            response: cleanResponse,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
        response.headers.set('x-correlation-id', correlationId);

        // Expose usage counters to the frontend (headers are visible via fetch)
        if (currentCount > 0) {
            response.headers.set('X-Messages-Used', String(currentCount));
            response.headers.set('X-Messages-Limit', String(sessionMessageLimit));
        }

        // Fire-and-forget: Save transcript to DB so it persists on refresh
        void persistTranscript(cleanResponse);

        return response;

    } catch (error: unknown) {
        return withCorrelationIdResponse(ApiErrors.serverError(error instanceof Error ? error.message : 'Internal Server Error'));
    }
}
