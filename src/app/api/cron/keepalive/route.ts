import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Keepalive ping to prevent Supabase free tier auto-pause (7 days idle).
 * Optional endpoint for external uptime pings.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { error } = await getServiceClient()
            .from('global_feature_flags')
            .select('key')
            .limit(1);

        if (error) throw error;

        console.info('[Keepalive] DB ping successful at', new Date().toISOString());
        return NextResponse.json({
            alive: true,
            at: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[Keepalive] DB ping failed:', err);
        return NextResponse.json(
            { alive: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
