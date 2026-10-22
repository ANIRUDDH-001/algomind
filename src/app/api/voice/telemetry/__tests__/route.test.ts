/**
 * @codesage
 * @file      src/app/api/voice/telemetry/__tests__/route.test.ts
 * @purpose   Voice telemetry route: validates batches, persists each timeline as a system_event, rate limits.
 * @tech      Vitest
 * @connects  ../route
 * @apis      POST /api/voice/telemetry
 * @db        system_events (logSystemEvent mocked)
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
    checkIpRateLimit: vi.fn(),
}));
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: m.logSystemEvent }));
vi.mock('@/lib/rate-limit/ip-rate-limiter', () => ({ checkIpRateLimit: m.checkIpRateLimit }));
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));

import { POST } from '../route';

const event = (over: Record<string, unknown> = {}) => ({
    sessionId: 'sess-1', turn: 2, outcome: 'spoken',
    stages: { vad_end: 0, first_audio: 1800 },
    derived: { turnGapMs: 1800, sttMs: 420, commitWaitMs: 900, ttftMs: 300, ttfaMs: 150 },
    details: { sttModel: 'whisper-large-v3-turbo' },
    ua: 'Mozilla/5.0',
    ...over,
});
const post = (body: unknown) => new NextRequest('http://localhost/api/voice/telemetry', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
});

describe('POST /api/voice/telemetry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.checkIpRateLimit.mockResolvedValue({ success: true, allowed: true });
    });

    it('accepts a valid batch and logs one voice.turn_timeline per event, session id kept in metadata', async () => {
        const res = await POST(post({ events: [event(), event({ turn: 3 })] }));
        expect(res.status).toBe(202);
        expect(await res.json()).toEqual({ accepted: 2 });
        expect(m.logSystemEvent).toHaveBeenCalledTimes(2);
        expect(m.logSystemEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice.turn_timeline',
            userId: 'u1',
            latency_ms: 1800,
            metadata: expect.objectContaining({ sessionId: 'sess-1', turn: 2, outcome: 'spoken', derived: expect.objectContaining({ turnGapMs: 1800 }) }),
        }));
    });

    it('logs mic status reports as voice.mic_status and failed turns as voice.engine_error', async () => {
        await POST(post({ events: [event({ outcome: 'error', details: { micStatus: 'failed' } }), event({ outcome: 'error', details: { ttsError: 'synthesis-failed' } })] }));
        const types = m.logSystemEvent.mock.calls.map(c => (c[0] as { type: string }).type);
        expect(types).toEqual(['voice.mic_status', 'voice.engine_error']);
    });

    it('rejects bad shapes with 400', async () => {
        expect((await POST(post({ events: [event({ outcome: 'exploded' })] }))).status).toBe(400);
        expect((await POST(post({ events: [] }))).status).toBe(400);
        expect((await POST(post('not json'))).status).toBe(400);
        expect(m.logSystemEvent).not.toHaveBeenCalled();
    });

    it('rejects more than 20 events with 413', async () => {
        const res = await POST(post({ events: Array.from({ length: 21 }, (_, i) => event({ turn: i })) }));
        expect(res.status).toBe(413);
        expect(m.logSystemEvent).not.toHaveBeenCalled();
    });

    it('returns 429 when the IP rate limit is exceeded', async () => {
        m.checkIpRateLimit.mockResolvedValue({ success: false, allowed: false });
        const res = await POST(post({ events: [event()] }));
        expect(res.status).toBe(429);
        expect(m.logSystemEvent).not.toHaveBeenCalled();
    });
});
