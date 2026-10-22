/**
 * @codesage
 * @file      src/lib/ai/__tests__/intent-classifier.reasoning.test.ts
 * @purpose   The LLM classification pass must not let gpt-oss reasoning eat its 150-token budget.
 * @tech      Vitest
 * @connects  ../intent-classifier
 * @apis      Groq chat completions (mocked fetch)
 * @db        none
 * @state     none
 * @env       GROQ_API_KEY (stubbed)
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { IntentClassifier } from '../intent-classifier';

describe('IntentClassifier LLM pass', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

    it('requests low, excluded reasoning and parses JSON even when reasoning text leaks', async () => {
        vi.stubEnv('GROQ_API_KEY', 'test-key');
        const bodies: Record<string, unknown>[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
            bodies.push(JSON.parse(String((init as RequestInit).body)));
            return new Response(JSON.stringify({ choices: [{ message: { content: '<think>simple</think>{"complexity":"simple","category":"greeting","confidence":0.9}' } }] }), { status: 200 });
        });
        const c = new IntentClassifier() as unknown as { llmClassify(q: string): Promise<{ complexity: string } | null> };
        const res = await c.llmClassify('zqxv wibble frobnicate the flux capacitor');
        expect(bodies[0]).toMatchObject({ reasoning_effort: 'low', include_reasoning: false });
        expect(res?.complexity).toBe('simple');
    });
});
