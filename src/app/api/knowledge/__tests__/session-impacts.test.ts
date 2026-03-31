import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/knowledge/session-impacts/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

describe('GET /api/knowledge/session-impacts', () => {
  const authGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: authGetUser },
    } as never);
  });

  function createReq(url: string) {
    return new NextRequest(url);
  }

  it('returns 401 for unauthenticated', async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-1'));

    expect(res.status).toBe(401);
  });

  it('returns 400 when sessionId missing', async () => {
    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'sessionId required' });
  });

  it('returns impacts from learning_signals', async () => {
    const service = {
      from: vi.fn((table: string) => {
        if (table === 'learning_signals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: undefined,
            // final chained call resolves from eq
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'arrays', display_name: 'Arrays' }],
            error: null,
          }),
        };
      }),
    } as any;

    const signalsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: any, col: string) {
        if (col === 'user_id') {
          return Promise.resolve({
            data: [{ concept_slug: 'arrays', delta: 0.2, confidence_before: 0.3, confidence_after: 0.5 }],
            error: null,
          });
        }
        return this;
      }),
    };

    service.from = vi.fn((table: string) => {
      if (table === 'learning_signals') {
        return signalsChain;
      }
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'arrays', display_name: 'Arrays' }],
          error: null,
        }),
      };
    });

    vi.mocked(getServiceClient).mockReturnValue(service);

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.impacts).toEqual([
      {
        slug: 'arrays',
        displayName: 'Arrays',
        delta: 0.2,
        confidenceAfter: 0.5,
      },
    ]);
  });

  it('enriches slugs with display names', async () => {
    const signalsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: any, col: string) {
        if (col === 'user_id') {
          return Promise.resolve({
            data: [{ concept_slug: 'binary-search', delta: -0.1, confidence_before: 0.6, confidence_after: 0.5 }],
            error: null,
          });
        }
        return this;
      }),
    };

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'learning_signals') return signalsChain;
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'binary-search', display_name: 'Binary Search' }],
            error: null,
          }),
        };
      }),
    } as never);

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-2'));
    const data = await res.json();

    expect(data.impacts[0].displayName).toBe('Binary Search');
  });

  it('returns empty impacts for session with no signals', async () => {
    const signalsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: any, col: string) {
        if (col === 'user_id') {
          return Promise.resolve({ data: [], error: null });
        }
        return this;
      }),
    };

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn(() => signalsChain),
    } as never);

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-3'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ impacts: [] });
  });

  it('returns 500 when learning signal query fails', async () => {
    const signalsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: any, col: string) {
        if (col === 'user_id') {
          return Promise.resolve({ data: null, error: new Error('query failed') });
        }
        return this;
      }),
    };

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn(() => signalsChain),
    } as never);

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-4'));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch learning signals' });
  });

  it('falls back to slug when concept tag lookup is missing', async () => {
    const signalsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: any, col: string) {
        if (col === 'user_id') {
          return Promise.resolve({
            data: [{ concept_slug: 'custom-slug', delta: 0.05, confidence_before: 0.1, confidence_after: 0.15 }],
            error: null,
          });
        }
        return this;
      }),
    };

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'learning_signals') return signalsChain;
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    } as never);

    const res = await GET(createReq('http://localhost:3000/api/knowledge/session-impacts?sessionId=s-5'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.impacts[0].displayName).toBe('custom-slug');
  });
});
