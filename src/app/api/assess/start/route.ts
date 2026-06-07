/**
 * @codesage
 * @file      src/app/api/assess/start/route.ts
 * @purpose   Initializes an assessment session, claims a slot, and returns a session JWT.
 * @tech      Next.js, jose, Supabase, TypeScript
 * @connects  @/lib/supabase/server, @/lib/assess/jwt, @/lib/monitoring/events, @/lib/rate-limit/ip-rate-limiter
 * @apis      none
 * @db        assessment_campaigns, candidate_submissions, problems, RPC verify_campaign_entry_code, RPC claim_campaign_slot
 * @state     none
 * @env       none
 * @issues    Removed console.error and console.warn. Empty catch block at line 304 for RAG pre-fetch failure flagged.
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';
import { logSystemEvent } from '@/lib/monitoring/events';
// RAG context is now fetched lazily per-phase in assess/chat, not pre-fetched here

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignToken, candidateName, candidateEmail, entryCode } = body;
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'unknown';

        if (!campaignToken || !candidateName) {
            return NextResponse.json({ error: 'campaignToken and candidateName are required' }, { status: 400 });
        }

        let secret: Uint8Array;
        try {
            secret = encodeAssessmentSecret();
        } catch {
            return NextResponse.json({ error: 'Server misconfiguration. Contact administrator.' }, { status: 500 });
        }

        const supabase = await createServerSupabase();

        // 1. Resolve public_token → internal id
        const { data: campaignRef, error: lookupError } = await supabase
            .from('assessment_campaigns')
            .select('id')
            .eq('public_token', campaignToken)
            .single();

        if (lookupError || !campaignRef) {
            await logSystemEvent({
                type: 'route_error',
                errorMessage: 'assess_start_campaign_not_found',
                metadata: {
                    route: 'assess_start',
                    clientIp,
                    campaignToken: String(campaignToken ?? '').slice(0, 16),
                },
            });
            return NextResponse.json(
                { error: 'Assessment link not found or no longer available.' },
                { status: 404 }
            );
        }

        // Re-verify entry code server-side. Client cannot bypass this by sending a boolean flag.
        if (entryCode) {
            const sanitizedCode = String(entryCode).trim().toUpperCase();
            const { data: verifyData, error: verifyError } = await supabase
                .rpc('verify_campaign_entry_code', {
                    p_public_token: campaignToken,
                    p_entry_code: sanitizedCode,
                });
            const verifyResult = Array.isArray(verifyData) ? verifyData[0] : verifyData;
            if (verifyError || !verifyResult?.valid) {
                await logSystemEvent({
                    type: 'client_error',
                    errorMessage: 'assess_start_invalid_entry_code',
                    metadata: {
                        route: 'assess_start',
                        clientIp,
                        campaignId: campaignRef.id,
                    },
                });
                return NextResponse.json(
                    { error: 'Invalid entry code. Please go back and re-enter your code.' },
                    { status: 403 }
                );
            }
        }

        // Rate-limit assessment starts: max 5 per IP per 10 minutes
        // Prevents slot exhaustion from refresh loops or automated bots
        if (clientIp !== 'unknown') {
            const { checkIpRateLimit } = await import('@/lib/rate-limit/ip-rate-limiter');
            const rateCheck = await checkIpRateLimit(clientIp, {
                maxRequests: 5,
                windowSeconds: 600,
                endpoint: 'assess_start',
                failureMode: 'fail-closed',
            });
            if (!rateCheck.success) {
                return NextResponse.json(
                    { error: 'Too many assessment attempts. Please wait a few minutes before trying again.' },
                    { status: 429 }
                );
            }
        }

        // Get authenticated user for the submission
        const { data: { user } } = await supabase.auth.getUser();

        let submissionId;
        let selectedProblemId;
        let campaignData;
        let startedAt;
        let questionStates: any[] = [];

        // 2. Check for an existing in-progress session for this user + campaign
        if (user) {
            const { data: existingSub } = await supabase
                .from('candidate_submissions')
                .select('id, assigned_problem_id, created_at, question_states')
                .eq('campaign_id', campaignRef.id)
                .eq('candidate_id', user.id)
                .eq('status', 'in_progress')
                .single();

            if (existingSub) {
                submissionId = existingSub.id;
                selectedProblemId = existingSub.assigned_problem_id;
                startedAt = existingSub.created_at;

                // Fetch campaign details without claiming a slot
                const { data: existingCampaign } = await supabase
                    .from('assessment_campaigns')
                    .select('*')
                    .eq('id', campaignRef.id)
                    .single();
                campaignData = existingCampaign;

                if (existingSub.question_states && Array.isArray(existingSub.question_states)) {
                    questionStates = existingSub.question_states;
                }
            }
        }

        // 3. If no existing session, claim a slot and create a new submission
        if (!submissionId) {
            const { data: campaign, error: claimError } = await supabase
                .rpc('claim_campaign_slot', { p_campaign_id: campaignRef.id });

            if (claimError || !campaign || campaign.length === 0) {
                return NextResponse.json(
                    { error: 'This assessment link has reached its maximum number of uses or is no longer available.' },
                    { status: 403 }
                );
            }

            campaignData = campaign[0];

            // Build questionStates based on campaign details
            const campaignQs = campaignData.campaign_questions || [];

            if (campaignQs.length > 0) {
                // Resolve random placeholders into actual UUIDs
                const pickedIds = new Set<string>();
                for (const q of campaignQs) {
                    if (q.problem_id && q.problem_id.startsWith('random-')) {
                        const difficulty = q.problem_id.split('-')[1];
                        const { data: qPool, error: poolError } = await supabase
                            .from('problems')
                            .select('id')
                            .eq('difficulty', difficulty);

                        if (!poolError && qPool && qPool.length > 0) {
                            // Filter out already picked problems, but fallback to entire pool if we run out (unlikely)
                            let available = qPool.filter(p => !pickedIds.has(p.id));
                            if (available.length === 0) available = qPool;

                            const chosen = available[Math.floor(Math.random() * available.length)].id;
                            q.problem_id = chosen;
                            pickedIds.add(chosen);
                        }
                    } else {
                        pickedIds.add(q.problem_id);
                    }
                }

                questionStates = campaignQs.map((q: any, i: number) => ({
                    problem_id: q.problem_id,
                    order: i,
                    time_limit_mins: q.time_limit_mins,
                    status: 'not_started',
                    started_at: null,
                    completed_at: null,
                    elapsed_secs: 0,
                    transcript: [],
                    final_code: null
                }));
                // Safe to assume the first ordered problem is assigned first
                selectedProblemId = questionStates[0]?.problem_id || campaignData.problem_id;
            } else {
                // Backwards compatibility for old campaigns
                const mode = campaignData.assignment_mode || 'fixed';
                selectedProblemId = campaignData.problem_id;

                if (mode === 'pool' && Array.isArray(campaignData.question_pool) && campaignData.question_pool.length > 0) {
                    const pool = campaignData.question_pool;
                    selectedProblemId = pool[Math.floor(Math.random() * pool.length)];
                } else if (mode === 'random_difficulty' && campaignData.pool_difficulty) {
                    const { data: difficultyMatch, error: difficultyError } = await supabase
                        .from('problems')
                        .select('id')
                        .eq('difficulty', campaignData.pool_difficulty);

                    if (!difficultyError && difficultyMatch && difficultyMatch.length > 0) {
                        selectedProblemId = difficultyMatch[Math.floor(Math.random() * difficultyMatch.length)].id;
                    }
                }

                if (!selectedProblemId) {
                    return NextResponse.json({ error: 'Campaign misconfigured: No valid problem could be selected' }, { status: 400 });
                }

                questionStates = [{
                    problem_id: selectedProblemId,
                    order: 0,
                    time_limit_mins: campaignData.time_limit_mins || 45,
                    status: 'not_started',
                    started_at: null,
                    completed_at: null,
                    elapsed_secs: 0,
                    transcript: [],
                    final_code: null
                }];
            }

            // expires_at = total assessment time + 2 hour buffer
            // This must stay in sync with the JWT expiry calculated above (totalAssessmentMins + 30 min grace).
            // We add an extra 90 min buffer here so the DB record outlives the JWT slightly.
            const totalAssessmentMinsTemp = questionStates.length > 0
                ? questionStates.reduce((sum, q) => sum + (q.time_limit_mins || 45), 0)
                : (campaignData.time_limit_mins || 45);

            const submissionExpiresAt = new Date(
                Date.now() + (totalAssessmentMinsTemp + 120) * 60 * 1000
            ).toISOString();

            const { data: newSubmission, error: submissionError } = await (user ? supabase : getServiceClient())
                .from('candidate_submissions')
                .insert({
                    campaign_id: campaignData.id,
                    candidate_id: user?.id || null,
                    candidate_name: candidateName,
                    candidate_email: candidateEmail || null,
                    status: 'in_progress',
                    assigned_problem_id: selectedProblemId, // Keep for backward compat
                    question_states: questionStates,
                    entry_code_verified: !!entryCode,
                    expires_at: submissionExpiresAt,
                })
                .select('id, created_at')
                .single();

            if (submissionError) {
                throw submissionError;
            }
            submissionId = newSubmission.id;
            startedAt = newSubmission.created_at;
        }

        // If we still don't have questionStates here (e.g. from an old existing submission format), fallback
        if (!questionStates || questionStates.length === 0) {
            questionStates = [{
                problem_id: selectedProblemId || campaignData?.problem_id,
                order: 0,
                time_limit_mins: campaignData?.time_limit_mins || 45,
                status: 'in_progress', // It was existing but missing new array
                started_at: startedAt,
                completed_at: null,
                elapsed_secs: 0,
                transcript: [],
                final_code: null
            }];
        }

        // 4. Fetch Details for all assigned problems
        const problemIds = questionStates.map(qs => qs.problem_id).filter(Boolean);
        let problems: any[] = [];

        if (problemIds.length > 0) {
            const { data: problemsData, error: problemError } = await supabase
                .from('problems')
                .select('*')
                .in('id', problemIds);

            if (problemError || !problemsData || problemsData.length === 0) {
                return NextResponse.json({ error: 'Associated problem(s) not found' }, { status: 404 });
            }

            // Re-order problems to match the order in questionStates
            problems = questionStates.map(qs => problemsData.find(p => p.id === qs.problem_id)).filter(Boolean);
        }

        // Pre-fetch phase-aware RAG for employer sessions (all 6 phases upfront)
        const employerRagContext = '';
        try {
            // RAG context is fetched lazily per-phase in the assess/chat route.
            // Do NOT pre-fetch all 6 phases here — it adds 500–2000ms to assessment start
            // and wastes Gemini API calls for phases that may never be reached.
            // employerRagContext remains '' — the chat route handles it.
        } catch (err) {
        }

        // 5. Create local session JWT
        const alg = 'HS256';

        // Expiry = SUM of all question time limits + 30 min grace period.
        // For multi-question campaigns, each question has its own time_limit_mins
        // in questionStates. Never use campaignData.time_limit_mins alone — that
        // is the per-question legacy field and ignores additional questions entirely.
        const totalAssessmentMins = questionStates.length > 0
            ? questionStates.reduce((sum, q) => sum + (q.time_limit_mins || 45), 0)
            : (campaignData.time_limit_mins || 45);
        const expiryTimeMins = totalAssessmentMins + 30;
        const exp = Math.floor(Date.now() / 1000) + (expiryTimeMins * 60);

        const sessionToken = await new jose.SignJWT({
            submissionId: submissionId,
            campaignId: campaignData.id,
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setSubject(user?.id ?? '')
            .setExpirationTime(exp)
            .sign(secret);

        return NextResponse.json({
            sessionToken,
            submissionId: submissionId,
            startedAt,
            questionStates,
            questions: problems,
            timeLimitMins: totalAssessmentMins,
            showScoreToCandidate: !!campaignData.show_score_to_candidate,
            ragContext: employerRagContext,
        });

    } catch (error: unknown) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
