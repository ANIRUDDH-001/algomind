import { requireEmployer } from '@/lib/auth/require-employer';
import { redirect } from 'next/navigation';
import { EmployerDashboard } from '@/components/enterprise/EmployerDashboard';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function EmployerDashboardPage() {
    const { user, status } = await requireEmployer();

    if (status !== 200 || !user) {
        // Redirect simple users / unauthorized folks away from the enterprise dashboard
        redirect('/employer');
    }

    const supabase = await createServerSupabase();

    // Prefetch campaigns and available problems for the modal to reduce initial loading flashes
    const [campaignRes, problemRes, countsRes] = await Promise.all([
        supabase
            .from('assessment_campaigns')
            .select('*')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('problems')
            .select('id, title, difficulty')
            .order('title'),
        supabase
            .from('candidate_submissions')
            .select('campaign_id')
    ]);

    const countsMap = (countsRes.data || []).reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.campaign_id] = (acc[curr.campaign_id] || 0) + 1;
        return acc;
    }, {});

    const initialCampaigns = (campaignRes.data || []).map(c => ({
        ...c,
        completed_count: countsMap[c.id] || 0
    }));
    const availableProblems = problemRes.data || [];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8 relative">
                <EmployerDashboard
                    initialCampaigns={initialCampaigns}
                    availableProblems={availableProblems}
                />
            </div>
        </div>
    );
}
