// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildStudentContext, buildStudentContextPromptBlock, invalidateStudentContext } from '../builder';
import { getRedis } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getWeeklySessionLimit } from '@/lib/config/system-config';

vi.mock('@/lib/upstash/client', () => ({
  getRedis: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: vi.fn(),
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/config/system-config', () => ({
  getWeeklySessionLimit: vi.fn(),
}));

function buildMockStudentContext(
  overrides: Partial<Parameters<typeof buildStudentContextPromptBlock>[0]> = {}
) {
  return {
    userId: 'test-user',
    builtAt: new Date().toISOString(),
    hasCompletedDiagnostic: true,
    weakestConcepts: [],
    strongestConcepts: [],
    allConceptSummaries: [],
    nextRecommendedConcept: null,
    performance: {
      totalSessionsCompleted: 0,
      averageScore: null,
      lastSessionScore: null,
      lastSessionAt: null,
      streak: 0,
    },
    kaiMemoryText: null,
    kaiMemoryStructured: null,
    subscription: { status: 'free' as const, sessionsUsedThisWeek: 0, weeklyLimit: 5, sessionsRemaining: 5 },
    accountType: 'candidate' as const,
    ...overrides,
  };
}

describe('StudentContext Builder', () => {
  const mockRedisGet = vi.fn();
  const mockRedisSet = vi.fn();
  const mockRedisDel = vi.fn();

  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockLimit = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();

  const mockKGService = {
    getConceptSummaries: vi.fn(),
    getNextRecommendedConcept: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    vi.mocked(getRedis).mockReturnValue({
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel,
    } as never);

    vi.mocked(getKnowledgeGraphService).mockReturnValue(mockKGService as never);
    mockKGService.getConceptSummaries.mockResolvedValue([
      { slug: 'dp', displayName: 'DP', confidence: 0.23, level: 'weak', evidenceCount: 3, icon: 'list', lastSessionType: 'learn', lastSignalAt: '2026-03-01T00:00:00.000Z' },
      { slug: 'arrays', displayName: 'Arrays', confidence: 0.82, level: 'strong', evidenceCount: 5, icon: 'list', lastSessionType: 'interview', lastSignalAt: '2026-03-02T00:00:00.000Z' },
    ]);
    mockKGService.getNextRecommendedConcept.mockResolvedValue('dp');

    vi.mocked(getUserSubscriptionStatus).mockResolvedValue({ status: 'free', expiresAt: null });
    vi.mocked(getWeeklySessionLimit).mockResolvedValue(5);

    mockSingle.mockReset();
    mockMaybeSingle.mockReset();
    mockLimit.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();

    mockSingle.mockResolvedValue({
      data: {
        overall_score: 7.2,
        completed_at: '2026-03-19T10:00:00.000Z',
        created_at: '2026-03-19T09:30:00.000Z',
      },
      error: null,
    });

    const completedSessions = [
      { overall_score: 7.2, completed_at: '2026-03-19T10:00:00.000Z', created_at: '2026-03-19T09:30:00.000Z' },
      { overall_score: 6.4, completed_at: '2026-03-18T10:00:00.000Z', created_at: '2026-03-18T09:30:00.000Z' },
    ];

    mockLimit.mockResolvedValue({ data: completedSessions, error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockImplementation(() => ({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle, order: mockOrder }));
    mockSelect.mockImplementation(() => ({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle, order: mockOrder }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        mockSingle.mockResolvedValueOnce({ data: { account_type: 'candidate' }, error: null });
      }
      if (table === 'learner_profiles') {
        mockSingle.mockResolvedValueOnce({
          data: {
            kai_memory: 'Prefers dry-run style prompts.',
            kai_memory_structured: {
              topStrength: { skill: 'problemDecomposition', evidence: 'Breaks down examples first' },
              mainWeakness: { skill: 'complexityAnalysis', evidence: 'Uncertain on space complexity' },
              communicationStyle: 'analytical',
              focusForNextSession: 'Practice complexity explanations',
            },
          },
          error: null,
        });
      }
      if (table === 'user_weekly_usage') {
        mockMaybeSingle.mockResolvedValueOnce({ data: { interview_sessions_used: 2, learn_sessions_used: 1 }, error: null });
      }

      return { select: mockSelect };
    });

    vi.mocked(getServiceClient).mockReturnValue({ from: mockFrom } as never);
  });

  describe('buildStudentContext', () => {
    it('returns cached context when Redis hit', async () => {
      const cached = buildMockStudentContext({ userId: 'user-1' });
      mockRedisGet.mockResolvedValueOnce(cached);

      const result = await buildStudentContext('user-1');

      expect(result.userId).toBe('user-1');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('builds fresh context when Redis misses', async () => {
      const result = await buildStudentContext('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.weakestConcepts.length).toBeGreaterThan(0);
      expect(mockFrom).toHaveBeenCalled();
    });

    it('caches result after building', async () => {
      await buildStudentContext('user-1');

      expect(mockRedisSet).toHaveBeenCalledWith(
        'student_context:user-1',
        expect.objectContaining({ userId: 'user-1' }),
        { ex: 86400 }
      );
    });

    it('handles KnowledgeGraphService failure gracefully', async () => {
      mockKGService.getConceptSummaries.mockRejectedValueOnce(new Error('kg down'));

      const result = await buildStudentContext('user-1');

      expect(result.allConceptSummaries).toEqual([]);
      expect(result.hasCompletedDiagnostic).toBe(false);
    });

    it('handles profile fetch failure gracefully', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles' || table === 'learner_profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.reject(new Error('profile unavailable')) }),
            }),
          };
        }
        if (table === 'interview_sessions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
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

      const result = await buildStudentContext('user-1');

      expect(result.kaiMemoryText).toBeNull();
      expect(result.accountType).toBe('candidate');
    });

    it('computes sessionsRemaining correctly for free user', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'free', expiresAt: null });
      vi.mocked(getWeeklySessionLimit).mockResolvedValueOnce(5);

      const result = await buildStudentContext('user-1');

      expect(result.subscription.sessionsUsedThisWeek).toBe(3);
      expect(result.subscription.sessionsRemaining).toBe(2);
    });

    it('sets sessionsRemaining to null for premium user', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValueOnce({ status: 'premium', expiresAt: null });

      const result = await buildStudentContext('user-1');

      expect(result.subscription.status).toBe('premium');
      expect(result.subscription.sessionsRemaining).toBeNull();
      expect(result.subscription.weeklyLimit).toBeNull();
    });

    it('sets hasCompletedDiagnostic false when no concept evidence', async () => {
      mockKGService.getConceptSummaries.mockResolvedValueOnce([
        { slug: 'dp', displayName: 'DP', confidence: 0.5, level: 'unknown', evidenceCount: 0, icon: 'list', lastSessionType: null, lastSignalAt: null },
      ]);

      const result = await buildStudentContext('user-1');

      expect(result.hasCompletedDiagnostic).toBe(false);
    });

    it('sets hasCompletedDiagnostic true when concepts have evidence', async () => {
      const result = await buildStudentContext('user-1');

      expect(result.hasCompletedDiagnostic).toBe(true);
    });

    it('falls back to weakest concept when next recommended is unavailable', async () => {
      mockKGService.getNextRecommendedConcept.mockRejectedValueOnce(new Error('unavailable'));

      const result = await buildStudentContext('user-1');

      expect(result.nextRecommendedConcept).toBe('dp');
    });

    it('falls back to first concept slug when no weak concepts are available', async () => {
      mockKGService.getConceptSummaries.mockResolvedValueOnce([
        { slug: 'graphs', displayName: 'Graphs', confidence: 0.5, level: 'unknown', evidenceCount: 0, icon: 'list', lastSessionType: null, lastSignalAt: null },
      ]);
      mockKGService.getNextRecommendedConcept.mockResolvedValueOnce(null);

      const result = await buildStudentContext('user-1');

      expect(result.nextRecommendedConcept).toBe('graphs');
    });

    it('uses safe defaults when weekly usage and subscription fetch fail', async () => {
      vi.mocked(getUserSubscriptionStatus).mockRejectedValueOnce(new Error('sub down'));
      mockFrom.mockImplementation((table: string) => {
        if (table === 'user_weekly_usage') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: () => Promise.reject(new Error('usage down')) }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
        };
      });

      const result = await buildStudentContext('user-1');

      expect(result.subscription.status).toBe('free');
      expect(result.subscription.sessionsUsedThisWeek).toBe(0);
    });
  });

  describe('buildStudentContextPromptBlock', () => {
    it('includes weak concepts formatted correctly', () => {
      const ctx = buildMockStudentContext({
        weakestConcepts: [
          { slug: 'dp', displayName: 'DP', confidence: 0.23, level: 'weak', evidenceCount: 3 },
        ],
      });

      const block = buildStudentContextPromptBlock(ctx);

      expect(block).toContain('DP(23%)');
      expect(block).toContain('<weak_concepts>');
    });

    it('shows diagnostic pending for new user', () => {
      const ctx = buildMockStudentContext({ hasCompletedDiagnostic: false });

      const block = buildStudentContextPromptBlock(ctx);

      expect(block).toContain('pending');
    });

    it('shows session count for free user', () => {
      const ctx = buildMockStudentContext({
        subscription: { status: 'free', sessionsUsedThisWeek: 3, weeklyLimit: 5, sessionsRemaining: 2 },
      });

      const block = buildStudentContextPromptBlock(ctx);

      expect(block).toContain('3/5');
    });

    it('escapes XML-sensitive characters in prompt fields', () => {
      const ctx = buildMockStudentContext({
        weakestConcepts: [
          { slug: 'x', displayName: 'A<B & C', confidence: 0.2, level: 'weak', evidenceCount: 1 },
        ],
        kaiMemoryText: 'Use "single quotes" and <tags> & ampersands',
      });

      const block = buildStudentContextPromptBlock(ctx);

      expect(block).toContain('&lt;');
      expect(block).toContain('&amp;');
      expect(block).toContain('&quot;');
    });

    it('prefers structured kai memory fields over text memory', () => {
      const ctx = buildMockStudentContext({
        kaiMemoryText: 'old memory text',
        kaiMemoryStructured: {
          topStrength: 'problemDecomposition',
          mainWeakness: 'complexityAnalysis',
          communicationStyle: 'analytical',
          focusForNextSession: 'edge cases',
        },
      });

      const block = buildStudentContextPromptBlock(ctx);

      expect(block).toContain('Strength: problemDecomposition');
      expect(block).toContain('Weakness: complexityAnalysis');
      expect(block).not.toContain('old memory text');
    });
  });

  describe('invalidateStudentContext', () => {
    it('calls Redis.del with correct key', async () => {
      await invalidateStudentContext('user-123');

      expect(mockRedisDel).toHaveBeenCalledWith('student_context:user-123');
    });

    it('does not throw when Redis fails', async () => {
      mockRedisDel.mockRejectedValueOnce(new Error('redis down'));

      await expect(invalidateStudentContext('user-123')).resolves.toBeUndefined();
    });
  });
});
