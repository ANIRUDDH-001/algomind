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

        // 2. Fetch System Stats via RPC
        // NOTE: get_admin_analytics returns a SINGLE summary object:
        //   { total_users, active_models, total_sessions }
        // It does NOT return time-series data. The chart is built from raw events below.
        interface SystemStats {
            total_users: number;
            active_models: number;
            total_sessions: number;
        }
        let systemStats: SystemStats | null = null;

        try {
            const { data: rpcResult, error: analyticsError } = await supabase.rpc('get_admin_analytics', {
                p_days: days
            });

            if (analyticsError) {
                console.error('[Admin Events API] get_admin_analytics RPC error:', analyticsError);
            } else if (Array.isArray(rpcResult) && rpcResult.length > 0) {
                // RPC returns array of one row with nested object
                const row = rpcResult[0];
                const stats = row?.get_admin_analytics ?? row;
                if (stats && typeof stats === 'object') {
                    systemStats = stats as SystemStats;
                }
            } else if (rpcResult && typeof rpcResult === 'object' && !Array.isArray(rpcResult)) {
                systemStats = rpcResult as SystemStats;
            }
        } catch (err) {
            console.error('[Admin Events API] RPC call threw:', err);
        }

        // 3. Build time-series analytics from raw events for the chart
        interface AnalyticsRow { event_date: string; event_type: string; count: number; }
        const aggMap = new Map<string, AnalyticsRow>();

        if (Array.isArray(events) && events.length > 0) {
            for (const evt of events) {
                const eventDate = (evt.created_at as string).split('T')[0];
                const key = `${eventDate}__${evt.type}`;
                const existing = aggMap.get(key);
                if (existing) {
                    existing.count++;
                } else {
                    aggMap.set(key, { event_date: eventDate, event_type: evt.type as string, count: 1 });
                }
            }
        }
        const analytics: AnalyticsRow[] = Array.from(aggMap.values());

        return NextResponse.json({
            events,
            analytics,
            systemStats,
            totalCount: count
        });

    } catch (error) {
        console.error('[Admin Events API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}