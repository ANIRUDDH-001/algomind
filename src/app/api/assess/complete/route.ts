import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';

validateEnv();

// Reduced from 60 — now just JWT verify + DB writes before firing edge function
export const maxDuration = 20;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { sessionToken, transcript, duration, questionStates, totalDuration, integrityFlags } = body;

        // Normalize if old format was sent
        if (!questionStates && transcript) {
            questionStates = [{
                transcript: transcript,
                elapsed_secs: duration || 0
            }];
            totalDuration = duration || 0;
        }

        if (!sessionToken || !Array.isArray(questionStates) || questionStates.length === 0) {
            return NextResponse.json(
                { error: 'Invalid payload: missing sessionToken or questionStates' },
                { status: 400 }
            );
        }

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return NextResponse.json({ error: 'Server misconfiguration. Contact administrator.' }, { status: 500 });
        }

        const supabase = await createServerSupabase();
        const supabaseAdmin = getServiceClient();

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Complete API] Invalid session token', error);
            return NextResponse.json({ error: 'Invalid or expired session. Cannot complete assessment.' }, { status: 401 });
        }

        const submissionId = payload.submissionId as string;

        // 2. Ensure submission hasn't already been completed
        const { data: submission, error: subError } = await supabaseAdmin
            .from('candidate_submissions')
            .select('status, campaign_id, assigned_problem_id, candidate_id')
            .eq('id', submissionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        if (submission.status === 'completed') {
            return NextResponse.json({ error: 'Assessment already completed' }, { status: 400 });
        }

        // 3. Mark as submitted (analysis pending) — atomic guard prevents double-completion
        const { data: updated, error: pendingErr } = await supabaseAdmin
            .from('candidate_submissions')
            .update({
                status: 'completed',
                analysis_status: 'pending',
                completed_at: new Date().toISOString(),
                integrity_flags: integrityFlags ?? [],
                // Save question states for potential retry from owner panel
                question_states: questionStates,
            })
            .eq('id', submissionId)
            .eq('status', 'in_progress')
            .select('id')
            .single();

        if (pendingErr && pendingErr.code !== 'PGRST116') throw pendingErr;

        if (!updated) {
            // Already completed — idempotent success, do not re-trigger edge function
            return NextResponse.json({
                success: true,
                alreadyCompleted: true,
                message: 'Assessment was already marked as completed.',
            });
        }

        // 4. Kick off async analysis (fire and forget — edge function handles its own errors)
        const edgeFunctionSecret = process.env.INTERNAL_API_SECRET;
        if (!edgeFunctionSecret) {
            console.error('[Assess Complete] INTERNAL_API_SECRET not set — skipping async analysis');
        } else {
            // Use supabase.functions.invoke — non-blocking
            await supabaseAdmin
                .from('candidate_submissions')
                .update({ assess_async_trigger_at: new Date().toISOString() })
                .eq('id', submissionId);

            supabaseAdmin.functions.invoke('run-assessment', {
                body: { submissionId, questionStates, integrityFlags, candidateId: submission.candidate_id ?? null },
                headers: { Authorization: `Bearer ${edgeFunctionSecret}` },
            }).catch(err => {
                console.error('[Assess Complete] Edge function invoke failed (non-fatal):', err);
                // Analysis will stay as 'pending' — employer can trigger retry from owner panel
            });
        }

        // 5. Return immediately — candidate doesn't wait for analysis
        return NextResponse.json({
            success: true,
            analysisAvailable: false,
            message: 'Assessment submitted! Your results will be available shortly.',
        });

    } catch (error: unknown) {
        console.error('[CANDIDATE_COMPLETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error processing assessment' }, { status: 500 });
    }
}
