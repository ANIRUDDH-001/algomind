/**
 * @codesage
 * @file      src/app/assess/[token]/page.tsx
 * @purpose   Server component for candidate assessment page
 * @tech      Next.js server component, Supabase
 * @connects  @/lib/supabase/server, @/components/enterprise/CandidateInterview
 * @apis      none
 * @db        supabase.from('assessment_campaigns')
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { createServerSupabase } from '@/lib/supabase/server';
import { CandidateInterview } from '@/components/enterprise/CandidateInterview';
import { notFound, redirect } from 'next/navigation';

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const supabase = await createServerSupabase();

    const { data: campaign, error } = await supabase
        .from('assessment_campaigns')
        .select('id, title, time_limit_mins, max_uses, show_score_to_candidate, public_token, expires_at, uses_count, is_active, campaign_questions, default_easy_mins, default_medium_mins, default_hard_mins')
        .eq('public_token', token)
        .single();

    if (error || !campaign) {
        return notFound();
    }

    // Check expiration or inactive conditions and route to fallback expired loop
    const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();
    const isMax = campaign.max_uses && campaign.uses_count >= campaign.max_uses;

    if (!campaign.is_active || isExpired || isMax) {
        return redirect(`/assess/${token}/expired`);
    }

    return <CandidateInterview campaign={campaign} />;
}
