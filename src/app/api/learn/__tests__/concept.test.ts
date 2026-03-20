import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/learn/concept/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getAIClient } from '@/lib/ai/client';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { buildStudentContext, invalidateStudentContext } from '@/lib/kai-context';
import { checkWeeklySessionLimit, incrementWeeklyUsage } from '@/lib/rate-limit/weekly-session-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

vi.mock('@/lib/kai-context', () => ({
  buildStudentContext: vi.fn(),
  invalidateStudentContext: vi.fn(),
  buildStudentContextPromptBlock: vi.fn(() => '<student_context />'),
}));

vi.mock('@/lib/rate-limit/weekly-session-limiter', () => ({
  checkWeeklySessionLimit: vi.fn(),
  incrementWeeklyUsage: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

vi.mock('@/lib/feature-flags-server', () => ({
  getGlobalFeatureFlag: vi.fn().mockResolvedValue(false),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/learn/concept', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/learn/concept', () => {
  const mockAuthGetUser = vi.fn();
  const mockFrom = vi.fn();
  const mockGenerateResponse = vi.fn();

  const mockKG = {
    getSingleConceptState: vi.fn(),
    onLearnSessionCompleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: mockAuthGetUser },
    } as never);

    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockKG as never);
    mockKG.getSingleConceptState.mockResolvedValue({ confidence: 0.4 });
    mockKG.onLearnSessionCompleted.mockResolvedValue(undefined);

    vi.mocked(buildStudentContext).mockResolvedValue({ userId: 'user-1' } as never);

    vi.mocked(checkWeeklySessionLimit).mockResolvedValue({
      allowed: true,
      sessionsUsed: 1,
      limit: 5,
      sessionsRemaining: 4,
      reason: 'within_limit',
    });
    vi.mocked(incrementWeeklyUsage).mockResolvedValue(true);

    vi.mocked(getAIClient).mockReturnValue({
      generateResponse: mockGenerateResponse,
    } as never);
    mockGenerateResponse.mockResolvedValue({
      success: true,
      response: 'Great, let us build this intuition.',
      modelUsed: 'llama-3.3-70b-versatile',
      provider: 'groq',
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'concept_tags') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: {
                    id: 'dynamic-programming',
                    display_name: 'Dynamic Programming',
                    description: 'Optimize overlapping subproblems',
                    subject: 'dsa',
                    icon: 'list',
                    sort_order: 1,
                    is_active: true,
                    created_at: '2026-03-01T00:00:00.000Z',
                    updated_at: '2026-03-01T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'learn_sessions') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'learn-session-1' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { started_at: '2026-03-19T09:00:00.000Z' }, error: null }),
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

  describe('Auth', () => {
    it('returns 401 when no user session', async () => {
      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const res = await POST(createRequest({ conceptSlug: 'dynamic-programming', messages: [] }));

      expect(res.status).toBe(401);
    });
  });

  describe('Input validation', () => {
    it('returns 400 when conceptSlug is missing', async () => {
      const res = await POST(createRequest({ messages: [] }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when conceptSlug is not in concept_tags', async () => {
      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'concept_tags') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({}) }) };
      });

      const res = await POST(createRequest({ conceptSlug: 'unknown', messages: [] }));

      expect(res.status).toBe(400);
    });
  });

  describe('Session start', () => {
    it('creates learn_sessions row on first turn and returns sessionId', async () => {
      const res = await POST(createRequest({
        action: 'start',
        conceptSlug: 'dynamic-programming',
        messages: [{ role: 'user', content: 'Help me with DP.' }],
      }));

      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.sessionId).toBe('learn-session-1');
      expect(incrementWeeklyUsage).toHaveBeenCalledWith('user-1', 'learn');
    });

    it('returns 429 when weekly limit reached', async () => {
      vi.mocked(checkWeeklySessionLimit).mockResolvedValueOnce({
        allowed: false,
        sessionsUsed: 5,
        limit: 5,
        sessionsRemaining: 0,
        reason: 'limit_exceeded',
      });

      const res = await POST(createRequest({
        action: 'start',
        conceptSlug: 'dynamic-programming',
        messages: [{ role: 'user', content: 'Help me with DP.' }],
      }));

      expect(res.status).toBe(429);
    });
  });

  describe('Ongoing turns', () => {
    it('calls AI with tutor system prompt and persists transcript', async () => {
      const res = await POST(createRequest({
        action: 'turn',
        sessionId: 'learn-session-1',
        conceptSlug: 'dynamic-programming',
        messages: [{ role: 'user', content: 'I am stuck at transitions.' }],
      }));

      expect(res.status).toBe(200);
      expect(mockGenerateResponse).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('learn_sessions');
    });

    it('auto-ends session when turn limit hit', async () => {
      mockGenerateResponse
        .mockResolvedValueOnce({
          success: true,
          response: '{"understood":[],"struggled":["dynamic-programming"],"notes":"Needs more practice","confidence_delta":-0.02}',
        })
        .mockResolvedValueOnce({ success: true, response: 'done' });

      const tooManyMessages = new Array(LEARN_TURN_LIMIT_TEST * 2 + 1)
        .fill(null)
        .map((_, index) => ({ role: index % 2 === 0 ? 'user' : 'assistant', content: 'x' }));

      const res = await POST(createRequest({
        action: 'turn',
        sessionId: 'learn-session-1',
        conceptSlug: 'dynamic-programming',
        messages: tooManyMessages,
      }));

      const data = await res.json();
      expect(data.sessionComplete).toBe(true);
    });
  });

  describe('Session end', () => {
    it('marks session completed, updates KG, and invalidates student context cache', async () => {
      mockGenerateResponse.mockResolvedValueOnce({
        success: true,
        response: '{"understood":["dynamic-programming"],"struggled":[],"notes":"Good progress","confidence_delta":0.08}',
      });

      const res = await POST(createRequest({
        action: 'end',
        sessionId: 'learn-session-1',
        conceptSlug: 'dynamic-programming',
        messages: [{ role: 'user', content: 'I think I got it.' }],
      }));

      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.sessionComplete).toBe(true);
      expect(mockKG.onLearnSessionCompleted).toHaveBeenCalledWith(
        'learn-session-1',
        expect.objectContaining({ confidenceDelta: expect.any(Number) })
      );
      expect(invalidateStudentContext).toHaveBeenCalledWith('user-1');
    });
  });

  describe('AI failure handling', () => {
    it('returns 503 when AI call fails and logs event', async () => {
      const forcedFailGenerate = vi.fn().mockResolvedValue({
        success: false,
        response: undefined,
        error: 'provider down',
      });
      vi.mocked(getAIClient).mockReturnValueOnce({
        generateResponse: forcedFailGenerate,
      } as never);

      const res = await POST(createRequest({
        action: 'start',
        conceptSlug: 'dynamic-programming',
        messages: [{ role: 'user', content: 'help' }],
      }));

      expect(res.status).toBe(503);
      expect(forcedFailGenerate).toHaveBeenCalled();
      expect(logSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'model_error',
          userId: 'user-1',
        })
      );
    });
  });
});

const LEARN_TURN_LIMIT_TEST = 20;
