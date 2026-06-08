/**
 * @codesage
 * @file      src/lib/rate-limit/__tests__/weekly-session-limiter.test.ts
 * @purpose   Tests for Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Session state
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWeeklySessionLimitReadOnly, checkAndIncrementWeeklySession, getWeeklySessionCount } from '../weekly-session-limiter';

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
    rpc.mockResolvedValue({ data: [{ allowed: true, sessions_used: 1, limit_value: 5 }], error: null });

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

  describe('checkWeeklySessionLimitReadOnly', () => {
    it('allows free user when gating is disabled', async () => {
      vi.mocked(isSessionGatingEnabled).mockResolvedValueOnce(false);

      const result = await checkWeeklySessionLimitReadOnly('user-1', 'interview');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
      expect(result.reason).toBe('gating_disabled');
    });

    it('allows college users without checking profile usage', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'college', expiresAt: null });

      const result = await checkWeeklySessionLimitReadOnly('user-1', 'interview');

      expect(result.allowed).toBe(true);
      expect(result.sessionsUsed).toBe(0);
      expect(profilesSingle).not.toHaveBeenCalled();
    });

    it('blocks free user when session count hits the limit', async () => {
      usageMaybeSingle.mockResolvedValueOnce({
        data: { interview_sessions_used: 5, learn_sessions_used: 0 },
        error: null,
      });

      const result = await checkWeeklySessionLimitReadOnly('user-1', 'interview');

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

      const result = await checkWeeklySessionLimitReadOnly('vip-user', 'interview');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.sessionsUsed).toBe(6);
    });
  });

  describe('checkAndIncrementWeeklySession', () => {
    it('bypasses increment if read-only check gives admin or premium', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'college', expiresAt: null });
      const result = await checkAndIncrementWeeklySession('user-1', 'interview');
      expect(result.allowed).toBe(true);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('calls check_and_increment_weekly_usage rpc', async () => {
      rpc.mockResolvedValueOnce({ data: [{ allowed: true, sessions_used: 2, limit_value: 5 }], error: null });
      const result = await checkAndIncrementWeeklySession('user-1', 'interview');
      expect(result.allowed).toBe(true);
      expect(rpc).toHaveBeenCalledWith('check_and_increment_weekly_usage', {
        p_user_id: 'user-1',
        p_session_type: 'interview',
        p_weekly_limit: 5,
      });
    });

    it('returns allowed=false if rpc returns allowed=false', async () => {
      rpc.mockResolvedValueOnce({ data: [{ allowed: false, sessions_used: 5, limit_value: 5 }], error: null });
      const result = await checkAndIncrementWeeklySession('user-1', 'interview');
      expect(result.allowed).toBe(false);
    });

    it('fails closed on rpc error', async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
      const result = await checkAndIncrementWeeklySession('user-1', 'interview');
      expect(result.allowed).toBe(false);
      expect(result.sessionsUsed).toBe(-1);
    });
  });

  describe('checkAndIncrementWeeklySession — concurrent requests', () => {
    it('allows exactly N sessions when N concurrent requests arrive', async () => {
        // Since we mock the DB, we can't test actual DB atomicity here.
        // But we ensure the wrapper handles the concurrent calls and relies entirely on the DB.
        const userId = 'test-user-concurrent';
        const limit = 3;

        let dbCounter = 0;
        rpc.mockImplementation(async () => {
            dbCounter++;
            return {
                data: [{
                    allowed: dbCounter <= limit,
                    sessions_used: dbCounter <= limit ? dbCounter : dbCounter - 1, // rollback simulator
                    limit_value: limit
                }],
                error: null
            };
        });

        // Simulate 5 concurrent requests
        const results = await Promise.all(
            Array(5).fill(null).map(() =>
                checkAndIncrementWeeklySession(userId, 'interview')
            )
        );

        const allowed = results.filter(r => r.allowed);
        const denied  = results.filter(r => !r.allowed);

        // Exactly 3 should be allowed, 2 denied
        expect(allowed.length).toBe(limit);
        expect(denied.length).toBe(2);
    });
  });

  it('returns combined interview/learn totals from usage row', async () => {
    usageMaybeSingle.mockResolvedValueOnce({
      data: { interview_sessions_used: 3, learn_sessions_used: 2 },
      error: null,
    });

    await expect(getWeeklySessionCount('user-1')).resolves.toEqual({ interview: 3, learn: 2, total: 5 });
  });
});
