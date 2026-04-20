import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ResponseCache } from '../response-cache';
import { redisGet, redisSet } from '@/lib/upstash/client';

vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
}));

describe('response cache identity keying', () => {
    let cache: ResponseCache;
    let redisStore: Record<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();
        redisStore = {};

        (redisSet as Mock).mockImplementation(async (key: string, value: string) => {
            redisStore[key] = value;
        });
        (redisGet as Mock).mockImplementation(async (key: string) => redisStore[key] ?? null);

        cache = new ResponseCache({ ttlMs: 60_000 });
    });

    it('keeps separate entries when identity dimensions differ', async () => {
        await cache.set('What is BFS?', 'english response', {
            model: 'groq',
            identity: {
                modelId: 'groq',
                promptVersion: 'interview-chat.v1',
                ragContextHash: 'abc123',
                languageCode: 'english',
            },
        });

        await cache.set('What is BFS?', 'english response v2', {
            model: 'groq',
            identity: {
                modelId: 'groq',
                promptVersion: 'interview-chat.v2',
                ragContextHash: 'abc123',
                languageCode: 'english',
            },
        });

        const english = await cache.get('What is BFS?', {
            modelId: 'groq',
            promptVersion: 'interview-chat.v1',
            ragContextHash: 'abc123',
            languageCode: 'english',
        });

        const englishV2 = await cache.get('What is BFS?', {
            modelId: 'groq',
            promptVersion: 'interview-chat.v2',
            ragContextHash: 'abc123',
            languageCode: 'english',
        });

        expect(english?.response).toBe('english response');
        expect(englishV2?.response).toBe('english response v2');
    });

    it('falls back to legacy key when scoped identity misses', async () => {
        await cache.set('Legacy query', 'legacy response', 'groq', 10);

        const entry = await cache.get('Legacy query', {
            modelId: 'groq',
            promptVersion: 'interview-chat.v1',
            ragContextHash: 'missing',
            languageCode: 'english',
        });

        expect(entry?.response).toBe('legacy response');
    });
});
