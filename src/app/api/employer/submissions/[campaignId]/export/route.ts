import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';

function sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw = String(value).replace(/[\r\n\t]+/g, ' ').trim();
    const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return formulaSafe.includes(',') || formulaSafe.includes('"')
        ? `"${formulaSafe.replace(/"/g, '""')}"`
        : formulaSafe;
}

function maskEmail(email: string | null): string {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'redacted';
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const { campaignId } = await params;
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'unknown';

        if (clientIp !== 'unknown') {
            const exportLimit = await checkIpRateLimit(clientIp, {
                maxRequests: 20,
                windowSeconds: 300,
                endpoint: 'employer_export',
            });

            if (!exportLimit.success) {
                return NextResponse.json({ error: 'Too many export attempts. Please retry shortly.' }, { status: 429 });
            }
        }

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
        let sessionsMap = new Map();
        if (sessionIds.length > 0) {
            const { data: assessmentsData, error: assessmentsError } = await supabase
                .from('assessments')
                .select('*')
                .in('session_id', sessionIds);

            if (assessmentsError) throw assessmentsError;
            assessments = assessmentsData || [];

            const { data: sessionsData } = await supabase
                .from('interview_sessions')
                .select('id, duration')
                .in('id', sessionIds);
            if (sessionsData) {
                sessionsMap = new Map(sessionsData.map(s => [s.id, s.duration]));
            }
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

            const originalSessionDuration = sub.session_id ? sessionsMap.get(sub.session_id) : 0;
            const hasQuestionStates = sub.question_states && Array.isArray(sub.question_states) && sub.question_states.length > 0;

            // Total time spent across questions
            let totalMins = '0.0';
            if (hasQuestionStates) {
                const totalSecs = sub.question_states.reduce((acc: number, q: any) => acc + (q.elapsed_secs || 0), 0);
                totalMins = (totalSecs / 60).toFixed(1);
            } else if (originalSessionDuration) {
                totalMins = (originalSessionDuration / 60).toFixed(1);
            }

            // Per-question timing (up to 3 questions initially)
            const dQ = Array(3).fill({ status: 'not_started', time: '0.0' });
            if (hasQuestionStates) {
                sub.question_states.forEach((qs: any, i: number) => {
                    if (i < 3) {
                        dQ[i] = { status: qs.status || 'not_started', time: ((qs.elapsed_secs || 0) / 60).toFixed(1) };
                    }
                });
            } else if (originalSessionDuration) {
                dQ[0] = { status: sub.status, time: (originalSessionDuration / 60).toFixed(1) };
            }

            const row = [
                rank,
                sanitizeCsvCell(sub.candidate_name),
                sanitizeCsvCell(maskEmail(sub.candidate_email)),
                sub.status,
                sub.overall_score && sub.status === 'completed' ? sub.overall_score.toFixed(1) : '0.0',
                assessment?.problem_decomposition ?? '0',
                assessment?.pattern_recognition ?? '0',
                assessment?.algorithmic_thinking ?? '0',
                assessment?.complexity_analysis ?? '0',
                assessment?.communication_clarity ?? '0',
                assessment?.edge_case_awareness ?? '0',
                assessment?.optimization_mindset ?? '0',
                assessment?.debugging_approach ?? '0',
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
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'employer/submissions/export' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
