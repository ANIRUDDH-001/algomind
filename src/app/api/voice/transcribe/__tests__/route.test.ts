/**
 * @codesage
 * @file      src/app/api/voice/transcribe/__tests__/route.test.ts
 * @purpose   STT route: key-pool failover with quota memory and a Server-Timing breakdown.
 * @tech      Vitest
 * @connects  ../route
 * @apis      POST /api/voice/transcribe (Groq mocked)
 * @db        none
 * @state     Redis cooldown map (mocked)
 * @env       GROQ_API_KEYS (stubbed)
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));
vi.mock('@/lib/feature-flags-server', () => ({ getGlobalFeatureFlag: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/rate-limit/ip-rate-limiter', () => ({ checkIpRateLimit: vi.fn().mockResolvedValue({ success: true, allowed: true }) }));
const store = new Map<string, unknown>();
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(async (k: string) => store.get(k) ?? null),
    redisSet: vi.fn(async (k: string, v: string) => { store.set(k, JSON.parse(v)); }),
}));

import { POST } from '../route';
import { __resetCooldownMemory } from '@/lib/ai/provider-cooldown';

function audioRequest() {
    const form = new FormData();
    form.append('audio', new File([new Uint8Array(4000)], 'a.wav', { type: 'audio/wav' }));
    return new NextRequest('http://localhost/api/voice/transcribe', { method: 'POST', body: form });
}

describe('POST /api/voice/transcribe', () => {
    let authHeaders: string[];
    beforeEach(() => {
        store.clear(); __resetCooldownMemory();
        vi.stubEnv('GROQ_API_KEYS', 'key-A0,key-B1');
        vi.stubEnv('GROQ_API_KEY', '');
        authHeaders = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
            const auth = String(((init as RequestInit).headers as Record<string, string>).Authorization);
            authHeaders.push(auth.slice(-2));
            if (auth.endsWith('A0')) {
                return new Response(JSON.stringify({ error: { message: 'Rate limit reached for audio seconds per day. Please try again in 30s.' } }), { status: 429 });
            }
            return new Response(JSON.stringify({ text: ' hello there ', duration: 1.2, segments: [{ avg_logprob: -0.1 }] }), { status: 200 });
        });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

    it('fails over across the key pool and reports Server-Timing', async () => {
        const res = await POST(audioRequest());
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.text).toBe('hello there');
        expect(res.headers.get('server-timing')).toMatch(/pre;dur=\d+, groq;dur=\d+/);
        expect(json.timing).toEqual({ preMs: expect.any(Number), groqMs: expect.any(Number) });
    });

    it('does not retry a key that already returned 429 on later requests', async () => {
        for (let i = 0; i < 3; i++) {
            const res = await POST(audioRequest());
            expect((await res.json()).text).toBe('hello there');
        }
        // Round-robin reaches A0 at most once; after its 429 it is remembered and skipped.
        expect(authHeaders.filter(h => h === 'A0').length).toBeLessThanOrEqual(1);
        expect(authHeaders.filter(h => h === 'B1').length).toBe(3);
    });
});
