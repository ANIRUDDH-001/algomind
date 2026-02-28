import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(_req: NextRequest) {
    try {
        const auth = await requireEmployer();
        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();
        const { data, error } = await supabase
            .from('assessment_campaigns')
            .select(`
                id,
                title,
                problem_id,
                time_limit_mins,
                expires_at,
                max_uses,
                uses_count,
                is_active,
                public_token,
                entry_code,
                created_at,
                show_score_to_candidate,
                campaign_questions
            `)
            .eq('created_by', auth.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        const campaignIds = data?.map(c => c.id) || [];
        const countsMap: Record<string, number> = {};

        if (campaignIds.length > 0) {
            const { data: subData, error: subError } = await supabase
                .from('candidate_submissions')
                .select('campaign_id')
                .in('campaign_id', campaignIds)
                .eq('status', 'completed');

            if (!subError && subData) {
                subData.forEach(sub => {
                    countsMap[sub.campaign_id] = (countsMap[sub.campaign_id] || 0) + 1;
                });
            }
        }

        const campaignsWithCounts = data?.map(c => ({
            ...c,
            completed_count: countsMap[c.id] || 0
        })) || [];

        return NextResponse.json({ campaigns: campaignsWithCounts });
    } catch (error: unknown) {
        console.error('[CAMPAIGNS_GET_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireEmployer();
        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json();
        const {
            title,
            campaignQuestions,
            defaultEasyMins,
            defaultMediumMins,
            defaultHardMins,
            maxUses,
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            showScoreToCandidate = false
        } = body;

        // Validation
        if (!title || typeof title !== 'string' || title.length < 5 || title.length > 100) {
            return NextResponse.json({ error: 'Title must be between 5 and 100 characters' }, { status: 400 });
        }

        if (!campaignQuestions || !Array.isArray(campaignQuestions) || campaignQuestions.length < 1 || campaignQuestions.length > 3) {
            return NextResponse.json({ error: 'campaignQuestions (1-3 items) is required' }, { status: 400 });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const q of campaignQuestions) {
            const isRandom = typeof q.problem_id === 'string' && q.problem_id.startsWith('random-');
            if (!q.problem_id || (!uuidRegex.test(q.problem_id) && !isRandom)) {
                return NextResponse.json({ error: `Invalid problem_id: ${q.problem_id}` }, { status: 400 });
            }
            if (!q.time_limit_mins || q.time_limit_mins < 5 || q.time_limit_mins > 120) {
                return NextResponse.json({ error: 'time_limit_mins must be between 5 and 120' }, { status: 400 });
            }
        }

        const validateTime = (val: any) => val === undefined || (Number(val) >= 5 && Number(val) <= 120);
        if (!validateTime(defaultEasyMins) || !validateTime(defaultMediumMins) || !validateTime(defaultHardMins)) {
            return NextResponse.json({ error: 'Default time limits must be between 5 and 120' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // 3. Generate entry code via RPC
        const { data: entryCode, error: rpcError } = await supabase.rpc('generate_campaign_entry_code');
        if (rpcError) {
            console.error('[RPC_ERROR]', rpcError);
            throw new Error('Failed to generate entry code');
        }

        // 4. Insert shape
        const insertData = {
            created_by: auth.user.id,
            title,
            time_limit_mins: campaignQuestions.reduce((sum: number, q: any) => sum + q.time_limit_mins, 0),
            campaign_questions: campaignQuestions.map((q: any, idx: number) => ({
                problem_id: q.problem_id,
                time_limit_mins: q.time_limit_mins,
                order: idx + 1
            })),
            default_easy_mins: defaultEasyMins ?? 15,
            default_medium_mins: defaultMediumMins ?? 25,
            default_hard_mins: defaultHardMins ?? 45,
            is_active: true,
            show_score_to_candidate: showScoreToCandidate,
            assignment_mode: 'fixed',               // kept for compat
            problem_id: uuidRegex.test(campaignQuestions[0].problem_id) ? campaignQuestions[0].problem_id : null,  // legacy field = first question
            entry_code: entryCode.toUpperCase(),
            expires_at: expiresAt,
            max_uses: maxUses ?? null,
        };

        const { data: campaign, error: insertError } = await supabase
            .from('assessment_campaigns')
            .insert(insertData)
            .select(`
                *,
                entry_code,
                campaign_questions
            `)
            .single();

        if (insertError) {
            throw insertError;
        }

        return NextResponse.json({ campaign });
    } catch (error: unknown) {
        console.error('[CAMPAIGNS_POST_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

