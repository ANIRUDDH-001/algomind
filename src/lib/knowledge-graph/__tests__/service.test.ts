// @vitest-environment node
/**
 * @test KnowledgeGraphService
 * @phase Phase 2A
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { Tables } from '@/types/supabase';
import { KnowledgeGraphService } from '../service';
import type { KGConceptState } from '../types';

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/upstash/client', () => ({
  getRedis: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

type ConceptStateRow = Tables<'concept_states'>;

function makeConceptStateRow(overrides: Partial<ConceptStateRow> = {}): ConceptStateRow {
  return {
    id: 'state-1',
    user_id: 'user-1',
    concept_slug: 'arrays-strings',
    confidence: 0.4,
    evidence_count: 1,
    signal_history: [{ type: 'diagnostic_initial', delta: 0.2, at: '2026-03-01T00:00:00.000Z' }],
    fsrs_due: null,
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_reps: null,
    fsrs_lapses: null,
    fsrs_state: null,
    last_session_id: 'session-1',
    last_session_type: 'diagnostic',
    last_signal_at: '2026-03-01T00:00:00.000Z',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeConceptState(id: string, confidence: number, evidenceCount: number): KGConceptState {
  return {
    id,
    userId: 'user-1',
    conceptSlug: id,
    confidence,
    evidenceCount,
    signalHistory: [],
    lastSessionId: null,
    lastSessionType: null,
    lastSignalAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
}

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  const mockRedisGet = vi.fn();
  const mockRedisSet = vi.fn();
  const mockRedisDel = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KnowledgeGraphService();

    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    vi.mocked(getRedis).mockReturnValue({
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel,
    } as never);

    mockRpc.mockResolvedValue({ error: null });
    mockFrom.mockReset();
    vi.mocked(getServiceClient).mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
    } as never);
  });

  describe('getConceptStates', () => {
    it('returns cached data when Redis has a hit', async () => {
      const cached: KGConceptState[] = [makeConceptState('arrays-strings', 0.6, 2)];
      mockRedisGet.mockResolvedValueOnce({
        conceptStates: cached,
        builtAt: '2026-03-01T00:00:00.000Z',
        ttlHint: 3600,
      });

      const result = await service.getConceptStates('user-1');

      expect(result).toEqual(cached);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('falls back to DB when Redis misses', async () => {
      const order = vi.fn().mockResolvedValue({
        data: [makeConceptStateRow()],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getConceptStates('user-1');

      expect(mockFrom).toHaveBeenCalledWith('concept_states');
      expect(result).toHaveLength(1);
      expect(result[0]?.conceptSlug).toBe('arrays-strings');
    });

    it('returns empty array when DB fails', async () => {
      const order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'db failed' },
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getConceptStates('user-1');

      expect(result).toEqual([]);
      expect(logSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'db_error',
          userId: 'user-1',
        })
      );
    });

    it('caches DB result in Redis', async () => {
      const order = vi.fn().mockResolvedValue({
        data: [makeConceptStateRow()],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      await service.getConceptStates('user-1');

      expect(mockRedisSet).toHaveBeenCalledWith(
        'kg:concepts:user-1',
        expect.objectContaining({
          conceptStates: expect.any(Array),
          ttlHint: 3600,
        }),
        { ex: 3600 }
      );
    });
  });

  describe('getWeakestConcepts', () => {
    it('returns concepts sorted by confidence ascending', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.8, 1),
        makeConceptState('b', 0.2, 1),
        makeConceptState('c', 0.4, 1),
      ]);

      const result = await service.getWeakestConcepts('user-1', 3);

      expect(result.map((state) => state.conceptSlug)).toEqual(['b', 'c', 'a']);
    });

    it('excludes concepts with zero evidence', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.1, 0),
        makeConceptState('b', 0.2, 1),
        makeConceptState('c', 0.3, 0),
      ]);

      const result = await service.getWeakestConcepts('user-1', 5);

      expect(result).toHaveLength(1);
      expect(result[0]?.conceptSlug).toBe('b');
    });

    it('respects limit parameter', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.1, 1),
        makeConceptState('b', 0.2, 1),
        makeConceptState('c', 0.3, 1),
        makeConceptState('d', 0.4, 1),
      ]);

      const result = await service.getWeakestConcepts('user-1', 2);

      expect(result).toHaveLength(2);
      expect(result.map((state) => state.conceptSlug)).toEqual(['a', 'b']);
    });
  });

  describe('getStrongestConcepts', () => {
    it('returns concepts sorted by confidence descending', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.8, 1),
        makeConceptState('b', 0.2, 1),
        makeConceptState('c', 0.4, 1),
      ]);

      const result = await service.getStrongestConcepts('user-1', 3);

      expect(result.map((state) => state.conceptSlug)).toEqual(['a', 'c', 'b']);
    });
  });

  describe('getSingleConceptState', () => {
    it('returns matching concept state when slug exists', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('arrays-strings', 0.7, 2),
      ]);

      const state = await service.getSingleConceptState('user-1', 'arrays-strings');

      expect(state?.conceptSlug).toBe('arrays-strings');
    });

    it('returns null when slug does not exist', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([]);

      await expect(service.getSingleConceptState('user-1', 'missing')).resolves.toBeNull();
    });
  });

  describe('getConceptSummaries', () => {
    it('maps concept tags with fallback values when state missing', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('arrays-strings', 0.9, 2),
      ]);

      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'arrays-strings',
            display_name: 'Arrays & Strings',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 1,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          {
            id: 'graphs-bfs-dfs',
            display_name: 'Graphs',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 2,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
        ],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getConceptSummaries('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          slug: 'arrays-strings',
          level: 'strong',
          icon: 'list',
          evidenceCount: 2,
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          slug: 'graphs-bfs-dfs',
          confidence: 0.5,
          level: 'unknown',
          evidenceCount: 0,
        })
      );
    });

    it('uses cached concept tags when Redis has a hit', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([]);
      mockRedisGet.mockResolvedValueOnce([
        {
          id: 'arrays-strings',
          display_name: 'Arrays & Strings',
          description: null,
          subject: 'dsa',
          icon: 'list',
          sort_order: 1,
          is_active: true,
          created_at: '2026-03-01T00:00:00.000Z',
          updated_at: '2026-03-01T00:00:00.000Z',
        },
      ]);

      const result = await service.getConceptSummaries('user-1');

      expect(result).toHaveLength(1);
      expect(mockFrom).not.toHaveBeenCalledWith('concept_tags');
    });
  });

  describe('hasCompletedDiagnostic', () => {
    it('returns false when no states have evidence', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.2, 0),
        makeConceptState('b', 0.4, 0),
      ]);

      await expect(service.hasCompletedDiagnostic('user-1')).resolves.toBe(false);
    });

    it('returns true when any state has evidence', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('a', 0.2, 0),
        makeConceptState('b', 0.4, 1),
      ]);

      await expect(service.hasCompletedDiagnostic('user-1')).resolves.toBe(true);
    });
  });

  describe('initializeFromDiagnostic', () => {
    it('calls initialize_concept_states RPC with correct payload', async () => {
      await service.initializeFromDiagnostic('user-1', [
        { conceptSlug: 'arrays-strings', confidence: 0.7 },
      ]);

      expect(mockRpc).toHaveBeenCalledWith('initialize_concept_states', {
        p_user_id: 'user-1',
        p_results: JSON.stringify([{ concept_slug: 'arrays-strings', confidence: 0.7 }]),
      });
    });

    it('invalidates Redis cache after write', async () => {
      await service.initializeFromDiagnostic('user-1', []);

      expect(mockRedisDel).toHaveBeenCalledWith('kg:concepts:user-1', 'student_context:user-1');
    });

    it('throws and logs event on RPC failure', async () => {
      mockRpc.mockResolvedValueOnce({ error: { message: 'rpc failed' } });

      await expect(service.initializeFromDiagnostic('user-1', [])).rejects.toThrow(
        'KnowledgeGraphService.initializeFromDiagnostic failed: rpc failed'
      );
      expect(logSystemEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'db_error',
          userId: 'user-1',
        })
      );
    });
  });

  describe('onLearnSessionCompleted', () => {
    it('calls on_learn_session_completed RPC with snake_case payload', async () => {
      const single = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      await service.onLearnSessionCompleted('learn-session-1', {
        understood: ['arrays-strings'],
        struggled: ['dynamic-programming'],
        notes: 'Needs practice on DP transitions.',
        confidenceDelta: 0.08,
      });

      expect(mockRpc).toHaveBeenCalledWith('on_learn_session_completed', {
        p_session_id: 'learn-session-1',
        p_kai_assessment: JSON.stringify({
          understood: ['arrays-strings'],
          struggled: ['dynamic-programming'],
          notes: 'Needs practice on DP transitions.',
          confidence_delta: 0.08,
        }),
      });
    });

    it('invalidates user cache after write', async () => {
      const single = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      await service.onLearnSessionCompleted('learn-session-1', {
        understood: [],
        struggled: [],
        notes: 'ok',
        confidenceDelta: 0,
      });

      expect(mockRedisDel).toHaveBeenCalledWith('kg:concepts:user-1', 'student_context:user-1');
    });

    it('throws when on_learn_session_completed RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({ error: { message: 'learn rpc failed' } });

      await expect(
        service.onLearnSessionCompleted('learn-session-1', {
          understood: [],
          struggled: [],
          notes: 'x',
          confidenceDelta: 0,
        })
      ).rejects.toThrow('KnowledgeGraphService.onLearnSessionCompleted failed: learn rpc failed');
    });
  });

  describe('getNextRecommendedConcept', () => {
    it('returns unlearned concept when some exist', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([]);

      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'arrays-strings',
            display_name: 'Arrays & Strings',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 1,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          {
            id: 'hashmaps-sets',
            display_name: 'Hashmaps & Sets',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 2,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
        ],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getNextRecommendedConcept('user-1');

      expect(result).toBe('arrays-strings');
    });

    it('returns weakest concept when all have evidence', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([
        makeConceptState('arrays-strings', 0.6, 1),
        makeConceptState('hashmaps-sets', 0.3, 2),
      ]);

      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'arrays-strings',
            display_name: 'Arrays & Strings',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 1,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          {
            id: 'hashmaps-sets',
            display_name: 'Hashmaps & Sets',
            description: null,
            subject: 'dsa',
            icon: null,
            sort_order: 2,
            is_active: true,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
        ],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getNextRecommendedConcept('user-1');

      expect(result).toBe('hashmaps-sets');
    });

    it('returns null when no concepts exist', async () => {
      vi.spyOn(service, 'getConceptStates').mockResolvedValue([]);

      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getNextRecommendedConcept('user-1');

      expect(result).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('calls Redis.del with correct key', async () => {
      await service.invalidateCache('user-123');

      expect(mockRedisDel).toHaveBeenCalledWith('kg:concepts:user-123', 'student_context:user-123');
    });

    it('does not throw when Redis fails', async () => {
      mockRedisDel.mockRejectedValueOnce(new Error('redis unavailable'));

      await expect(service.invalidateCache('user-123')).resolves.toBeUndefined();
    });
  });

  describe('normalization and cache edge cases', () => {
    it('normalizes invalid signal history and unknown session type safely', async () => {
      const row = makeConceptStateRow({
        signal_history: [
          { type: 'diagnostic_initial', delta: 0.2, at: '2026-03-01T00:00:00.000Z' },
          { type: 'unknown', delta: 0.3, at: '2026-03-01T00:00:00.000Z' },
          null,
        ] as never,
        last_session_type: 'other' as never,
        updated_at: null,
        last_signal_at: null,
        created_at: '2026-03-03T00:00:00.000Z',
      });

      const order = vi.fn().mockResolvedValue({ data: [row], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getConceptStates('user-1');

      expect(result[0]?.signalHistory).toEqual([
        { type: 'diagnostic_initial', delta: 0.2, at: '2026-03-01T00:00:00.000Z' },
      ]);
      expect(result[0]?.lastSessionType).toBeNull();
      expect(result[0]?.updatedAt).toBe('2026-03-03T00:00:00.000Z');
      expect(result[0]?.lastSignalAt).toBe('2026-03-03T00:00:00.000Z');
    });

    it('falls back to DB when Redis read throws', async () => {
      mockRedisGet.mockRejectedValueOnce(new Error('redis down'));
      const order = vi.fn().mockResolvedValue({ data: [makeConceptStateRow()], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      const result = await service.getConceptStates('user-1');

      expect(result).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('concept_states');
    });

    it('returns states even when Redis write throws', async () => {
      mockRedisSet.mockRejectedValueOnce(new Error('set failed'));
      const order = vi.fn().mockResolvedValue({ data: [makeConceptStateRow()], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });

      await expect(service.getConceptStates('user-1')).resolves.toHaveLength(1);
    });
  });
});
