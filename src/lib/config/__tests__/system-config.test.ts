import { describe, it, expect, vi, beforeEach } from 'vitest';

// Redis mock: Upstash auto-JSON-parses on read, so a stored "true" comes back as boolean true
// and "5" as number 5. These tests pin the contract that getSystemConfig ALWAYS returns a string.
const redisStore = new Map<string, unknown>();
const mockRedis = {
  get: vi.fn(async (key: string) => (redisStore.has(key) ? redisStore.get(key) : null)),
  set: vi.fn(async (key: string, value: unknown) => { redisStore.set(key, value); return 'OK'; }),
};

vi.mock('@/lib/upstash/client', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

const dbRows: Record<string, string> = {};
vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          single: async () => (key in dbRows ? { data: { value: dbRows[key] }, error: null } : { data: null, error: { message: 'not found' } }),
        }),
        in: async () => ({ data: Object.entries(dbRows).map(([key, value]) => ({ key, value })) }),
      }),
    }),
  })),
}));

import { getSystemConfig, isSessionGatingEnabled } from '../system-config';
import { SYSTEM_CONFIG_KEYS } from '../system-config-keys';

describe('getSystemConfig — string contract survives the Upstash cache', () => {
  beforeEach(() => {
    redisStore.clear();
    for (const k of Object.keys(dbRows)) delete dbRows[k];
    vi.clearAllMocks();
  });

  it('returns the DB value as a string on a cache miss and caches it', async () => {
    dbRows[SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING] = 'true';
    const v = await getSystemConfig(SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING);
    expect(v).toBe('true');
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it('normalises a cached BOOLEAN back to the string "true" (Upstash auto-parse)', async () => {
    // Simulate what Upstash returns for a previously-stored "true"
    redisStore.set(`system_config:${SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING}`, true);
    const v = await getSystemConfig(SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING);
    expect(typeof v).toBe('string');
    expect(v).toBe('true');
  });

  it('normalises a cached NUMBER back to a string', async () => {
    redisStore.set(`system_config:${SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT}`, 5);
    const v = await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT);
    expect(v).toBe('5');
  });

  it('isSessionGatingEnabled stays TRUE on a warm cache (regression: gate was silently disabled)', async () => {
    // Before the fix: cached boolean true !== 'true' → gating reported as disabled → free users
    // got unlimited interviews whenever the 5-minute config cache was warm.
    redisStore.set(`system_config:${SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING}`, true);
    expect(await isSessionGatingEnabled()).toBe(true);
  });

  it('isSessionGatingEnabled is FALSE when the flag is off', async () => {
    redisStore.set(`system_config:${SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING}`, false);
    expect(await isSessionGatingEnabled()).toBe(false);
  });
});
