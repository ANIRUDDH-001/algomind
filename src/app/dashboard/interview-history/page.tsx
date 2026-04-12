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
            assessment_campaigns: campaign ?? { title: 'Assessment (Deleted Campaign)', time_limit_mins: 0, public_token: '', show_score_to_candidate: false }
        };
    });

    // Compute assessment-specific stats from submissions
    const completedSubs = submissionsData.filter(s => s.status === 'completed');
    const avgScore = completedSubs.length > 0
        ? completedSubs.reduce((sum, s) => sum + (s.overall_score || 0), 0) / completedSubs.length
        : 0;
    const latestSub = submissionsData[0];

    const assessmentProgress = submissionsData.length > 0 ? {
        userId: user.id,
        sessions: [],
        totalSessions: submissionsData.length,
        averageScore: avgScore,
        averageScores: {},
        trends: [],
        lastUpdated: latestSub?.created_at || new Date().toISOString(),
    } : null;

    return (
        <div className="min-h-screen text-zinc-100 p-4 sm:p-6 lg:p-8 pb-20 md:pb-4 overflow-x-hidden" style={{ background: 'var(--surface-base)' }}>
            <div className="max-w-7xl mx-auto">
                <DashboardHeader
                    progress={assessmentProgress as any}
                />

                <DashboardNav activeTab="history" isLinkMode={true} />

                {(!submissions || submissions.length === 0) ? (
                    <EmptyState
                        title="No campaigns yet!"
                        description="Complete an employer's assessment campaign to see your results here."
                    />
                ) : (
                    <div className="animate-in fade-in duration-700">
                        <div className="mb-6 flex flex-col gap-1">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Your History</h2>
                            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Track your progress across technical sessions</p>
                        </div>
                        <CandidateHistoryTable submissions={submissionsData} />
                    </div>
                )}
            </div>
        </div>
    );
}
