import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkTokenBudget, recordTokenUsage } from '@/lib/ai/cost-guard';

// Mock Redis for deterministic testing.
vi.mock('@/lib/upstash/client', () => {
  const store = new Map<string, number>();
  return {
    getRedis: () => ({
      incrby: async (key: string, amount: number) => {
        const current = store.get(key) || 0;
        store.set(key, current + amount);
        return current + amount;
      },
      expire: async () => true,
    }),
    redisGet: async (key: string) => store.get(key)?.toString() || null,
    redisSet: async (key: string, value: string) => {
      store.set(key, parseInt(value, 10));
    },
    __resetStore: () => store.clear(),
  };
});

describe('Cost burn simulation', () => {
  beforeEach(async () => {
    const { __resetStore } = (await import('@/lib/upstash/client') as unknown as {
      __resetStore: () => void;
    });
    __resetStore();
  });

  it('blocks user after daily token budget exceeded', async () => {
    const userId = 'test-user';
    const sessionId = 'session-1';

    // Simulate 50 requests of ~1000 tokens each (50K total = limit).
    for (let i = 0; i < 50; i++) {
      await recordTokenUsage(userId, sessionId, 1000);
    }

    const result = await checkTokenBudget(userId, 'session-2', 500);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily_limit');
  });

  it('blocks session after session token cap exceeded', async () => {
    const userId = 'test-user';
    const sessionId = 'session-1';

    // Simulate heavy single session (15K tokens = session limit).
    await recordTokenUsage(userId, sessionId, 15000);

    const result = await checkTokenBudget(userId, sessionId, 500);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('session_limit');
  });

  it('allows requests within budget', async () => {
    const userId = 'test-user';
    const sessionId = 'session-1';

    await recordTokenUsage(userId, sessionId, 5000);

    const result = await checkTokenBudget(userId, sessionId, 500);
    expect(result.allowed).toBe(true);
    expect(result.remaining_daily).toBe(45000);
    expect(result.remaining_session).toBe(10000);
  });

  it('simulates 10 free-tier users without exceeding global budget', async () => {
    const sessions: Array<{ userId: string; sessionId: string }> = [];
    for (let u = 0; u < 10; u++) {
      sessions.push({ userId: `user-${u}`, sessionId: `session-${u}` });
    }

    // Each user makes 5 requests of 2000 tokens.
    let totalTokens = 0;
    for (const { userId, sessionId } of sessions) {
      for (let i = 0; i < 5; i++) {
        const budget = await checkTokenBudget(userId, sessionId, 2000);
        if (budget.allowed) {
          await recordTokenUsage(userId, sessionId, 2000);
          totalTokens += 2000;
        }
      }
    }

    // 10 users * 5 requests * 2000 tokens = 100K total (within per-user limits).
    expect(totalTokens).toBe(100000);
  });
});
