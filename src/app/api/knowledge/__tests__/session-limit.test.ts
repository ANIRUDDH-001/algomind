import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/knowledge/session-limit/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkWeeklySessionLimit } from '@/lib/rate-limit/weekly-session-limiter';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { logSystemEvent } from '@/lib/monitoring/events';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/rate-limit/weekly-session-limiter', () => ({
  checkWeeklySessionLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

describe('GET /api/knowledge/session-limit', () => {
  const mockAuthGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    vi.mocked(checkWeeklySessionLimit).mockResolvedValue({
      allowed: true,
      sessionsUsed: 2,
      limit: 5,
      gatingEnabled: true,
    });
    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
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
    expect(data.allowed).toBe(true);
    expect(data.sessionsRemaining).toBe(3);
    expect(data.status).toBe('free');
    expect(data.gatingEnabled).toBe(true);
  });

  it('returns null sessionsRemaining for premium users', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'premium', expiresAt: null });

    const res = await GET();
    const data = await res.json();

    expect(data.sessionsRemaining).toBeNull();
    expect(data.status).toBe('premium');
  });

  it('returns 500 and logs when limiter throws', async () => {
    vi.mocked(checkWeeklySessionLimit).mockRejectedValueOnce(new Error('db failure'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to load weekly session limit');
    expect(logSystemEvent).toHaveBeenCalled();
  });
});
