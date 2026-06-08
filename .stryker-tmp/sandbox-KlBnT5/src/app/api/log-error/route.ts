// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getCorrelationId } from '@/lib/tracing/correlation';
import { createServerSupabase } from '@/lib/supabase/server';

// ── Constants ──────────────────────────────────────────────────────────────
const ANON_MAX_REQUESTS = 10;     // per window
const AUTHED_MAX_REQUESTS = 30;   // higher quota for authenticated users
const WINDOW_SECONDS = 60;
const UNKNOWN_IP_MAX = 5;         // conservative limit for requests with no IP

// Hard length caps to prevent oversized log entries
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_URL_LENGTH = 300;
const MAX_COMPONENT_LENGTH = 200;
const MAX_USER_AGENT_LENGTH = 500;

export async function POST(req: NextRequest) {
    const correlationId = await getCorrelationId();

    // ── 1. Extract and normalise IP ─────────────────────────────────────
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const rawIp = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? null;
    const clientIp = rawIp ?? 'unknown';

    // ── 2. Rate limit — use a shared key for unknown IPs ───────────────
    const rateLimitKey = clientIp === 'unknown' ? 'log-error:unknown-ip' : clientIp;
    const maxRequests = clientIp === 'unknown' ? UNKNOWN_IP_MAX : ANON_MAX_REQUESTS;

    const result = await checkIpRateLimit(
        rateLimitKey,
        { maxRequests, windowSeconds: WINDOW_SECONDS, endpoint: 'log_error' }
    );
    const allowed = result.allowed ?? result.success;
    const remaining = result.remaining;

    if (!allowed) {
        return NextResponse.json(
            { error: 'Too many error reports. Please slow down.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(WINDOW_SECONDS),
                    'X-RateLimit-Remaining': '0',
                },
            }
        );
    }

    // ── 3. Optionally identify the user (higher quota, better logs) ─────
    // We do NOT reject unauthenticated requests — client errors happen when
    // the session may be invalid. But we record userId if available.
    let userId: string | null = null;
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;

        // Bump rate limit for authenticated users
        if (userId && remaining !== undefined && remaining < (AUTHED_MAX_REQUESTS - maxRequests)) {
            // Note: in a future iteration, use a separate Redis key per userId
            // for the higher authed quota. For now, shared IP limit is conservative.
        }
    } catch {
        // Silently ignore auth errors — this is a logging endpoint
    }

    // ── 4. Parse and sanitise the body ─────────────────────────────────
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const sanitise = (val: unknown, maxLen: number): string | null => {
        if (val === null || val === undefined) return null;
        return String(val).slice(0, maxLen);
    };

    const errorMessage = sanitise(body.error_message ?? body.message, MAX_MESSAGE_LENGTH);
    const errorStack   = sanitise(body.error_stack ?? body.stack, MAX_STACK_LENGTH);
    const url          = sanitise(body.url, MAX_URL_LENGTH);
    const componentStack = sanitise(body.component_stack ?? body.component, MAX_COMPONENT_LENGTH);
    const userAgent    = sanitise(body.user_agent ?? req.headers.get('user-agent'), MAX_USER_AGENT_LENGTH);
    const severity     = sanitise(body.severity, 50) || 'error';

    if (!errorMessage) {
        return NextResponse.json({ error: 'error_message is required' }, { status: 400 });
    }

    // ── 5. Write to system_events ───────────────────────────────────────
    const serviceClient = getServiceClient();
    const { error: insertError } = await serviceClient
        .from('system_events')
        .insert({
            type: 'client_error',
            correlation_id: correlationId,
            user_id: userId,
            severity: severity,
            created_at: new Date().toISOString(),
            metadata: {
                error_message: errorMessage,
                error_stack: errorStack,
                component_stack: componentStack,
                url,
                user_agent: userAgent,
                severity: severity,
                timestamp: new Date().toISOString(),
                client_ip: clientIp === 'unknown' ? null : clientIp,
            },
        });

    if (insertError) {
        console.error('[log-error] Failed to write system event:', insertError.message);
        return NextResponse.json({ ok: false, error: 'Failed to log error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
