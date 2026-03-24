import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';

export const dynamic = 'force-dynamic';

interface HealthResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    db: 'ok' | 'down';
    redis: 'ok' | 'unconfigured' | 'down';
    stuck_analyses: number;
    memory_mb: number;
    uptime_s: number;
    timestamp: string;
}

export async function GET() {
    try {
    const [dbResult, redisResult, stuckResult] = await Promise.allSettled([
        getServiceClient()
            .from('global_feature_flags')
            .select('key')
            .limit(1),

        (async () => {
            const redis = getRedis();
            if (!redis) return 'unconfigured';
            await redis.ping();
            return 'ok';
        })(),

        getServiceClient()
            .from('candidate_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('analysis_status', 'pending')
            .lt('completed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);

    const db: HealthResult['db'] =
        dbResult.status === 'fulfilled' && !dbResult.value.error ? 'ok' : 'down';

    let redis: HealthResult['redis'];
    if (redisResult.status === 'fulfilled') {
        redis = redisResult.value as HealthResult['redis'];
    } else {
        redis = 'down';
    }

    const stuck_analyses: number =
        stuckResult.status === 'fulfilled'
            ? (stuckResult.value.count ?? 0)
            : -1;

    const status: HealthResult['status'] =
        db === 'down' ? 'unhealthy'
            : redis === 'down' ? 'degraded'
                : 'healthy';

    const result: HealthResult = {
        status,
        db,
        redis,
        stuck_analyses,
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime_s: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, {
        status: status === 'unhealthy' ? 503 : 200,
    });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[health] Error:', errMsg);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'health' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
