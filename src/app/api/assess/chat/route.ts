import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getRedis } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { detectSpokenLanguage } from '@/lib/voice/language-detector';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';

validateEnv();

const MESSAGE_LIMIT = 30; // Max AI turns per assessment session

export async function POST(req: NextRequest) {
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
            return ApiErrors.badRequest('Invalid JSON body');
        }

        const { sessionToken, messages } = body;

        if (!sessionToken) {
            return ApiErrors.unauthorized('Missing session token');
        }

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return ApiErrors.serverError('Server misconfiguration. Contact administrator.');
        }

        // 🔒 Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Chat API] Invalid session token', error);
            return ApiErrors.unauthorized('Invalid or expired session');
        }

        // Fetch user's Hinglish preference (only relevant if global flag is ON)
        let userHinglishEnabled = false;
        if (payload?.sub) {
            const { data: userPref } = await getServiceClient()
                .from('user_preferences')
                .select('hinglish_enabled')
                .eq('user_id', payload.sub)
                .maybeSingle();
            userHinglishEnabled = userPref?.hinglish_enabled ?? false;
        }

        // Hinglish detection — read flag, user pref and sniff last user turn
        const hinglishGlobalEnabled = await getGlobalFeatureFlag('ENABLE_HINGLISH_SUPPORT');
        const hinglishActive = hinglishGlobalEnabled && userHinglishEnabled;
        const lastUserMsg = [...(messages || [])].reverse().find((m: { role: string }) => m.role === 'user');
        const hinglishBlock = (hinglishActive && lastUserMsg && detectSpokenLanguage(lastUserMsg.content ?? '') === 'hinglish')
            ? '\n\nSPOKEN LANGUAGE: Candidate is speaking Hinglish. Mirror naturally with Hindi fillers ' +
            '(yaar, matlab, toh, basically, dekho). Technical terms stay English. NO Devanagari script.'
            : '';

        if (!messages || !Array.isArray(messages)) {
            return ApiErrors.badRequest('Invalid messages format');
        }

        // ── Per-session message rate limit ────────────────────────────────────
        const submissionId = payload.submissionId as string;
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
            let messageCount: string | null = null;
            let dbMessageCount = 0;

            try {
                messageCount = await redis.get<string | null>(messageCountKey);
            } catch (err) {
                console.warn('[Assess Chat] Redis get failed:', err);
                messageCount = null;
            }

            if (messageCount === null || messageCount === '0') {
                // Redis was cleared or never set — re-sync from DB
                const { data: submission } = await getServiceClient()
                    .from('candidate_submissions')
                    .select('current_transcript')
                    .eq('id', submissionId)
                    .single();

                dbMessageCount = submission?.current_transcript
                    ? (Array.isArray(submission.current_transcript) ? submission.current_transcript.length : 0)
                    : 0;

                if (dbMessageCount > 0) {
                    // Re-seed Redis counter from DB
                    // Ensure TTL stays in sync with JWT
                    const jwtExp = payload.exp as number | undefined;
                    const expirySeconds = jwtExp
                        ? Math.max(jwtExp - Math.floor(Date.now() / 1000), 60)
                        : 90 * 60;

                    try {
                        await redis.set(messageCountKey, String(dbMessageCount), { ex: expirySeconds });
                        console.log(`[Assess Chat] Re-synced message count from DB: ${dbMessageCount}`);
                    } catch (err) {
                        console.warn('[Assess Chat] Redis set failed:', err);
                    }
                    messageCount = String(dbMessageCount);
                }
            } else {
                dbMessageCount = parseInt(messageCount, 10);
            }

            try {
                currentCount = await redis.incr(messageCountKey);

                if (currentCount === 1) {
                    // First message — synchronize TTL with remaining JWT lifetime so the
                    // counter expires naturally when the session does.
                    const jwtExp = payload.exp as number | undefined;
                    const expirySeconds = jwtExp
                        ? Math.max(jwtExp - Math.floor(Date.now() / 1000), 60)
                        : 90 * 60; // fallback: 90 min
                    await redis.expire(messageCountKey, expirySeconds);
                }
            } catch (redisErr) {
                console.warn('[Assess Chat] Redis incr failed, using DB count as limit:', redisErr);
                currentCount = dbMessageCount + 1;
                // Persist the increment to DB so at least it's tracked
                // Non-fatal: persist increment to DB so at least it's tracked
            }

            if (currentCount > sessionMessageLimit) {
                return apiError(
                    429,
                    ErrorCodes.MESSAGE_LIMIT,
                    'Message limit reached for this assessment session.',
                    {
                        retryable: true,
                        user_action: 'retry',
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

        let enhancedSystemPrompt = '';

        // Add minimal instructions prioritizing standard assessment style
        enhancedSystemPrompt += '\n\n## CANDIDATE INTERVIEW GUIDELINES\nYou are conducting a technical interview. Keep your answers concise, ask probing questions about space/time complexity, and do not write the code for the candidate.';
        enhancedSystemPrompt += hinglishBlock;

        const result = await client.generateResponse(messages, {
            preferredModel: 'auto',
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate response');
        }

        const cleanResponse = (result.response || '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .trim();

        const response = NextResponse.json({
            response: cleanResponse,
            modelUsed: result.modelUsed,
            provider: result.provider
        });

        // Expose usage counters to the frontend (headers are visible via fetch)
        if (currentCount > 0) {
            response.headers.set('X-Messages-Used', String(currentCount));
            response.headers.set('X-Messages-Limit', String(sessionMessageLimit));
        }

        // Fire-and-forget: Save transcript to DB so it persists on refresh
        const newTranscript = [...messages, { role: 'assistant', content: cleanResponse }];
        const supabaseAdmin = getServiceClient();

        const saveTranscriptWithRetry = async (): Promise<void> => {
            for (let attempt = 1; attempt <= 3; attempt++) {
                const { error } = await supabaseAdmin
                    .from('candidate_submissions')
                    .update({ current_transcript: newTranscript })
                    .eq('id', submissionId);

                if (!error) return;

                console.warn(
                    `[Assess Chat] Transcript save attempt ${attempt}/3 failed:`,
                    error.message
                );

                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 200 * attempt));
                } else {
                    console.error('[Assess Chat] Transcript save failed after 3 retries — logging event');
                    void logSystemEvent({
                        type: 'transcript_save_failed',
                        metadata: { submissionId, attempts: 3, errorCode: error.code }
                    });
                }
            }
        };

        void saveTranscriptWithRetry();

        return response;

    } catch (error: unknown) {
        console.error('❌ [Assess Chat API] Error:', error);
        return ApiErrors.serverError(error instanceof Error ? error.message : 'Internal Server Error');
    }
}
