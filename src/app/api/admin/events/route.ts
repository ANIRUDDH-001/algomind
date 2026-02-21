import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const days = parseInt(searchParams.get('days') || '7', 10);
        const limitStr = searchParams.get('limit') || '100';
        // Enforce max limit for safety
        const limit = Math.min(parseInt(limitStr, 10), 1000);

        // 1. Fetch raw events
        let query = supabase
            .from('system_events')
            .select('*', { count: 'exact' });

        if (type) {
            query = query.eq('type', type);
        }

        // Apply days filter
        const d = new Date();
        d.setDate(d.getDate() - days);
        query = query.gte('created_at', d.toISOString());

        // Apply order and limit
        query = query.order('created_at', { ascending: false }).limit(limit);

        const { data: events, error: eventsError, count } = await query;

        if (eventsError) {
            console.error('[Admin Events API] Error fetching events:', eventsError);
            throw eventsError;
        }

        // 2. Fetch Aggregated Analytics via RPC
        const { data: analytics, error: analyticsError } = await supabase.rpc('get_admin_analytics', {
            p_days: days
        });

        if (analyticsError) {
            console.error('[Admin Events API] Error fetching analytics:', analyticsError);
            // We can proceed without analytics if it fails, just return empty array
        }

        return NextResponse.json({
            events,
            analytics: analytics || [],
            totalCount: count
        });

    } catch (error) {
        console.error('[Admin Events API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
