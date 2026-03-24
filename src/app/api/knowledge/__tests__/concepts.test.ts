import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/knowledge/concepts/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { logSystemEvent } from '@/lib/monitoring/events';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

describe('GET /api/knowledge/concepts', () => {
  const mockAuthGetUser = vi.fn();
  const mockKG = {
    getConceptSummaries: vi.fn(),
    hasCompletedDiagnostic: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    mockKG.getConceptSummaries.mockResolvedValue([{ slug: 'dp', displayName: 'Dynamic Programming', confidence: 0.4 }]);
    mockKG.hasCompletedDiagnostic.mockResolvedValue(true);
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockKG as never);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns concept summaries and diagnostic flag', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasCompletedDiagnostic).toBe(true);
    expect(data.concepts).toHaveLength(1);
  });

  it('returns 500 and logs when service throws', async () => {
    mockKG.getConceptSummaries.mockRejectedValueOnce(new Error('query failed'));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to load concept summaries');
    expect(logSystemEvent).toHaveBeenCalled();
  });
});
