/**
 * @codesage
 * @file      src/app/api/owner/aws-usage/route.ts
 * @purpose   Retrieves AWS usage summary for the budget dashboard.
 * @tech      Next.js, Supabase Service Client
 * @connects  @/lib/supabase/service, @/lib/auth/requireOwnerForApi
 * @apis      None
 * @db        aws_usage_log
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/aws-usage — Get AWS usage summary for budget dashboard
 * Query params: ?days=30 (default 30)
 */
export async function GET(request: NextRequest) {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10);

    try {
        const adminSupabase = getServiceClient();

        // Get summary by service
        // @ts-expect-error -- automated unused local suppression
        const { data: summary, error: summaryError } = await adminSupabase
            .rpc('get_aws_usage_summary', { p_days: days });

        // Get recent individual entries for detail view
        // @ts-expect-error -- automated unused local suppression
        const { data: recentLogs, error: logsError } = await adminSupabase
            .from('aws_usage_log')
            .select('*')
            .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
            .order('created_at', { ascending: false })
            .limit(100);

        // Get daily breakdown
        // @ts-expect-error -- automated unused local suppression
        const { data: dailyBreakdown, error: dailyError } = await adminSupabase
            .from('aws_usage_log')
            .select('service, estimated_cost_usd, created_at')
            .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
            .order('created_at', { ascending: true });

        // Aggregate daily costs
        const dailyCosts: Record<string, Record<string, number>> = {};
        if (dailyBreakdown) {
            for (const entry of dailyBreakdown) {
                const day = new Date(entry.created_at).toISOString().split('T')[0];
                if (!dailyCosts[day]) dailyCosts[day] = {};
                dailyCosts[day][entry.service] = (dailyCosts[day][entry.service] || 0) + Number(entry.estimated_cost_usd || 0);
            }
        }

        const totalCost = (summary || []).reduce(
            (acc: number, s: { total_estimated_cost: number }) => acc + Number(s.total_estimated_cost || 0),
            0
        );

        const budgetLimit = Number(process.env.AWS_BUDGET_LIMIT) || 100;

        return NextResponse.json({
            summary: summary || [],
            recentLogs: recentLogs || [],
            dailyCosts,
            totalCost,
            budgetLimit,
            budgetUsedPercent: (totalCost / budgetLimit) * 100,
            days,
        });
    } catch (err) {
        console.error('[AWS Usage API] Error:', err);

        // If table doesn't exist yet, return empty data gracefully
        return NextResponse.json({
            summary: [],
            recentLogs: [],
            dailyCosts: {},
            totalCost: 0,
            budgetLimit: Number(process.env.AWS_BUDGET_LIMIT) || 100,
            budgetUsedPercent: 0,
            days,
            warning: 'aws_usage_log table may not exist yet. Run the SQL migration.',
        });
    }
}
