/**
 * @codesage
 * @file      src/lib/ai/__tests__/client.reasoning.test.ts
 * @purpose   Non-streaming provider calls strip model reasoning and request hidden/low reasoning from Groq.
 * @tech      Vitest
 * @connects  ../client (callModel)
 * @apis      Groq chat completions (mocked fetch)
 * @db        none
 * @state     none
 * @env       GROQ_API_KEY (stubbed)
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../model-registry', () => ({ getActiveModels: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: vi.fn().mockResolvedValue(undefined) }));

import { UnifiedAIClient } from '../client';
import type { ModelConfig } from '../providers';

const model = (id: string): ModelConfig => ({
    id, provider: 'groq', tier: 1, rpm: 30, tpm: 8000, rpd: 1000, contextWindow: 128000,
    supportsEmbeddings: false, description: 'test',
} as ModelConfig);

describe('UnifiedAIClient.callModel reasoning handling', () => {
    let bodies: Record<string, unknown>[];
    beforeEach(() => {
        vi.stubEnv('GROQ_API_KEY', 'test-key');
        bodies = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
            bodies.push(JSON.parse(String((init as RequestInit).body)));
            return new Response(JSON.stringify({ choices: [{ message: { content: '<think>He wants JSON so I will</think>{"ok":true}' } }] }), { status: 200 });
        });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

    it('returns the reply without <think> content (memory-generator crash)', async () => {
        const client = new UnifiedAIClient();
        const res = await client.callModel(model('qwen/qwen3.8-27b'), [{ role: 'user', content: 'q' }], { maxTokens: 50 });
        expect(res.response).toBe('{"ok":true}');
    });

    it('asks Groq to hide/limit reasoning for qwen and gpt-oss', async () => {
        const client = new UnifiedAIClient();
        await client.callModel(model('qwen/qwen3.8-27b'), [{ role: 'user', content: 'q' }], {});
        await client.callModel(model('openai/gpt-oss-20b'), [{ role: 'user', content: 'q' }], {});
        expect(bodies[0]).toMatchObject({ reasoning_format: 'hidden', reasoning_effort: 'none' });
        expect(bodies[1]).toMatchObject({ reasoning_effort: 'low', include_reasoning: false });
    });
});
