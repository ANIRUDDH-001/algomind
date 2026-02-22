import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignToken, candidateName, candidateEmail } = body;

        if (!campaignToken || !candidateName) {
            return NextResponse.json({ error: 'campaignToken and candidateName are required' }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('[Security] SUPABASE_SERVICE_ROLE_KEY is not set — refusing to sign JWT');
            return NextResponse.json(
                { error: 'Server misconfiguration. Contact administrator.' },
                { status: 500 }
            );
        }
        const secret = new TextEncoder().encode(serviceKey);

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
        let existingTranscript;

        // 2. Check for an existing in-progress session for this user + campaign
        if (user) {
            const { data: existingSub } = await supabase
                .from('candidate_submissions')
                .select('id, assigned_problem_id, created_at, current_transcript')
                .eq('campaign_id', campaignRef.id)
                .eq('candidate_id', user.id)
                .eq('status', 'in_progress')
                .single();

            if (existingSub) {
                submissionId = existingSub.id;
                selectedProblemId = existingSub.assigned_problem_id;
                startedAt = existingSub.created_at;
                existingTranscript = existingSub.current_transcript || [];

                // Fetch campaign details without claiming a slot
                const { data: existingCampaign } = await supabase
                    .from('assessment_campaigns')
                    .select('*')
                    .eq('id', campaignRef.id)
                    .single();
                campaignData = existingCampaign;
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

            // Ensure we handle missing assignment_mode gracefully (fall back to fixed)
            const mode = campaignData.assignment_mode || 'fixed';
            selectedProblemId = campaignData.problem_id;

            if (mode === 'pool' && Array.isArray(campaignData.question_pool) && campaignData.question_pool.length > 0) {
                // Pick a random problem ID from the pool
                const pool = campaignData.question_pool;
                selectedProblemId = pool[Math.floor(Math.random() * pool.length)];
            } else if (mode === 'random_difficulty' && campaignData.pool_difficulty) {
                // Fetch all problem IDs matching the difficulty and select one randomly
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

            // Fallback for older existing submissions missing an assigned problem
            // If they had an old session but no assigned_problem_id, we wouldn't reach here normally, 
            // but if we do, this will insert correctly.

            const { data: newSubmission, error: submissionError } = await supabase
                .from('candidate_submissions')
                .insert({
                    campaign_id: campaignData.id,
                    candidate_id: user?.id || null,
                    candidate_name: candidateName,
                    candidate_email: candidateEmail || null,
                    status: 'in_progress',
                    assigned_problem_id: selectedProblemId // Save dynamically assigned problem
                })
                .select('id, created_at')
                .single();

            if (submissionError) {
                throw submissionError;
            }
            submissionId = newSubmission.id;
            startedAt = newSubmission.created_at;
            existingTranscript = [];
        }

        // 4. Fetch Selected Problem Details
        const actualProblemId = selectedProblemId || campaignData?.problem_id;
        const { data: problem, error: problemError } = await supabase
            .from('problems')
            .select('*')
            .eq('id', actualProblemId)
            .single();

        if (problemError || !problem) {
            return NextResponse.json({ error: 'Associated problem not found' }, { status: 404 });
        }

        // 4. Create local session JWT
        const alg = 'HS256';

        // Expiry = time limit + 30 min grace period
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
            problem,
            submissionId: submissionId,
            startedAt,
            existingTranscript,
            timeLimitMins: campaignData.time_limit_mins
        });

    } catch (error: unknown) {
        console.error('[CANDIDATE_START_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
