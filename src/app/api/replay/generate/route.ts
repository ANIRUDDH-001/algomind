import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import crypto from 'crypto';

interface ReplayGenerateRequest {
    sessionId: string;
}

interface Annotation {
    timestamp_seconds: number;
    text: string;
    type: 'good' | 'missed' | 'info';
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        if (!supabase) {
            return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json() as ReplayGenerateRequest;
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        // 1. Check if replay already exists
        const { data: existingReplay } = await supabase
            .from('session_replays')
            .select('public_token')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existingReplay) {
            return NextResponse.json({
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
            return NextResponse.json({ error: 'Session not found or forbidden' }, { status: 403 });
        }

        if (!session.transcript || session.transcript.length === 0) {
            return NextResponse.json({ error: 'No transcript available for this session' }, { status: 400 });
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
            const aiResponse = await aiClient.generateResponse([{ role: 'user', content: prompt }], {
                temperature: 0.3
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
                metadata: { context: 'replay_generation_parse', sessionId, error: String(aiErr) }
            });
            // Don't fail the request, just use empty annotations
            annotations = [];
        }

        // 4. Insert into session_replays (using service role to bypass insert RLS if needed, but owner can insert directly)
        const publicToken = crypto.randomUUID();
        const { error: insertError } = await supabase
            .from('session_replays')
            .insert({
                session_id: sessionId,
                user_id: user.id,
                public_token: publicToken,
                annotations: annotations,
                is_public: true
            });

        if (insertError) {
            console.error('[API/Replay] Insert failed:', insertError);
            throw new Error(`DB Insert Error: ${insertError.message}`);
        }

        return NextResponse.json({
            publicToken,
            annotations,
            replayUrl: `/replay/${publicToken}`
        });

    } catch (error) {
        console.error('[API/Replay] Fatal error:', error);
        void logSystemEvent({
            type: 'model_error',
            metadata: { context: 'api_replay_generate_catch', error: String(error) }
        });
        return NextResponse.json({ error: 'Internal server error while generating replay' }, { status: 500 });
    }
}
