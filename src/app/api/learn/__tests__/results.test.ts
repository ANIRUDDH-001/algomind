/**
 * @codesage
 * @file      src/app/api/learn/__tests__/results.test.ts
 * @purpose   Tests retrieval of learn session results.
 * @tech      Vitest
 * @connects  @/app/api/learn/results/[sessionId]/route, @/lib/supabase/server, @/lib/supabase/service, @/lib/knowledge-graph
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

import { GET } from '@/app/api/learn/results/[sessionId]/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

function createRequest() {
  return new NextRequest('http://localhost:3000/api/learn/results/session-1', {
    method: 'GET',
  });
}

describe('GET /api/learn/results/[sessionId]', () => {
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    } as never);

    vi.mocked(getKnowledgeGraphService).mockReturnValue({
      getSingleConceptState: vi.fn().mockResolvedValue({ confidence: 0.62 }),
    } as never);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'learn_sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    id: 'session-1',
                    user_id: 'user-1',
                    status: 'completed',
                    concept_slug: 'arrays-strings',
                    duration_seconds: 210,
                    exchange_count: 6,
                    started_at: '2026-03-24T10:00:00.000Z',
                    completed_at: '2026-03-24T10:04:00.000Z',
                    concepts_understood: ['arrays-strings'],
                    concepts_struggled: [],
                    kai_assessment: {
                      notes: 'Solid progress',
                      confidence_delta: 0.08,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'concept_tags') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: 'arrays-strings', display_name: 'Arrays & Strings', icon: '[]' },
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    });

    vi.mocked(getServiceClient).mockReturnValue({ from: mockFrom } as never);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(createServerSupabase).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);

    const res = await GET(createRequest(), { params: Promise.resolve({ sessionId: 'session-1' }) });

    expect(res.status).toBe(401);
  });

  it('returns 404 when session does not exist for user', async () => {
    mockFrom.mockImplementationOnce((table: string) => {
      if (table === 'learn_sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    });

    const res = await GET(createRequest(), { params: Promise.resolve({ sessionId: 'missing' }) });

    expect(res.status).toBe(404);
  });

  it('returns normalized hybrid results payload for completed session', async () => {
    const res = await GET(createRequest(), { params: Promise.resolve({ sessionId: 'session-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.id).toBe('session-1');
    expect(body.concept.slug).toBe('arrays-strings');
    expect(body.concept.confidenceAfter).toBe(0.62);
    expect(body.concept.confidenceBefore).toBe(0.54);
    expect(body.assessment.confidenceDelta).toBe(0.08);
  });
});
