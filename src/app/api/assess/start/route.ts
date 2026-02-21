import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignToken, candidateName, candidateEmail } = body;

        if (!campaignToken || !candidateName) {
            return NextResponse.json({ error: 'campaignToken and candidateName are required' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // 1. Fetch Campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('*')
            .eq('public_token', campaignToken)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Invalid campaign link' }, { status: 404 });
        }

        if (!campaign.is_active) {
            return NextResponse.json({ error: 'This campaign is no longer active' }, { status: 403 });
        }

        if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This campaign has expired' }, { status: 403 });
        }

        if (campaign.max_uses && campaign.uses_count >= campaign.max_uses) {
            return NextResponse.json({ error: 'This campaign has reached its maximum number of candidates' }, { status: 403 });
        }

        // 2. Fetch Problem
        const { data: problem, error: problemError } = await supabase
            .from('problems')
            .select('*')
            .eq('id', campaign.problem_id)
            .single();

        if (problemError || !problem) {
            return NextResponse.json({ error: 'Associated problem not found' }, { status: 404 });
        }

        // 3. Create Submission record
        const { data: submission, error: submissionError } = await supabase
            .from('candidate_submissions')
            .insert({
                campaign_id: campaign.id,
                candidate_name: candidateName,
                candidate_email: candidateEmail || null,
                status: 'in_progress'
            })
            .select('id')
            .single();

        if (submissionError) {
            throw submissionError;
        }

        // 4. Create local session JWT
        const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY || 'development_secret');
        const alg = 'HS256';

        // Expiry = limits + 30 mins grace period
        const expiryTimeMins = (campaign.time_limit_mins || 45) + 30;
        const exp = Math.floor(Date.now() / 1000) + (expiryTimeMins * 60);

        const sessionToken = await new jose.SignJWT({
            submissionId: submission.id,
            campaignId: campaign.id,
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(secret);

        // 5. Increment uses count
        await supabase
            .from('assessment_campaigns')
            .update({ uses_count: campaign.uses_count + 1 })
            .eq('id', campaign.id);

        return NextResponse.json({
            sessionToken,
            problem,
            submissionId: submission.id
        });

    } catch (error: any) {
        console.error('[CANDIDATE_START_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
