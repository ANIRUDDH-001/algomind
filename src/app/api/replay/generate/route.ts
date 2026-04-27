import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationIdFromRequest, withCorrelationIdHeaders } from '@/lib/tracing/correlation';
import { apiError, ErrorCodes } from '@/lib/api/error-response';
import crypto from 'crypto';

interface ReplayGenerateRequest {
    sessionId: string;
}

interface Annotation {
    timestamp_seconds: number;
    text: string;
    type: 'good' | 'missed' | 'info';
}

const DEFAULT_REPLAY_TTL_DAYS = 30;

function getReplayTtlDays(): number {
    const raw = process.env.REPLAY_TOKEN_TTL_DAYS;
    if (!raw) return DEFAULT_REPLAY_TTL_DAYS;

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_REPLAY_TTL_DAYS;
    }

    // Product policy allows shorter TTL than default, but not longer public exposure windows.
    return Math.min(parsed, DEFAULT_REPLAY_TTL_DAYS);
}

function getReplayExpiryIso(now = new Date()): string {
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + getReplayTtlDays());
    return expiresAt.toISOString();
}

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });
    const errorWithCorrelationId = (status: number, code: (typeof ErrorCodes)[keyof typeof ErrorCodes], message: string, retryable?: boolean) =>
        apiError(status, code, message, {
            retryable,
            headers: Object.fromEntries(withCorrelationIdHeaders(undefined, correlationId).entries()),
        });

    try {
        const supabase = await createServerSupabase();
        if (!supabase) {
            return errorWithCorrelationId(500, ErrorCodes.INTERNAL_ERROR, 'Supabase client not initialized', true);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return errorWithCorrelationId(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized');
        }

        const body = await req.json() as ReplayGenerateRequest;
        const { sessionId } = body;

        if (!sessionId) {
            return errorWithCorrelationId(400, ErrorCodes.MISSING_FIELD, 'Missing sessionId');
        }

        // 1. Check if replay already exists
        const nowIso = new Date().toISOString();
        const { data: existingReplay } = await supabase
            .from('session_replays')
            .select('public_token, expires_at')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existingReplay) {
            const isExpired = Boolean(existingReplay.expires_at && existingReplay.expires_at < nowIso);
            if (!isExpired) {
                return jsonWithCorrelationId({
                    publicToken: existingReplay.public_token,
                    replayUrl: `/replay/${existingReplay.public_token}`
                });
            }

            // Expired replays are rotated to a fresh token and TTL.
            const rotatedToken = crypto.randomUUID();
            const rotatedExpiresAt = getReplayExpiryIso();
            const { error: rotateError } = await supabase
                .from('session_replays')
                .update({
                    public_token: rotatedToken,
                    expires_at: rotatedExpiresAt,
                    is_public: true,
                })
                .eq('session_id', sessionId)
                .eq('user_id', user.id);

            if (!rotateError) {
                return jsonWithCorrelationId({
                    publicToken: rotatedToken,
                    replayUrl: `/replay/${rotatedToken}`,
                    expiresAt: rotatedExpiresAt,
                });
            }

            console.error('[API/Replay] Token rotation failed:', rotateError);
            return jsonWithCorrelationId({
                publicToken: existingReplay.public_token,
                replayUrl: `/replay/${existingReplay.public_token}`
            });
        }

        // 2. Fetch transcript and verify ownership
        const { data: session, error: sessionError } = await supabase
            .from('interview_sessions')
            .select('transcript')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (sessionError || !session) {
            return errorWithCorrelationId(403, ErrorCodes.FORBIDDEN, 'Session not found or forbidden');
        }

        if (!session.transcript || session.transcript.length === 0) {
            return errorWithCorrelationId(400, ErrorCodes.INVALID_INPUT, 'No transcript available for this session');
        }

        // 3. Generate annotations using AI
        const aiClient = getAIClient();
        const turns = Array.isArray(session.transcript) ? session.transcript : [];
        const turnCount = turns.length;
        // Select representative turns: first 3 (problem intro + early approach) + last 4 (solution + wrap-up)
        // This gives annotation coverage across the full session, not just the start
        const representativeTurns = turnCount > 7
            ? [...turns.slice(0, 3), ...turns.slice(-4)]
            : turns;
        const transcriptText = JSON.stringify(representativeTurns).slice(0, 8000);

        const prompt = `Analyze this technical interview transcript and produce exactly 6-8 timestamp annotations.
The interview has ${turnCount} total turns. Each turn represents approximately 30 seconds.

Transcript:
${transcriptText}

Return ONLY a JSON array, no other text:
[{
  "timestamp_seconds": <number: turn_index * 30>,
  "text": "<one specific sentence — what happened at this moment>",
  "type": "<good|missed|info>"
}]

good = positive: identified pattern, good explanation, edge case caught
missed = opportunity: should have asked about constraints, skipped complexity analysis, rushed to code
info = neutral: transition moment, approach change

Be specific to THIS transcript. Max 8 annotations.`;

        let annotations: Annotation[] = [];
        try {
            // generateResponse() centralizes think-tag stripping (Phase 1).
            // Annotations are short structured strings; think tags cannot span them.
            // No additional stripping is needed here.
            const aiResponse = await aiClient.generateResponse([{ role: 'user', content: prompt }], {
                temperature: 0.3,
                correlationId,
            });

            let jsonString = aiResponse.response || '';
            const match = jsonString.match(/\[[\s\S]*\]/);
            if (match) {
                jsonString = match[0];
            }

            const parsed = jsonString ? JSON.parse(jsonString) : [];

            // Validate shape roughly
            if (!Array.isArray(parsed)) {
                annotations = [];
            } else {
                annotations = parsed.filter(a =>
                    a && typeof a === 'object' &&
                    typeof a.timestamp_seconds === 'number' &&
                    typeof a.text === 'string' &&
                    ['good', 'missed', 'info'].includes(a.type)
                ).map(a => ({
                    timestamp_seconds: a.timestamp_seconds,
                    text: String(a.text),
                    type: a.type as 'good' | 'missed' | 'info'
                })).slice(0, 8);
            }
        } catch (aiErr) {
            console.error('[API/Replay] AI Annotation failed:', aiErr);
            void logSystemEvent({
                type: 'model_error',
                correlationId,
                metadata: { context: 'replay_generation_parse', sessionId, error: String(aiErr) }
            });
            // Don't fail the request, just use empty annotations
            annotations = [];
        }

        // 4. Insert into session_replays (using service role to bypass insert RLS if needed, but owner can insert directly)
        const publicToken = crypto.randomUUID();
        const expiresAt = getReplayExpiryIso();
        const { error: insertError } = await supabase
            .from('session_replays')
            .insert({
                session_id: sessionId,
                user_id: user.id,
                public_token: publicToken,
                annotations: annotations,
                is_public: true,
                expires_at: expiresAt,
            });

        if (insertError) {
            console.error('[API/Replay] Insert failed:', insertError);
            throw new Error(`DB Insert Error: ${insertError.message}`);
        }

        return jsonWithCorrelationId({
            publicToken,
            annotations,
            replayUrl: `/replay/${publicToken}`,
            expiresAt,
        });

    } catch (error) {
        console.error('[API/Replay] Fatal error:', error);
        void logSystemEvent({
            type: 'model_error',
            correlationId,
            metadata: { context: 'api_replay_generate_catch', error: String(error) }
        });
        return errorWithCorrelationId(500, ErrorCodes.INTERNAL_ERROR, 'Internal server error while generating replay', true);
    }
}
