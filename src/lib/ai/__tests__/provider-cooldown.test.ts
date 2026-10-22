/**
 * @codesage
 * @file      src/lib/ai/__tests__/provider-cooldown.test.ts
 * @purpose   Tests for quota-cooldown memory of (provider, key, model) pairs and chat-model filtering.
 * @tech      Vitest
 * @connects  ../provider-cooldown
 * @apis      none
 * @db        none
 * @state     Redis (mocked, auto-JSON-parsing like Upstash)
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(async (k: string) => store.get(k) ?? null),
    redisSet: vi.fn(async (k: string, v: string) => { store.set(k, JSON.parse(v)); }), // Upstash auto-parses JSON on get
}));

import { loadCooldowns, isCooling, markCooldown, parseRetryAfterSeconds, isChatModel, __resetCooldownMemory } from '../provider-cooldown';

describe('provider-cooldown', () => {
    beforeEach(() => { store.clear(); __resetCooldownMemory(); });

    it('remembers a cooled (key, model) pair across loads, even when Redis returns a parsed object', async () => {
        await markCooldown('groq', 1, 'openai/gpt-oss-120b', 600);
        __resetCooldownMemory(); // simulate a fresh serverless instance
        const map = await loadCooldowns('groq');
        expect(isCooling(map, 1, 'openai/gpt-oss-120b')).toBe(true);
        expect(isCooling(map, 0, 'openai/gpt-oss-120b')).toBe(false);
        expect(isCooling(map, 1, 'openai/gpt-oss-20b')).toBe(false);
    });

    it('expires cooldowns', async () => {
        await markCooldown('groq', 0, 'm', 1);
        const map = await loadCooldowns('groq');
        expect(isCooling(map, 0, 'm', Date.now() + 2_000)).toBe(false);
    });

    it('parses retry-after header and Groq "try again in" text', () => {
        expect(parseRetryAfterSeconds(new Headers({ 'retry-after': '42' }), '')).toBe(42);
        expect(parseRetryAfterSeconds(new Headers(), 'Please try again in 7m12.5s.')).toBeCloseTo(432.5);
        expect(parseRetryAfterSeconds(new Headers(), 'try again in 1h2m3s')).toBe(3723);
        expect(parseRetryAfterSeconds(new Headers(), 'no hint')).toBe(60);
    });

    it('never treats guard/safeguard/whisper/tts models as chat models', () => {
        expect(isChatModel('openai/gpt-oss-120b')).toBe(true);
        expect(isChatModel('openai/gpt-oss-safeguard-20b')).toBe(false);
        expect(isChatModel('meta-llama/llama-prompt-guard-2-86m')).toBe(false);
        expect(isChatModel('whisper-large-v3-turbo')).toBe(false);
        expect(isChatModel('canopylabs/orpheus-v1-english')).toBe(false);
    });
});
