import React from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CandidateHistoryTable } from '@/components/dashboard/CandidateHistoryTable';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { EmptyState } from '@/components/assessment/EmptyState';
import { getDashboardAveragesAction } from '@/app/actions/dashboard';

export const dynamic = 'force-dynamic';

export default async function AssessmentHistoryPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }


    let leetcodeUsername = null;
    const { data: leetcode } = await supabase
        .from('leetcode_profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();
    if (leetcode) {
        leetcodeUsername = leetcode.username;
    }

    const { data: submissions } = await supabase
        .from('candidate_submissions')
        .select(`
            id, campaign_id, status, overall_score, created_at, completed_at, 
            question_states, current_problem_id,
            assessment_campaigns(title, time_limit_mins, public_token, show_score_to_candidate)
        `)
        .eq('candidate_id', user.id)
        .order('created_at', { ascending: false });

    const submissionsData = (submissions || []).map(sub => {
        const campaign = Array.isArray(sub.assessment_campaigns)
            ? sub.assessment_campaigns[0]
            : sub.assessment_campaigns;
        return {
            ...sub,
            assessment_campaigns: campaign
        };
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div className="max-w-7xl mx-auto">
                <DashboardHeader
                    progress={null}
                    leetcodeUsername={leetcodeUsername}
                />

                <DashboardNav activeTab="campaigns" isLinkMode={true} />

                {(!submissions || submissions.length === 0) ? (
                    <EmptyState
                        title="No campaigns yet!"
                        description="Complete an employer's assessment campaign to see your results here."
                    />
                ) : (
                    <div className="animate-in fade-in duration-700">
                        <div className="mb-6 flex flex-col gap-1">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Your Assessment History</h2>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Track your progress across technical sessions</p>
                        </div>
                        <CandidateHistoryTable submissions={submissionsData} />
                    </div>
                )}
            </div>
        </div>
    );
}
