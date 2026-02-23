import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const { campaignId } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // 1. Verify employer owns the campaign & fetch title
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('id, title')
            .eq('id', campaignId)
            .eq('created_by', auth.user.id)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
        }

        // 2. Fetch all submissions
        const { data: submissions, error: submissionsError } = await supabase
            .from('candidate_submissions')
            .select('id, session_id, candidate_name, candidate_email, status, overall_score, created_at, updated_at, question_states')
            .eq('campaign_id', campaignId)
            .order('overall_score', { ascending: false, nullsFirst: false });

        if (submissionsError) throw submissionsError;

        // 3. Fetch related assessments
        const sessionIds = (submissions || []).map(s => s.session_id).filter(Boolean) as string[];

        let assessments: any[] = [];
        if (sessionIds.length > 0) {
            const { data: assessmentsData, error: assessmentsError } = await supabase
                .from('assessments')
                .select('*')
                .in('session_id', sessionIds);

            if (assessmentsError) throw assessmentsError;
            assessments = assessmentsData || [];
        }

        const assessmentMap = new Map(assessments.map(a => [a.session_id, a]));

        // 4. Build CSV
        // Header
        let csvContent = `Rank,Name,Email,Status,Overall Score,Problem Decomp,Pattern Recognition,Algorithmic Thinking,Complexity Analysis,Communication,Edge Cases,Optimization,Debugging,Started At,Last Active,Time Spent (mins),Q1 Status,Q1 Time (mins),Q2 Status,Q2 Time (mins),Q3 Status,Q3 Time (mins)\n`;

        let currentRank = 1;

        for (const sub of (submissions || [])) {
            const hasScore = typeof sub.overall_score === 'number' || !isNaN(Number(sub.overall_score));
            const rank = hasScore && sub.overall_score !== null && sub.status === 'completed' ? currentRank++ : '';

            const assessment = sub.session_id ? assessmentMap.get(sub.session_id) : null;

            // Format dates safely
            const formatTime = (iso: string) => {
                try {
                    return new Date(iso).toLocaleString().replace(/,/g, '');
                } catch { return ''; }
            };

            const started = sub.created_at ? formatTime(sub.created_at) : '';
            const updated = sub.updated_at ? formatTime(sub.updated_at) : '';

            // Total time spent across questions
            const totalSecs = (sub.question_states || []).reduce((acc: number, q: any) => acc + (q.elapsed_secs || 0), 0);
            const totalMins = (totalSecs / 60).toFixed(1);

            // Per-question timing (up to 3 questions initially)
            const dQ = Array(3).fill({ status: '', time: '' });
            (sub.question_states || []).forEach((qs: any, i: number) => {
                if (i < 3) {
                    dQ[i] = { status: qs.status || '', time: ((qs.elapsed_secs || 0) / 60).toFixed(1) };
                }
            });

            const escapeCSV = (str: any) => {
                if (str === null || str === undefined) return '';
                const s = String(str);
                return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
            };

            const row = [
                rank,
                escapeCSV(sub.candidate_name),
                escapeCSV(sub.candidate_email),
                sub.status,
                sub.overall_score && sub.status === 'completed' ? sub.overall_score.toFixed(1) : '',
                assessment?.problem_decomposition ?? '',
                assessment?.pattern_recognition ?? '',
                assessment?.algorithmic_thinking ?? '',
                assessment?.complexity_analysis ?? '',
                assessment?.communication_clarity ?? '',
                assessment?.edge_case_awareness ?? '',
                assessment?.optimization_mindset ?? '',
                assessment?.debugging_approach ?? '',
                started,
                updated,
                totalMins,
                dQ[0].status, dQ[0].time,
                dQ[1].status, dQ[1].time,
                dQ[2].status, dQ[2].time
            ];

            csvContent += row.join(',') + '\n';
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const safeTitle = (campaign.title || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const filename = `${safeTitle}-export-${dateStr}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error: unknown) {
        console.error('[SUBMISSIONS_EXPORT_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
