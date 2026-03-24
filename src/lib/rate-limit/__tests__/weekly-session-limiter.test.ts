import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWeeklySessionLimit, getWeeklySessionCount, incrementWeeklyUsage } from '../weekly-session-limiter';

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  getSystemConfig: vi.fn(),
  isSessionGatingEnabled: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getSystemConfig, isSessionGatingEnabled } from '@/lib/config/system-config';
import { getServiceClient } from '@/lib/supabase/service';

describe('weekly-session-limiter', () => {
  const profilesSingle = vi.fn();
  const usageMaybeSingle = vi.fn();
  const coOwnerMaybeSingle = vi.fn();
  const coOwnerLimit = vi.fn();
  const coOwnerOr = vi.fn();
  const usageEqWeek = vi.fn();
  const usageEqUser = vi.fn();
  const profileEqId = vi.fn();
  const rpc = vi.fn();
  const eqArgs: Array<[string, unknown]> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    eqArgs.length = 0;

    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(isSessionGatingEnabled).mockResolvedValue(true);
    vi.mocked(getSystemConfig).mockResolvedValue('5');

    profilesSingle.mockResolvedValue({
      data: { account_type: 'user', rate_limit_override: null, email: 'test@example.com' },
      error: null,
    });
    usageMaybeSingle.mockResolvedValue({
      data: { interview_sessions_used: 1, learn_sessions_used: 1 },
      error: null,
    });
    coOwnerMaybeSingle.mockResolvedValue({ data: null, error: null });
    rpc.mockResolvedValue({ data: true, error: null });

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

    coOwnerLimit.mockReturnValue({ maybeSingle: coOwnerMaybeSingle });
    coOwnerOr.mockReturnValue({ limit: coOwnerLimit });

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
          };
        }

        if (table === 'co_owners') {
          return {
            select: () => ({
              or: coOwnerOr,
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              single: profilesSingle,
              maybeSingle: usageMaybeSingle,
            }),
          }),
        };
      }),
      rpc,
    } as never);
  });

  it('allows free user when gating is disabled', async () => {
    vi.mocked(isSessionGatingEnabled).mockResolvedValueOnce(false);

    const result = await checkWeeklySessionLimit('user-1', 'interview');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
    expect(result.reason).toBe('gating_disabled');
  });

  it('allows college users without checking profile usage', async () => {
    vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'college', expiresAt: null });

    const result = await checkWeeklySessionLimit('user-1', 'interview');

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
    expect(profilesSingle).not.toHaveBeenCalled();
  });

  it('blocks free user when session count hits the limit', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 5, learn_sessions_used: 0 },
      error: null,
    });

    const result = await checkWeeklySessionLimit('user-1', 'interview');

    expect(result.allowed).toBe(false);
    expect(result.sessionsUsed).toBe(5);
    expect(result.limit).toBe(5);
    expect(result.reason).toBe('limit_exceeded');
  });

  it('uses profile override when rate_limit_override is set', async () => {
    profilesSingle.mockResolvedValueOnce({ data: { account_type: 'user', rate_limit_override: 10 }, error: null });
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 6, learn_sessions_used: 1 },
      error: null,
    });

    const result = await checkWeeklySessionLimit('vip-user', 'interview');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.sessionsUsed).toBe(6);
  });

  it('treats rate_limit_override=0 as unlimited bypass', async () => {
    profilesSingle.mockResolvedValueOnce({
      data: { account_type: 'user', rate_limit_override: 0, email: 'test@example.com' },
      error: null,
    });

    const result = await checkWeeklySessionLimit('staff-user', 'interview');

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
    expect(result.limit).toBeNull();
    expect(result.reason).toBe('admin');
    expect(usageMaybeSingle).not.toHaveBeenCalled();
  });

  it('treats co-owner as unlimited bypass', async () => {
    profilesSingle.mockResolvedValueOnce({
      data: { account_type: 'candidate', rate_limit_override: null, email: 'co@example.com' },
      error: null,
    });
    coOwnerMaybeSingle.mockResolvedValueOnce({ data: { id: 'co-1' }, error: null });

    const result = await checkWeeklySessionLimit('co-owner-user', 'learn');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
    expect(result.reason).toBe('admin');
    expect(usageMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns 0/0/0 when usage row is missing', async () => {
    usageMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(getWeeklySessionCount('new-user')).resolves.toEqual({ interview: 0, learn: 0, total: 0 });
  });

  it('returns combined interview/learn totals from usage row', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 3, learn_sessions_used: 2 },
      error: null,
    });

    await expect(getWeeklySessionCount('user-1')).resolves.toEqual({ interview: 3, learn: 2, total: 5 });
  });

  it('queries using current week Monday as week_start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'));

    await getWeeklySessionCount('user-1');

    const weekStartEq = eqArgs.find(([col]) => col === 'week_start');
    expect(weekStartEq?.[1]).toBe('2026-03-16');
    vi.useRealTimers();
  });

  it('increments interview usage atomically through rpc', async () => {
    await expect(incrementWeeklyUsage('user-1', 'interview')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('atomic_increment_weekly_usage', {
      p_user_id: 'user-1',
      p_type: 'interview',
      p_limit: 5,
    });
  });

  it('returns false when rpc reports limit already reached', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(incrementWeeklyUsage('user-1', 'learn')).resolves.toBe(false);
  });

  it('throws when rpc returns error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    await expect(incrementWeeklyUsage('user-1', 'learn')).rejects.toThrow('Weekly usage increment failed: db down');
  });
});
