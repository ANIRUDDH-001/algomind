/**
 * @codesage
 * @file      src/app/api/learn/__tests__/diagnostic.test.ts
 * @purpose   Tests diagnostic submission logic and side effects.
 * @tech      Vitest
 * @connects  @/app/api/learn/diagnostic/route, @/lib/supabase/server, @/lib/knowledge-graph, @/lib/kai-context
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/learn/diagnostic/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { invalidateStudentContext } from '@/lib/kai-context';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

vi.mock('@/lib/kai-context', () => ({
  invalidateStudentContext: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/learn/diagnostic', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/learn/diagnostic', () => {
  const mockAuthGetUser = vi.fn();
  const mockKG = {
    initializeFromDiagnostic: vi.fn(),
    getNextRecommendedConcept: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    mockKG.initializeFromDiagnostic.mockResolvedValue(undefined);
    mockKG.getNextRecommendedConcept.mockResolvedValue('dynamic-programming');
    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockKG as never);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const res = await POST(createRequest({ results: [] }));

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid payloads', async () => {
    const res = await POST(createRequest({ results: [{ conceptSlug: 'dp', confidence: 2 }] }));

    expect(res.status).toBe(400);
  });

  it('initializes concept states and invalidates student context', async () => {
    const res = await POST(createRequest({
      results: [
        { conceptSlug: 'dynamic-programming', confidence: 0.4 },
        { conceptSlug: 'graphs', confidence: 0.3 },
      ],
    }));

    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockKG.initializeFromDiagnostic).toHaveBeenCalledWith('user-1', [
      { conceptSlug: 'dynamic-programming', confidence: 0.4 },
      { conceptSlug: 'graphs', confidence: 0.3 },
    ]);
    expect(invalidateStudentContext).toHaveBeenCalledWith('user-1');
    expect(data.nextRecommendedConcept).toBe('dynamic-programming');
  });
});
