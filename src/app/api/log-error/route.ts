import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { error_message, error_stack, component_stack, url, user_agent, severity } = body;

        if (!error_message) {
            return NextResponse.json({ error: 'error_message required' }, { status: 400 });
        }

        const supabase = getServiceClient();

        // Fire-and-forget — don't block response
        supabase
            .from('system_events')
            .insert({
                type: 'client_error',
                metadata: {
                    error_message: String(error_message).slice(0, 2000),
                    error_stack: String(error_stack || '').slice(0, 5000),
                    component_stack: String(component_stack || '').slice(0, 2000),
                    url: String(url || '').slice(0, 500),
                    user_agent: String(user_agent || '').slice(0, 500),
                    severity: severity || 'error',
                    timestamp: new Date().toISOString(),
                },
            })
            .then(({ error }) => {
                if (error) console.error('[log-error] Insert failed:', error.message);
            });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
