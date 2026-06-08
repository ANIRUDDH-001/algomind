/**
 * @codesage
 * @file      src/app/api/assess/save-progress/route.ts
 * @purpose   Periodically saves a candidate's assessment progress during an active session.
 * @tech      Next.js, jose, Supabase, TypeScript
 * @connects  @/lib/assess/jwt, @/lib/supabase/service
 * @apis      none
 * @db        candidate_submissions, RPC save_question_progress
 * @state     none
 * @env       none
 * @issues    Removed console.error in catch blocks.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { getServiceClient } from '@/lib/supabase/service';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';

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

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return NextResponse.json({ saved: false }, { status: 500 });
        }

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
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
                // Return 200 with saved: false so interview doesn't crash
                return NextResponse.json({ saved: false }, { status: 200 });
            }
        }

        return NextResponse.json({ saved: true });

    } catch (error: unknown) {
        // Never throw - return 200 to prevent crash
        return NextResponse.json({ saved: false }, { status: 200 });
    }
}
