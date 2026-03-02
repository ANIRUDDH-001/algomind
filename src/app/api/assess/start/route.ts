import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { getPhaseContext, type InterviewPhase } from '@/lib/rag/phase-retriever';

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignToken, candidateName, candidateEmail, entryCodeVerified } = body;

        if (!campaignToken || !candidateName) {
            return NextResponse.json({ error: 'campaignToken and candidateName are required' }, { status: 400 });
        }

        const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!jwtSecret) {
            console.error('[Security] SUPABASE_JWT_SECRET is not set — refusing to sign JWT');
            return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
        }
        const secret = new TextEncoder().encode(jwtSecret);

        const supabase = await createServerSupabase();

        // 1. Resolve public_token → internal id
        const { data: campaignRef, error: lookupError } = await supabase
            .from('assessment_campaigns')
            .select('id')
            .eq('public_token', campaignToken)
            .single();

        if (lookupError || !campaignRef) {
            return NextResponse.json(
                { error: 'Assessment link not found or no longer available.' },
                { status: 404 }
            );
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
            let campaignQs = campaignData.campaign_questions || [];

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

            const { data: newSubmission, error: submissionError } = await supabase
                .from('candidate_submissions')
                .insert({
                    campaign_id: campaignData.id,
                    candidate_id: user?.id || null,
                    candidate_name: candidateName,
                    candidate_email: candidateEmail || null,
                    status: 'in_progress',
                    assigned_problem_id: selectedProblemId, // Keep for backward compat
                    question_states: questionStates,
                    entry_code_verified: !!entryCodeVerified
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
        let employerRagContext = '';
        try {
            const firstProblem = problems[0];
            if (firstProblem) {
                const phases: InterviewPhase[] = ['intro', 'approach', 'coding', 'testing', 'complexity', 'wrap-up'];
                const phaseContexts = await Promise.all(
                    phases.map(phase => getPhaseContext(
                        submissionId,
                        phase,
                        firstProblem.title,
                        firstProblem.tags ?? []
                    ))
                );
                employerRagContext = phaseContexts
                    .filter(c => c !== 'No relevant context found.')
                    .join('\n\n===\n\n');
            }
        } catch (err) {
            console.warn('[Assess Start] RAG pre-fetch failed:', err);
        }

        // 5. Create local session JWT
        const alg = 'HS256';

        // Expiry = total time limit + 30 min grace period
        const expiryTimeMins = (campaignData.time_limit_mins || 45) + 30;
        const exp = Math.floor(Date.now() / 1000) + (expiryTimeMins * 60);

        const sessionToken = await new jose.SignJWT({
            submissionId: submissionId,
            campaignId: campaignData.id,
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(secret);

        return NextResponse.json({
            sessionToken,
            submissionId: submissionId,
            startedAt,
            questionStates,
            questions: problems,
            timeLimitMins: campaignData.time_limit_mins,
            showScoreToCandidate: !!campaignData.show_score_to_candidate,
            ragContext: employerRagContext,
        });

    } catch (error: unknown) {
        console.error('[CANDIDATE_START_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
