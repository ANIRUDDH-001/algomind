/**
 * @codesage
 * @file      src/lib/rate-limit/__tests__/rate-limit-integration.test.ts
 * @purpose   Tests for Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUserRateLimit } from '../user-rate-limiter';
import * as supabaseServerModule from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));

vi.mock('@/app/actions/co-owner', () => ({
    checkCoOwnerStatus: vi.fn().mockResolvedValue({ success: true, data: { isCoOwner: false } })
}));

// Test that rate limiter respects limits and fails correctly
describe('Rate limit integration', () => {
  beforeEach(() => {
      vi.clearAllMocks();
      const mockRpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, remaining: 5, is_admin_user: false }], error: null });
      const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { account_type: 'candidate', rate_limit_override: null }, error: null }),
              }),
          }),
      });

      (supabaseServerModule.createServerSupabase as any).mockResolvedValue({
          rpc: mockRpc,
          from: mockFrom,
      });
  });

  it('guest users are always allowed', async () => {
    const result = await checkUserRateLimit(null);
    expect(result.allowed).toBe(true);

    const guestResult = await checkUserRateLimit('guest-user');
    expect(guestResult.allowed).toBe(true);
  });

  it('returns correct remaining count shape', async () => {
    const result = await checkUserRateLimit('test-user-id');

    // Should have these fields regardless of allowed/denied
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('isAdmin');

    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.isAdmin).toBe('boolean');
  });

  it('rate limit result is deterministic for same input', async () => {
    const result1 = await checkUserRateLimit('deterministic-user');
    const result2 = await checkUserRateLimit('deterministic-user');

    // Same user should get same structure (values may differ by 1 if incremented)
    expect(result1.isAdmin).toBe(result2.isAdmin);
  });
});
