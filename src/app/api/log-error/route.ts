import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            error_message,
            error_stack,
            component_stack,
            url,
            correlation_id,
            user_agent,
            severity = 'error',
        } = body ?? {};

        if (!error_message) {
            return NextResponse.json({ error: 'error_message required' }, { status: 400 });
        }

        const supabase = getServiceClient();
        void Promise.resolve(
            supabase
                .from('system_events')
                .insert([
                    {
                        type: 'client_error',
                        error_message: String(error_message).slice(0, 2000),
                        metadata: {
                            error_stack: String(error_stack || '').slice(0, 5000),
                            component_stack: String(component_stack || '').slice(0, 2000),
                            url: String(url || '').slice(0, 1000),
                            correlation_id: String(correlation_id || '').slice(0, 200),
                            user_agent: String(user_agent || '').slice(0, 500),
                            severity: String(severity || 'error').slice(0, 20),
                            timestamp: new Date().toISOString(),
                        },
                    },
                ])
        )
            .then(({ error }) => {
                if (error) {
                    console.error('[log-error] Failed to persist client_error:', error.message);
                }
            })
            .catch((err: unknown) => {
                console.error('[log-error] Unexpected persistence error:', err);
            });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
