import { createServerSupabase } from '@/lib/supabase/server';
import { CandidateInterview } from '@/components/enterprise/CandidateInterview';
import { FileX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { redirect } from 'next/navigation';

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const supabase = await createServerSupabase();

    const { data: campaign, error } = await supabase
        .from('assessment_campaigns')
        .select('id, title, description, problem_id, time_limit_mins, max_uses, show_score_to_candidate, public_token, expires_at, uses_count, is_active')
        .eq('public_token', token)
        .single();

    if (error || !campaign) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                <Card className="max-w-md w-full p-8 bg-slate-900 border-slate-800">
                    <FileX className="w-16 h-16 text-slate-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-white mb-2">Link Invalid</h1>
                    <p className="text-slate-400">This interview link does not exist or has been removed.</p>
                </Card>
            </div>
        );
    }

    // Check expiration or inactive conditions and route to fallback expired loop
    const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();
    const isMax = campaign.max_uses && campaign.uses_count >= campaign.max_uses;

    if (!campaign.is_active || isExpired || isMax) {
        return redirect(`/assess/${token}/expired`);
    }

    return <CandidateInterview campaign={campaign} />;
}
