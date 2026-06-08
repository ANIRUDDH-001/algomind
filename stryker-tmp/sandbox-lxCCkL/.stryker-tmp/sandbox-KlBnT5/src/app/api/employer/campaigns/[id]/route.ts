/**
 * @codesage
 * @file      src/app/api/employer/campaigns/[id]/route.ts
 * @purpose   Retrieves, updates, and deletes individual assessment campaigns by ID.
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/auth/require-employer
 * @apis      None
 * @db        assessment_campaigns, campaign_problem_links, problems, candidate_submissions, assessments
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

//  -- automated unused local suppression
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

        // Prefer relational links over JSON blob
        const { data: problemLinks } = await supabase
            .from('campaign_problem_links')
            .select(`
                problem_id,
                time_limit_min,
                order_index,
                problems (
                    id,
                    title,
                    description,
                    difficulty,
                    tags
                )
            `)
            .eq('campaign_id', id)
            .order('order_index');

        // If links exist, use them; otherwise fall back to JSON
        const questions = problemLinks && problemLinks.length > 0
            ? problemLinks.map(link => ({
                problemId: link.problem_id,
                timeLimitMin: link.time_limit_min,
                orderIndex: link.order_index,
                // Include problem data if joined
                ...(link.problems ? {
                    title: (link.problems as any).title,
                    description: (link.problems as any).description,
                    difficulty: (link.problems as any).difficulty,
                    tags: (link.problems as any).tags,
                } : {})
            }))
            : campaign.campaign_questions; // legacy fallback

        // 2. Aggregate stats & submissions in one view (Using simpler joined approach)
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
            campaign: {
                ...campaign,
                questions
            },
            stats: {
                total_submissions: submissions.length,
                completed: count,
                average_score: avgScore
            },
            submissions
        });
    } catch (error: unknown) {
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

        const updateData: Record<string, unknown> = {};
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
            .select(`
                *,
                entry_code,
                campaign_questions
            `)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to update campaign' }, { status: 400 });
        }

        return NextResponse.json({ campaign: data });
    } catch (error: unknown) {
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

        // Security: verify ownership
        const { data: campaign } = await supabase
            .from('assessment_campaigns')
            .select('id, title')
            .eq('id', id)
            .eq('created_by', auth.user.id)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
        }

        const body = await req.json().catch(() => ({}));
        const { action } = body;  // 'deactivate' or 'delete'

        if (action === 'delete') {
            // Hard delete — also deletes candidate_submissions via CASCADE if FK exists,
            // otherwise delete submissions first
            await supabase.from('candidate_submissions').delete().eq('campaign_id', id);
            const { error: deleteError } = await supabase
                .from('assessment_campaigns')
                .delete()
                .eq('id', id)
                .eq('created_by', auth.user.id);

            if (deleteError) {
                return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 400 });
            }
            return NextResponse.json({ success: true, action: 'deleted' });
        }

        // Default: deactivate (soft delete)
        const { error: deactivateError } = await supabase
            .from('assessment_campaigns')
            .update({ is_active: false })
            .eq('id', id)
            .eq('created_by', auth.user.id);

        if (deactivateError) {
            return NextResponse.json({ error: 'Failed to deactivate campaign' }, { status: 400 });
        }

        return NextResponse.json({ success: true, action: 'deactivated' });
    } catch (error: unknown) {
        console.error('[CAMPAIGN_DELETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
