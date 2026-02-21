import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(req: NextRequest) {
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
                created_at,
                show_score_to_candidate
            `)
            .eq('created_by', auth.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({ campaigns: data });
    } catch (error: any) {
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
        const { title, problemId, timeLimitMins = 45, expiresAt, maxUses, showScoreToCandidate = false } = body;

        // Validation
        if (!title || typeof title !== 'string' || title.length < 5 || title.length > 100) {
            return NextResponse.json({ error: 'Title must be between 5 and 100 characters' }, { status: 400 });
        }

        if (!problemId || typeof problemId !== 'string') {
            return NextResponse.json({ error: 'problemId is required' }, { status: 400 });
        }

        const timeLimit = Number(timeLimitMins);
        if (isNaN(timeLimit) || timeLimit < 15 || timeLimit > 120) {
            return NextResponse.json({ error: 'timeLimitMins must be between 15 and 120' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // Verify problem exists
        const { data: problem, error: problemError } = await supabase
            .from('problems')
            .select('id')
            .eq('id', problemId)
            .single();

        if (problemError || !problem) {
            return NextResponse.json({ error: 'Invalid problemId' }, { status: 404 });
        }

        // Create campaign
        const insertData: any = {
            created_by: auth.user.id,
            title,
            problem_id: problemId,
            time_limit_mins: timeLimit,
            is_active: true,
            show_score_to_candidate: showScoreToCandidate
        };

        if (expiresAt) insertData.expires_at = expiresAt;
        if (maxUses) insertData.max_uses = maxUses;

        const { data: campaign, error: insertError } = await supabase
            .from('assessment_campaigns')
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        return NextResponse.json({ campaign });
    } catch (error: any) {
        console.error('[CAMPAIGNS_POST_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
