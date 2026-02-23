import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { getServiceClient } from '@/lib/supabase/service';

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionToken, questionStates, currentProblemId } = body;

        if (!sessionToken || !Array.isArray(questionStates)) {
            return NextResponse.json(
                { saved: false },
                { status: 200 }
            );
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('[Security] SUPABASE_SERVICE_ROLE_KEY is not set — refusing to sign JWT');
            return NextResponse.json(
                { saved: false },
                { status: 200 }
            );
        }
        const secret = new TextEncoder().encode(serviceKey);

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Save API] Invalid session token', error);
            // If JWT invalid -> 401
            return NextResponse.json({ saved: false }, { status: 401 });
        }

        const submissionId = payload.submissionId as string;

        const supabaseAdmin = getServiceClient();

        // 3. Call RPC: supabase.rpc('save_question_progress', { p_submission_id, p_question_states, p_current_problem })
        // If the RPC doesn't exist, we fallback to updating candidate_submissions table directly
        const { error: rpcError } = await supabaseAdmin.rpc('save_question_progress', {
            p_submission_id: submissionId,
            p_question_states: questionStates,
            p_current_problem: currentProblemId || null
        });

        if (rpcError) {
            // Fallback just in case
            const { error: updateError } = await supabaseAdmin
                .from('candidate_submissions')
                .update({
                    question_states: questionStates,
                    current_problem_id: currentProblemId || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);

            if (updateError) {
                console.error('[Assess Save] Failed to save progress:', updateError);
                // Return 200 with saved: false so interview doesn't crash
                return NextResponse.json({ saved: false }, { status: 200 });
            }
        }

        return NextResponse.json({ saved: true });

    } catch (error: unknown) {
        console.error('[CANDIDATE_SAVE_PROGRESS_ERROR]', error);
        // Never throw - return 200 to prevent crash
        return NextResponse.json({ saved: false }, { status: 200 });
    }
}
