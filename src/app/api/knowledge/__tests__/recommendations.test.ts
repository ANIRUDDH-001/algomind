import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/knowledge/recommendations/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildStudentContext } from '@/lib/kai-context';
import { logSystemEvent } from '@/lib/monitoring/events';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/kai-context', () => ({
  buildStudentContext: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

describe('GET /api/knowledge/recommendations', () => {
  const mockAuthGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    vi.mocked(buildStudentContext).mockResolvedValue({
      hasCompletedDiagnostic: true,
      nextRecommendedConcept: 'graphs',
      weakestConcepts: [{ slug: 'graphs', displayName: 'Graphs', confidence: 0.3, level: 'weak', evidenceCount: 2 }],
      strongestConcepts: [{ slug: 'arrays', displayName: 'Arrays', confidence: 0.8, level: 'strong', evidenceCount: 4 }],
      allConceptSummaries: [],
      subscription: { status: 'free', sessionsUsedThisWeek: 2, weeklyLimit: 5, sessionsRemaining: 3 },
    } as never);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns recommendation payload from student context', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(
      expect.objectContaining({
        hasCompletedDiagnostic: true,
        nextRecommendedConcept: 'graphs',
        weakestConcepts: expect.any(Array),
        strongestConcepts: expect.any(Array),
        allConceptSummaries: expect.any(Array),
        subscription: expect.any(Object),
      })
    );
  });

  it('returns 500 and logs when context builder fails', async () => {
    vi.mocked(buildStudentContext).mockRejectedValueOnce(new Error('context failed'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to load recommendations');
    expect(logSystemEvent).toHaveBeenCalled();
  });
});
