import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        // 1. Fetch Models Data
        const [{ data: models }, { data: modelStats }] = await Promise.all([
            supabase.from('model_registry').select('model_id, is_active, deprecated_at'),
            supabase.rpc('get_model_rate_stats')
        ]);

        const statsMap = new Map<string, number>(((modelStats as unknown[]) || []).map((s: unknown) => [(s as { model_id: string }).model_id, Number((s as { hits_24h: number }).hits_24h)]));

        const modelsSummary = {
            total: 0,
            active: 0,
            deprecated: 0,
            degraded: 0,
            lastDeprecatedAt: null as string | null
        };

        if (models) {
            modelsSummary.total = models.length;
            for (const m of models) {
                if (m.is_active) {
                    modelsSummary.active++;
                    if ((statsMap.get(m.model_id) || 0) > 5) {
                        modelsSummary.degraded++;
                    }
                } else {
                    modelsSummary.deprecated++;
                    if (!modelsSummary.lastDeprecatedAt || new Date(m.deprecated_at) > new Date(modelsSummary.lastDeprecatedAt)) {
                        modelsSummary.lastDeprecatedAt = m.deprecated_at;
                    }
                }
            }
        }

        // 2. Fetch Events (last 24h)
        const d24 = new Date();
        d24.setHours(d24.getHours() - 24);

        const { data: recentEvents } = await supabase
            .from('system_events')
            .select('type')
            .gte('created_at', d24.toISOString());

        const eventsSummary = {
            errors24h: 0,
            modelErrors24h: 0,
            dbErrors24h: 0,
            userRateLimits24h: 0
        };

        if (recentEvents) {
            for (const e of recentEvents) {
                const t = e.type;
                if (t === 'user_rate_limit') {
                    eventsSummary.userRateLimits24h++;
                } else if (t === 'db_error') {
                    eventsSummary.dbErrors24h++;
                    eventsSummary.errors24h++;
                } else if (t === 'model_429' || t === 'model_deprecated' || t === 'model_error' || t === 'model_verification_failed') {
                    eventsSummary.modelErrors24h++;
                    eventsSummary.errors24h++;
                } else if (t === 'cron_failed' || t === 'piston_error' || t === 'leetcode_fetch_failed' || t === 'embedding_failed') {
                    eventsSummary.errors24h++;
                }
            }
        }

        // 3. Fetch latest Cron Health
        const { data: latestCron } = await supabase
            .from('system_events')
            .select('type, created_at, metadata')
            .in('type', ['cron_completed', 'cron_failed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const cronSummary = {
            lastRunAt: latestCron ? latestCron.created_at : null,
            lastRunStatus: latestCron ? (latestCron.type === 'cron_completed' ? 'success' as const : 'failed' as const) : 'never' as const,
            lastRunDurationMs: latestCron ? (latestCron.metadata?.durationMs || null) : null
        };

        // 4. Compute overall System Health
        const alerts: string[] = [];

        if (modelsSummary.deprecated > 0 && modelsSummary.lastDeprecatedAt) {
            const depAge = Date.now() - new Date(modelsSummary.lastDeprecatedAt).getTime();
            if (depAge < 24 * 60 * 60 * 1000) {
                alerts.push(`Found ${modelsSummary.deprecated} deprecated model(s). Recent deprecation within 24h.`);
            }
        }

        if (modelsSummary.degraded > 0) {
            alerts.push(`${modelsSummary.degraded} active model(s) are degraded (>5 rate limit hits in 24h).`);
        }

        if (eventsSummary.errors24h >= 10) {
            alerts.push(`High error volume detected: ${eventsSummary.errors24h} errors in the last 24h.`);
        }

        if (eventsSummary.dbErrors24h > 0) {
            alerts.push(`Encountered ${eventsSummary.dbErrors24h} database error(s) in the last 24h.`);
        }

        if (!cronSummary.lastRunAt || (Date.now() - new Date(cronSummary.lastRunAt).getTime() > 26 * 60 * 60 * 1000)) {
            alerts.push(`Cron jobs have not run successfully in over 26 hours.`);
        } else if (cronSummary.lastRunStatus === 'failed') {
            alerts.push(`The last scheduled cron job failed.`);
        }

        // condition: all models verified/healthy (no deps within 24, no degraded) AND cron ran success <26h AND <10 errors
        const isHealthy = alerts.length === 0;

        return NextResponse.json({
            models: modelsSummary,
            events: eventsSummary,
            cron: cronSummary,
            system: {
                isHealthy,
                alerts
            }
        });

    } catch (error) {
        console.error('[Admin Health API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
