import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWeeklySessionLimit, incrementWeeklyUsage } from '../weekly-session-limiter';

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  getWeeklySessionLimit: vi.fn(),
  isSessionGatingEnabled: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getWeeklySessionLimit, isSessionGatingEnabled } from '@/lib/config/system-config';
import { getServiceClient } from '@/lib/supabase/service';

describe('weekly-session-limiter', () => {
  const profilesSingle = vi.fn();
  const usageMaybeSingle = vi.fn();
  const usageUpsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(getWeeklySessionLimit).mockResolvedValue(5);
    vi.mocked(isSessionGatingEnabled).mockResolvedValue(true);

    profilesSingle.mockResolvedValue({ data: { rate_limit_override: null }, error: null });
    usageMaybeSingle.mockResolvedValue({
      data: { interview_sessions_used: 1, learn_sessions_used: 1 },
      error: null,
    });
    usageUpsert.mockResolvedValue({ data: null, error: null });

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: profilesSingle,
              }),
            }),
          };
        }

        if (table === 'user_weekly_usage') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: usageMaybeSingle,
                }),
              }),
            }),
            upsert: usageUpsert,
          };
        }

        return {
          select: () => ({
            eq: () => ({
              single: profilesSingle,
              maybeSingle: usageMaybeSingle,
            }),
          }),
          upsert: usageUpsert,
        };
      }),
    } as never);
  });

  it('allows free user when gating is disabled', async () => {
    vi.mocked(isSessionGatingEnabled).mockResolvedValueOnce(false);

    const result = await checkWeeklySessionLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.gatingEnabled).toBe(false);
  });

  it('blocks free user when weekly session count hits the limit', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 3, learn_sessions_used: 2 },
      error: null,
    });

    const result = await checkWeeklySessionLimit('user-1');

    expect(result.allowed).toBe(false);
    expect(result.sessionsUsed).toBe(5);
    expect(result.limit).toBe(5);
  });

  it('bypasses weekly limit for premium users', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'premium', expiresAt: null });

    const result = await checkWeeklySessionLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
    expect(profilesSingle).not.toHaveBeenCalled();
  });

  it('increments interview usage counters', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T10:00:00.000Z'));

    await incrementWeeklyUsage('user-1', 'interview');

    expect(usageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        interview_sessions_used: 2,
        learn_sessions_used: 1,
      }),
      { onConflict: 'user_id,week_start' }
    );

    vi.useRealTimers();
  });
});
