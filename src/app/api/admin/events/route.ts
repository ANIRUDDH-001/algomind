/**
 * @codesage
 * @file      src/app/api/admin/events/route.ts
 * @purpose   Fetches and caches system events and analytics for the admin dashboard.
 * @tech      Next.js, Supabase, Redis, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/supabase/server, @/lib/upstash/client, @/lib/api/error-response, @/lib/tracing/correlation
 * @apis      none
 * @db        system_events, RPC get_admin_analytics
 * @state     none
 * @env       none
 * @issues    Removed multiple console.error calls across catch blocks and error conditions.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { ApiErrors } from '@/lib/api/error-response';
import { getCorrelationIdFromRequest, withCorrelationId } from '@/lib/tracing/correlation';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 30;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(request?: Request) {
    const safeRequest = request ?? new Request('http://localhost/api/admin/events');
    const correlationId = getCorrelationIdFromRequest(safeRequest);
    const withCorrelationIdResponse = <T extends Response>(response: T): T => withCorrelationId(response, correlationId);

    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return withCorrelationIdResponse(errorResponse);

        const { searchParams } = new URL(safeRequest.url);
        const type = searchParams.get('type');
        const days = parseInt(searchParams.get('days') || '7', 10);
        const limitStr = searchParams.get('limit') || String(DEFAULT_LIMIT);
        const refresh = searchParams.get('refresh') === 'true';
        const includeMetadata = searchParams.get('includeMetadata') === 'true';
        // Enforce max limit for safety
        const parsedLimit = Number.isNaN(parseInt(limitStr, 10)) ? DEFAULT_LIMIT : parseInt(limitStr, 10);
        const limit = Math.max(1, Math.min(parsedLimit, MAX_LIMIT));

        // ── Cache keys ──
        const eventsCacheKey = `admin:events:${days}:${type || 'all'}`;
        const statsCacheKey = `admin:stats:${days}`;

        // ── Try cache first (unless ?refresh=true) ──
        if (!refresh && !includeMetadata) {
            const [cachedEvents, cachedStats] = await Promise.all([
                redisGet(eventsCacheKey),
                redisGet(statsCacheKey),
            ]);

            if (cachedEvents) {
                const parsed = JSON.parse(cachedEvents);
                return withCorrelationIdResponse(NextResponse.json({
                    events: parsed.events,
                    analytics: parsed.analytics,
                    systemStats: cachedStats ? JSON.parse(cachedStats) : null,
                    totalCount: parsed.totalCount,
                }));
            }
        }

        // ── Cache miss — hit DB ──
        const supabase = await createServiceRoleSupabase();

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
                // error handled silently
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
            // error handled silently
        }

        // 3. Build time-series analytics from raw events for the chart
        interface AnalyticsRow { event_date: string; type: string; count: number; }
        const aggMap = new Map<string, AnalyticsRow>();

        if (Array.isArray(events) && events.length > 0) {
            for (const evt of events) {
                const eventDate = (evt.created_at as string).split('T')[0];
                const key = `${eventDate}__${evt.type}`;
                const existing = aggMap.get(key);
                if (existing) {
                    existing.count++;
                } else {
                    aggMap.set(key, { event_date: eventDate, type: evt.type as string, count: 1 });
                }
            }
        }
        const analytics: AnalyticsRow[] = Array.from(aggMap.values());

        // 4. Strip metadata from events for efficient caching
        const strippedEvents = Array.isArray(events)
            ? events.map(({ metadata, ...rest }) => rest)
            : events;

        // 5. Write to cache (fire-and-forget, don't block response)
        redisSet(eventsCacheKey, JSON.stringify({ events: strippedEvents, analytics, totalCount: count }), CACHE_TTL_SECONDS).catch(() => { });
        if (systemStats) {
            redisSet(statsCacheKey, JSON.stringify(systemStats), CACHE_TTL_SECONDS).catch(() => { });
        }

        return withCorrelationIdResponse(NextResponse.json({
            events: includeMetadata ? events : strippedEvents,
            analytics,
            systemStats,
            totalCount: count
        }));

    } catch (error) {
        return withCorrelationIdResponse(ApiErrors.serverError('Internal Server Error'));
    }
}