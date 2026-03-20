import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/knowledge/session-limit/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeeklySessionCount } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getSystemConfig, isSessionGatingEnabled } from '@/lib/config/system-config';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/rate-limit/weekly-session-limiter', () => ({
  getWeeklySessionCount: vi.fn(),
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  getSystemConfig: vi.fn(),
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
    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(getSystemConfig).mockResolvedValue('5');
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
    expect(data.interview.remaining).toBe(3);
    expect(data.learn.remaining).toBe(4);
    expect(data.gatingEnabled).toBe(true);
  });

  it('returns null sessionsRemaining for premium users', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'premium', expiresAt: null });

    const res = await GET();
    const data = await res.json();

    expect(data.sessionsRemaining).toBeNull();
    expect(data.subscriptionStatus).toBe('premium');
    expect(data.interview.limit).toBeNull();
  });

  it('returns 500 when session-limit lookup throws', async () => {
    vi.mocked(getWeeklySessionCount).mockRejectedValueOnce(new Error('db failure'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
