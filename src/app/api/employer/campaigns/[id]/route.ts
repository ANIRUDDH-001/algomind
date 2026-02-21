import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // 1. Get campaign metadata
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('*')
            .eq('id', id)
            .eq('created_by', auth.user.id)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // 2. Aggregate stats & submsissions in one view (Using simpler joined approach)
        const { data: submissions, error: subError } = await supabase
            .from('candidate_submissions')
            .select('*, assessments(overall_score)')
            .eq('campaign_id', id);

        if (subError) {
            throw subError;
        }

        // Calculate stats
        const activeSubmissions = submissions.filter(s => s.status === 'completed');
        const count = activeSubmissions.length;
        const totalScore = activeSubmissions.reduce((sum, s) => {
            // For safety since inner join returns array or single obj depending on relationship uniqueness
            const score = Array.isArray(s.assessments) ? s.assessments[0]?.overall_score : s.assessments?.overall_score;
            return sum + (Number(score) || 0);
        }, 0);

        const avgScore = count > 0 ? (totalScore / count) : 0;

        return NextResponse.json({
            campaign,
            stats: {
                total_submissions: submissions.length,
                completed: count,
                average_score: avgScore
            },
            submissions
        });
    } catch (error: any) {
        console.error('[CAMPAIGN_GET_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireEmployer();
        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json();
        const { isActive, expiresAt, maxUses } = body;

        const updateData: any = {};
        if (isActive !== undefined) updateData.is_active = isActive;
        if (expiresAt !== undefined) updateData.expires_at = expiresAt;
        if (maxUses !== undefined) updateData.max_uses = maxUses;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // Ensures user owns campaign while updating
        const { data, error } = await supabase
            .from('assessment_campaigns')
            .update(updateData)
            .eq('id', id)
            .eq('created_by', auth.user.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to update campaign' }, { status: 400 });
        }

        return NextResponse.json({ campaign: data });
    } catch (error: any) {
        console.error('[CAMPAIGN_PATCH_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireEmployer();
        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // Soft delete
        const { error } = await supabase
            .from('assessment_campaigns')
            .update({ is_active: false })
            .eq('id', id)
            .eq('created_by', auth.user.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to deactivate campaign' }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'Campaign deactivated' });
    } catch (error: any) {
        console.error('[CAMPAIGN_DELETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
