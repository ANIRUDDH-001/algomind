import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createServerSupabase();

        // Lightweight DB ping instead of calling LLMs
        const { error } = await supabase
            .from('global_feature_flags')
            .select('key')
            .limit(1);

        if (error) throw error;

        return NextResponse.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
            metrics: {
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                uptime: Math.round(process.uptime()) + 's'
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        return NextResponse.json(
            { status: 'unhealthy', error: 'Database connection failed' },
            { status: 503 }
        );
    }
}
