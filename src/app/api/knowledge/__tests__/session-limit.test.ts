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
import { checkWeeklySessionLimitReadOnly } from '@/lib/rate-limit/weekly-session-limiter';
import { isSessionGatingEnabled } from '@/lib/config/system-config';
import { getServiceClient } from '@/lib/supabase/service';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/rate-limit/weekly-session-limiter', () => ({
  checkWeeklySessionLimitReadOnly: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  isSessionGatingEnabled: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

describe('GET /api/knowledge/session-limit', () => {
  const mockAuthGetUser = vi.fn();
  const mockProfileSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    mockProfileSingle.mockResolvedValue({ data: { account_type: 'candidate' }, error: null });
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockProfileSingle,
          }),
        }),
      }),
    } as never);

    vi.mocked(checkWeeklySessionLimitReadOnly).mockImplementation(async () => ({
      allowed: true,
      sessionsUsed: 3,
      limit: 20,
      sessionsRemaining: 17,
      reason: 'within_limit',
    }));

    vi.mocked(isSessionGatingEnabled).mockResolvedValue(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns unified session limit details for candidates', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accountType).toBe('candidate');
    expect(data.allowed).toBe(true);
    expect(data.gatingEnabled).toBe(true);
    expect(data.sessionsUsed).toBe(3);
    expect(data.limit).toBe(20);
    expect(data.sessionsRemaining).toBe(17);
    expect(data.isUnlimited).toBe(false);
  });

  it('returns unlimited details for owners', async () => {
    mockProfileSingle.mockResolvedValueOnce({ data: { account_type: 'owner' }, error: null });
    vi.mocked(checkWeeklySessionLimitReadOnly).mockResolvedValueOnce({
      allowed: true,
      sessionsUsed: 5,
      limit: null,
      sessionsRemaining: null,
      reason: 'admin',
    });

    const res = await GET();
    const data = await res.json();

    expect(data.accountType).toBe('owner');
    expect(data.isUnlimited).toBe(true);
    expect(data.limit).toBeNull();
    expect(data.sessionsRemaining).toBeNull();
  });

  it('returns allowed=false when limit is exceeded', async () => {
    vi.mocked(checkWeeklySessionLimitReadOnly).mockResolvedValueOnce({
      allowed: false,
      sessionsUsed: 20,
      limit: 20,
      sessionsRemaining: 0,
      reason: 'limit_exceeded',
    });

    const res = await GET();
    const data = await res.json();

    expect(data.allowed).toBe(false);
    expect(data.sessionsUsed).toBe(20);
    expect(data.limit).toBe(20);
    expect(data.sessionsRemaining).toBe(0);
    expect(data.reason).toBe('limit_exceeded');
  });

  it('returns 500 when session-limit lookup throws', async () => {
    vi.mocked(checkWeeklySessionLimitReadOnly).mockRejectedValueOnce(new Error('db failure'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
