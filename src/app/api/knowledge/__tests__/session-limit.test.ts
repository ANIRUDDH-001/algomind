/**
 * @codesage
 * @file      src/app/api/knowledge/__tests__/session-limit.test.ts
 * @purpose   Tests checking user's weekly session limits for interviews and learning.
 * @tech      Vitest
 * @connects  @/app/api/knowledge/session-limit/route, @/lib/supabase/server, @/lib/rate-limit/weekly-session-limiter, @/lib/supabase/user-preferences, @/lib/config/system-config
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/knowledge/session-limit/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkWeeklySessionLimit, getWeeklySessionCount } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { isSessionGatingEnabled } from '@/lib/config/system-config';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/rate-limit/weekly-session-limiter', () => ({
  checkWeeklySessionLimit: vi.fn(),
  getWeeklySessionCount: vi.fn(),
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  isSessionGatingEnabled: vi.fn(),
}));

describe('GET /api/knowledge/session-limit', () => {
  const mockAuthGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    vi.mocked(getWeeklySessionCount).mockResolvedValue({ interview: 2, learn: 1, total: 3 });
    vi.mocked(checkWeeklySessionLimit).mockImplementation(async (_userId, type) => ({
      allowed: true,
      sessionsUsed: type === 'interview' ? 2 : 1,
      limit: 5,
      sessionsRemaining: type === 'interview' ? 3 : 4,
      reason: 'within_limit',
    }));
    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(isSessionGatingEnabled).mockResolvedValue(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns session limit details for free tier users', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subscriptionStatus).toBe('free');
    expect(data.allowed).toBe(true);
    expect(data.interview.remaining).toBe(3);
    expect(data.learn.remaining).toBe(4);
    expect(data.gatingEnabled).toBe(true);
    expect(data.sessionsUsed).toBe(2);
  });

  it('returns null sessionsRemaining for premium users', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'premium', expiresAt: null });
    vi.mocked(checkWeeklySessionLimit).mockResolvedValueOnce({
      allowed: true,
      sessionsUsed: 0,
      limit: null,
      sessionsRemaining: null,
      reason: 'premium',
    });
    vi.mocked(checkWeeklySessionLimit).mockResolvedValueOnce({
      allowed: true,
      sessionsUsed: 0,
      limit: null,
      sessionsRemaining: null,
      reason: 'premium',
    });

    const res = await GET();
    const data = await res.json();

    expect(data.sessionsRemaining).toBeNull();
    expect(data.subscriptionStatus).toBe('premium');
    expect(data.interview.limit).toBeNull();
  });

  it('returns allowed=false when interview weekly gate is exceeded', async () => {
    vi.mocked(checkWeeklySessionLimit).mockResolvedValueOnce({
      allowed: false,
      sessionsUsed: 5,
      limit: 5,
      sessionsRemaining: 0,
      reason: 'limit_exceeded',
    });
    vi.mocked(checkWeeklySessionLimit).mockResolvedValueOnce({
      allowed: true,
      sessionsUsed: 2,
      limit: 5,
      sessionsRemaining: 3,
      reason: 'within_limit',
    });
    vi.mocked(getWeeklySessionCount).mockResolvedValueOnce({ interview: 5, learn: 2, total: 7 });

    const res = await GET();
    const data = await res.json();

    expect(data.allowed).toBe(false);
    expect(data.sessionsUsed).toBe(5);
    expect(data.limit).toBe(5);
    expect(data.sessionsRemaining).toBe(0);
  });

  it('returns 500 when session-limit lookup throws', async () => {
    vi.mocked(getWeeklySessionCount).mockRejectedValueOnce(new Error('db failure'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
