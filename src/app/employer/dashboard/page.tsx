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
    const [campaignRes, problemRes] = await Promise.all([
        supabase
            .from('assessment_campaigns')
            .select(`
                *,
                entry_code,
                campaign_questions,
                default_easy_mins,
                default_medium_mins,
                default_hard_mins
            `)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false }),

        supabase
            .from('problems')
            .select('id, title, difficulty')
            .order('title')
    ]);

    const initialCampaigns = campaignRes.data || [];
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
