/**
 * @codesage
 * @file      src/app/api/voice/telemetry/route.ts
 * @purpose   Accept batched voice turn timelines from the browser and persist them as system_events.
 * @tech      Next.js, zod
 * @connects  @/lib/monitoring/events, @/lib/rate-limit/ip-rate-limiter, @/lib/supabase/server
 * @apis      POST /api/voice/telemetry
 * @db        system_events (insert via logSystemEvent)
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logSystemEvent, type SystemEventType } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_EVENTS = 20;

const Event = z.object({
    sessionId: z.string().max(80).nullable(),
    turn: z.number().int().min(0).max(500),
    outcome: z.enum(['spoken', 'text-only', 'aborted', 'error']),
    stages: z.record(z.string(), z.number()),
    derived: z.record(z.string(), z.number().nullable()),
    details: z.record(z.string(), z.unknown()),
    ua: z.string().max(200),
});
const Body = z.object({ events: z.array(Event).min(1) });
type VoiceEvent = z.infer<typeof Event>;

function eventType(e: VoiceEvent): SystemEventType {
    if (e.details.micStatus !== undefined) return 'voice.mic_status';
    if (e.outcome === 'error') return 'voice.engine_error';
    return 'voice.turn_timeline';
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkIpRateLimit(ip, { maxRequests: 30, windowSeconds: 60, endpoint: 'voice-telemetry', failureMode: 'fail-open' });
    if (!rate.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    let json: unknown;
    try { json = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    if (parsed.data.events.length > MAX_EVENTS) return NextResponse.json({ error: 'Too many events' }, { status: 413 });

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    // system_events has no session column — the session id rides in metadata so turns can be grouped.
    await Promise.all(parsed.data.events.map(e => logSystemEvent({
        type: eventType(e),
        userId: user?.id,
        sessionId: e.sessionId ?? undefined,
        latency_ms: e.derived.turnGapMs ?? undefined,
        metadata: { sessionId: e.sessionId, turn: e.turn, outcome: e.outcome, stages: e.stages, derived: e.derived, details: e.details, ua: e.ua },
    })));
    return NextResponse.json({ accepted: parsed.data.events.length }, { status: 202 });
}
