import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';
import { getCircuitState } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';

validateEnv();

// Reduced from 60 — now just JWT verify + DB writes before firing edge function
export const maxDuration = 20;

const INVOKE_MAX_ATTEMPTS = 4;
const INVOKE_BACKOFF_MS = [100, 500, 2000];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkDependenciesHealthy(submissionId: string) {
    const supabaseAdmin = getServiceClient();

    const { error: dbError } = await supabaseAdmin
        .from('candidate_submissions')
        .select('id')
        .eq('id', submissionId)
        .single();

    const circuit = getCircuitState();

    return {
        dbOk: !dbError,
        redisOk: circuit.state !== 'open',
        circuitState: circuit.state,
    };
}

export async function POST(req: NextRequest) {
    try {
        let body;
        try {
            body = await req.json();
        } catch (_parseError) {
            return ApiErrors.badRequest('Invalid JSON body');
        }
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
            return ApiErrors.badRequest('Invalid payload: missing sessionToken or questionStates');
        }

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return ApiErrors.serverError('Server misconfiguration. Contact administrator.');
        }

        const supabaseAdmin = getServiceClient();

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Complete API] Invalid session token', error);
            return ApiErrors.unauthorized('Invalid or expired session. Cannot complete assessment.');
        }

        const submissionId = payload.submissionId as string;

        // 2. Ensure submission hasn't already been completed
        const { data: submission, error: subError } = await supabaseAdmin
            .from('candidate_submissions')
            .select('status, campaign_id, assigned_problem_id, candidate_id')
            .eq('id', submissionId)
            .single();

        if (subError || !submission) {
            return ApiErrors.notFound('Submission not found');
        }

        if (submission.status === 'completed') {
            return NextResponse.json({
                success: true,
                alreadyCompleted: true,
                message: 'Already completed',
            });
        }

        if (submission.status === 'expired') {
            return apiError(410, ErrorCodes.CAMPAIGN_EXPIRED, 'This assessment has expired.');
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
            .select('id, candidate_id')
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

        if (updated.candidate_id) {
            // Non-blocking cache invalidation to keep next student context fresh.
            void invalidateStudentContext(updated.candidate_id);
        }

        const dependencyHealth = await checkDependenciesHealthy(submissionId);
        if (!dependencyHealth.dbOk || !dependencyHealth.redisOk) {
            void logSystemEvent({
                type: 'route_error',
                errorMessage: 'Assessment async queue denied due to unhealthy dependencies',
                metadata: {
                    route: 'assess_complete',
                    submissionId,
                    dbOk: dependencyHealth.dbOk,
                    redisOk: dependencyHealth.redisOk,
                    circuitState: dependencyHealth.circuitState,
                },
            });

            return NextResponse.json({
                success: false,
                error: 'Analysis service temporarily unavailable. Please retry in a moment.',
            }, { status: 503 });
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

            void (async () => {
                let lastInvokeError: unknown = null;

                for (let attempt = 1; attempt <= INVOKE_MAX_ATTEMPTS; attempt++) {
                    try {
                        await supabaseAdmin.functions.invoke('run-assessment', {
                            body: {
                                submissionId,
                                questionStates,
                                integrityFlags,
                                candidateId: submission.candidate_id ?? null,
                                retryConfig: {
                                    maxAttempts: INVOKE_MAX_ATTEMPTS,
                                    backoffMs: INVOKE_BACKOFF_MS,
                                },
                            },
                            headers: { Authorization: `Bearer ${edgeFunctionSecret}` },
                        });

                        return;
                    } catch (err) {
                        lastInvokeError = err;
                        const waitMs = INVOKE_BACKOFF_MS[attempt - 1] ?? 0;
                        if (waitMs > 0) {
                            await sleep(waitMs);
                        }
                    }
                }

                const errMsg = lastInvokeError instanceof Error
                    ? lastInvokeError.message
                    : String(lastInvokeError);

                await supabaseAdmin
                    .from('candidate_submissions')
                    .update({
                        analysis_status: 'failed',
                        analysis_error: `analysis_invoke_failed_after_retries: ${errMsg}`.slice(0, 500),
                    })
                    .eq('id', submissionId)
                    .eq('analysis_status', 'pending');

                void logSystemEvent({
                    type: 'route_error',
                    errorMessage: 'run-assessment invoke failed after retries',
                    metadata: {
                        route: 'assess_complete',
                        submissionId,
                        attempts: INVOKE_MAX_ATTEMPTS,
                        error: errMsg,
                    },
                });
            })();
        }

        // 5. Return immediately — candidate doesn't wait for analysis
        return NextResponse.json({
            success: true,
            analysisAvailable: false,
            message: 'Assessment submitted! Your results will be available shortly.',
        });

    } catch (error: unknown) {
        console.error('[CANDIDATE_COMPLETE_ERROR]', error);
        return ApiErrors.serverError('Internal server error processing assessment');
    }
}
