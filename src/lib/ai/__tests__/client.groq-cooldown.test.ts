/**
 * @codesage
 * @file      src/lib/ai/__tests__/client.groq-cooldown.test.ts
 * @purpose   Streaming Groq failover skips non-chat models and (key, model) pairs that already hit quota.
 * @tech      Vitest
 * @connects  ../client (generateStream → streamGroq)
 * @apis      Groq chat completions (mocked fetch)
 * @db        none
 * @state     Redis cooldown map (mocked)
 * @env       GROQ_API_KEYS (stubbed)
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(async (k: string) => store.get(k) ?? null),
    redisSet: vi.fn(async (k: string, v: string) => { store.set(k, JSON.parse(v)); }),
    redisDel: vi.fn(), redisIncr: vi.fn(),
}));
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../model-registry', () => ({
    getActiveModels: vi.fn().mockResolvedValue([
        { id: 'openai/gpt-oss-safeguard-20b', provider: 'groq', tier: 0 },
        { id: 'openai/gpt-oss-120b', provider: 'groq', tier: 1 },
        { id: 'openai/gpt-oss-20b', provider: 'groq', tier: 2 },
    ]),
}));

import { UnifiedAIClient } from '../client';
import { __resetCooldownMemory } from '../provider-cooldown';

describe('streamGroq quota cooldown', () => {
    let calls: string[];
    beforeEach(() => {
        store.clear(); __resetCooldownMemory();
        vi.stubEnv('GROQ_API_KEYS', 'key-A0,key-B1');
        calls = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
            const body = JSON.parse(String((init as RequestInit).body));
            const auth = String(((init as RequestInit).headers as Record<string, string>).Authorization);
            calls.push(`${auth.slice(-2)}|${body.model}`);
            if (body.model === 'openai/gpt-oss-120b') {
                return new Response('{"error":{"message":"Rate limit reached for tokens per day (TPD). Please try again in 7m12.5s."}}', { status: 429 });
            }
            return new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

    const drain = async (client: UnifiedAIClient) => {
        let s = '';
        for await (const t of client.generateStream([{ role: 'user', content: 'q' }], { preferredModel: 'groq' })) s += t;
        return s;
    };

    it('never calls the safeguard classifier as a chat model', async () => {
        await drain(new UnifiedAIClient());
        expect(calls.some(c => c.includes('safeguard'))).toBe(false);
    });

    it('does not re-pay a 429 TPD on the next turn', async () => {
        const client = new UnifiedAIClient();
        expect(await drain(client)).toBe('hi');
        const first120 = calls.filter(c => c.endsWith('gpt-oss-120b')).length;
        expect(first120).toBe(2); // both keys discovered exhausted on turn 1
        calls = [];
        expect(await drain(client)).toBe('hi');
        expect(calls.filter(c => c.endsWith('gpt-oss-120b'))).toHaveLength(0);
        expect(calls[0]).toContain('gpt-oss-20b');
    });
});
