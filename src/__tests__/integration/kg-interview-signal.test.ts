import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph/service';
import * as supabaseServiceModule from '@/lib/supabase/service';
import * as monitoringModule from '@/lib/monitoring/events';

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/upstash/client', () => ({
  getRedis: vi.fn(() => null),
}));

vi.mock('@/lib/monitoring/events', () => ({
  logSystemEvent: vi.fn(),
}));

// Helper function to create a chainable mock
function createChainableMock() {
  const chain = {
    from: vi.fn(function() { return chain; }),
    select: vi.fn(function() { return chain; }),
    eq: vi.fn(function() { return chain; }),
    maybeSingle: vi.fn(function() { return Promise.resolve({ data: null, error: null }); }),
    upsert: vi.fn(function() { return Promise.resolve({ data: null, error: null }); }),
    rpc: vi.fn(function() { return Promise.resolve({ data: null, error: null }); }),
  };
  return chain;
}

describe('KG Interview Signal Integration', () => {
  let mockServiceClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceClient = createChainableMock();
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);
  });

  it('updates concept_states confidence upward for a passing score', async () => {
    // Setup: mock existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: { confidence: 0.4, evidence_count: 2, signal_history: [] },
      error: null,
    });

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['arrays'],
      primaryPattern: null,
      overallScore: 8,
    });

    // Assert: upsert was called with confidence > 0.4 and evidence_count === 3
    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      'upsert_concept_states_bulk',
      expect.objectContaining({
        p_user_id: 'u1',
        p_updates: expect.arrayContaining([
          expect.objectContaining({
            concept_slug: 'arrays-strings',
            evidence_count: 3,
          }),
        ]),
      })
    );

    const rpcCallArgs = mockServiceClient.rpc.mock.calls[0][1];
    const arrayUpdate = rpcCallArgs.p_updates.find((u: any) => u.concept_slug === 'arrays-strings');
    expect(arrayUpdate.confidence).toBeGreaterThan(0.4);
  });

  it('updates concept_states confidence downward for a failing score', async () => {
    // Setup: mock existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: { confidence: 0.6, evidence_count: 3, signal_history: [] },
      error: null,
    });

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['arrays'],
      primaryPattern: null,
      overallScore: 2,
    });

    // Assert: rpc called with confidence < 0.6
    expect(mockServiceClient.rpc).toHaveBeenCalled();
    const rpcCallArgs = mockServiceClient.rpc.mock.calls[0][1];
    const arrayUpdate = rpcCallArgs.p_updates.find((u: any) => u.concept_slug === 'arrays-strings');
    expect(arrayUpdate.confidence).toBeLessThan(0.6);
  });

  it('is a no-op when no tags map to concept slugs', async () => {
    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['unknown-tag'],
      primaryPattern: null,
      overallScore: 7,
    });

    // Assert: rpc was never called
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  it('calls invalidateCache after updating', async () => {
    // Setup: mock existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: { confidence: 0.5, evidence_count: 1, signal_history: [] },
      error: null,
    });

    const kg = getKnowledgeGraphService();
    const invalidateCacheSpy = vi.spyOn(kg, 'invalidateCache');

    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['trees'],
      primaryPattern: null,
      overallScore: 7,
    });

    // Assert: invalidateCache called with the userId
    expect(invalidateCacheSpy).toHaveBeenCalledWith('u1');
  });

  it('does not throw when upsert fails — logs error instead', async () => {
    // Setup: mock existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: { confidence: 0.5, evidence_count: 1, signal_history: [] },
      error: null,
    });

    // Mock rpc to throw
    mockServiceClient.rpc = vi.fn().mockRejectedValue(new Error('DB error'));

    const kg = getKnowledgeGraphService();

    // Assert: call resolves without throwing
    await expect(
      kg.onInterviewSessionCompleted({
        userId: 'u1',
        sessionId: 's1',
        problemTags: ['arrays'],
        primaryPattern: null,
        overallScore: 7,
      })
    ).resolves.not.toThrow();

    // Assert: logSystemEvent was called
    expect(vi.mocked(monitoringModule.logSystemEvent)).toHaveBeenCalled();
  });

  it('handles multiple concept slugs from tags and primaryPattern', async () => {
    // Setup: mock existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: { confidence: 0.5, evidence_count: 1, signal_history: [] },
      error: null,
    });

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['arrays', 'trees'],
      primaryPattern: 'heap',
      overallScore: 7,
    });

    // Assert: rpc called once with 3 updates (arrays-strings, trees-traversal, heaps)
    expect(mockServiceClient.rpc).toHaveBeenCalledTimes(1);
    const rpcCallArgs = mockServiceClient.rpc.mock.calls[0][1];
    expect(rpcCallArgs.p_updates.length).toBe(3);
  });

  it('uses default confidence 0.35 for new concepts', async () => {
    // Setup: mock no existing state
    mockServiceClient.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1',
      sessionId: 's1',
      problemTags: ['arrays'],
      primaryPattern: null,
      overallScore: 7,
    });

    // Assert: confidence computed from default 0.35
    expect(mockServiceClient.rpc).toHaveBeenCalled();
    const rpcCallArgs = mockServiceClient.rpc.mock.calls[0][1];
    const arrayUpdate = rpcCallArgs.p_updates[0];
    // overallScore 7 → delta = (7/10 - 0.5) * 0.12 = 0.024
    // newConfidence = 0.35 + 0.024 = 0.374
    expect(arrayUpdate.confidence).toBeCloseTo(0.374, 2);
  });
});
