import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';
import { logSystemEvent } from '@/lib/monitoring/events';

function redactSensitiveText(text: string): string {
    return text
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
        .replace(/\b(sk|api|token|secret)_[A-Za-z0-9_\-]{8,}\b/gi, '[redacted-secret]')
        .replace(/\b(aws|gcp|azure)?\s*(key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '[redacted-credential]');
}

type TranscriptTurn = { role?: string; content?: string; text?: string; [key: string]: unknown };

function sanitizeTranscriptPayload(transcript: unknown): unknown {
    if (!Array.isArray(transcript)) return transcript;

    return transcript.map((turn) => {
        if (!turn || typeof turn !== 'object') return turn;
        const typedTurn = turn as TranscriptTurn;
        const nextTurn: TranscriptTurn = { ...typedTurn };
        if (typeof typedTurn.content === 'string') {
            nextTurn.content = redactSensitiveText(typedTurn.content);
        }
        if (typeof typedTurn.text === 'string') {
            nextTurn.text = redactSensitiveText(typedTurn.text);
        }
        return nextTurn;
    });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    try {
        const { sessionId } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // Security check: ensure this session belongs to a candidate submission for a campaign owned by this employer
        const { data: submission, error: subError } = await supabase
            .from('candidate_submissions')
            .select('campaign_id')
            .eq('session_id', sessionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('created_by')
            .eq('id', submission.campaign_id)
            .single();

        if (campaignError || !campaign || campaign.created_by !== auth.user.id) {
            return NextResponse.json({ error: 'Unauthorized to view this session' }, { status: 403 });
        }

        // Fetch the session transcript and problem details
        const { data: sessionData, error: sessionError } = await supabase
            .from('interview_sessions')
            .select('transcript, duration, created_at, completed_at, problem_title, problem_id')
            .eq('id', sessionId)
            .single();

        if (sessionError || !sessionData) {
            return NextResponse.json({ error: 'Failed to fetch transcript details' }, { status: 500 });
        }

        const sanitizedSession = {
            ...sessionData,
            transcript: sanitizeTranscriptPayload(sessionData.transcript),
        };

        return NextResponse.json({ session: sanitizedSession });

    } catch (error: unknown) {
        console.error('[TRANSCRIPT_GET_ERROR]', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'employer/transcript' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
