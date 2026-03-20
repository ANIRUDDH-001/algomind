import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWeeklySessionLimit, getWeeklySessionCount, incrementWeeklyUsage } from '../weekly-session-limiter';

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
  const usageEqWeek = vi.fn();
  const usageEqUser = vi.fn();
  const profileEqId = vi.fn();
  const eqArgs: Array<[string, unknown]> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    eqArgs.length = 0;

    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(getWeeklySessionLimit).mockResolvedValue(5);
    vi.mocked(isSessionGatingEnabled).mockResolvedValue(true);

    profilesSingle.mockResolvedValue({ data: { rate_limit_override: null }, error: null });
    usageMaybeSingle.mockResolvedValue({
      data: { interview_sessions_used: 1, learn_sessions_used: 1 },
      error: null,
    });
    usageUpsert.mockResolvedValue({ data: null, error: null });

    usageEqWeek.mockImplementation((col: string, value: unknown) => {
      eqArgs.push([col, value]);
      return { maybeSingle: usageMaybeSingle };
    });
    usageEqUser.mockImplementation((col: string, value: unknown) => {
      eqArgs.push([col, value]);
      return { eq: usageEqWeek };
    });
    profileEqId.mockImplementation((col: string, value: unknown) => {
      eqArgs.push([col, value]);
      return { single: profilesSingle };
    });

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: profileEqId,
            }),
          };
        }

        if (table === 'user_weekly_usage') {
          return {
            select: () => ({
              eq: usageEqUser,
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

  it('allows college users without checking profile usage', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'college', expiresAt: null });

    const result = await checkWeeklySessionLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
    expect(profilesSingle).not.toHaveBeenCalled();
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

  it('uses profile override when rate_limit_override is set', async () => {
    profilesSingle.mockResolvedValueOnce({ data: { rate_limit_override: 10 }, error: null });
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 6, learn_sessions_used: 1 },
      error: null,
    });

    const result = await checkWeeklySessionLimit('vip-user');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.sessionsUsed).toBe(7);
  });

  it('treats rate_limit_override=0 as unlimited bypass', async () => {
    profilesSingle.mockResolvedValueOnce({ data: { rate_limit_override: 0 }, error: null });

    const result = await checkWeeklySessionLimit('staff-user');

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
    expect(result.limit).toBe(5);
    expect(usageMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns 0 weekly count when usage row is missing', async () => {
    usageMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(getWeeklySessionCount('new-user')).resolves.toBe(0);
  });

  it('sums interview and learn counts from usage table', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 3, learn_sessions_used: 2 },
      error: null,
    });

    await expect(getWeeklySessionCount('user-1')).resolves.toBe(5);
  });

  it('handles null usage columns as zero', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: null, learn_sessions_used: 3 },
      error: null,
    });

    await expect(getWeeklySessionCount('user-1')).resolves.toBe(3);
  });

  it('queries using current week Monday as week_start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'));

    await getWeeklySessionCount('user-1');

    const weekStartEq = eqArgs.find(([col]) => col === 'week_start');
    expect(weekStartEq?.[1]).toBe('2026-03-16');
    vi.useRealTimers();
  });

  it('uses previous Monday for Sunday dates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));

    await getWeeklySessionCount('user-1');

    const weekStartEq = eqArgs.find(([col]) => col === 'week_start');
    expect(weekStartEq?.[1]).toBe('2026-03-16');
    vi.useRealTimers();
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

  it('increments learn usage counters independently', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 2, learn_sessions_used: 4 },
      error: null,
    });

    await incrementWeeklyUsage('user-1', 'learn');

    expect(usageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        interview_sessions_used: 2,
        learn_sessions_used: 5,
      }),
      { onConflict: 'user_id,week_start' }
    );
  });

  it('swallows increment errors without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    usageMaybeSingle.mockRejectedValueOnce(new Error('db down'));

    await expect(incrementWeeklyUsage('user-1', 'learn')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
