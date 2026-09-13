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

// onInterviewSessionCompleted now writes concept_states DIRECTLY (the former
// `upsert_concept_states_batch` RPC rejected the service role and never succeeded).
// Chain under test: from('concept_states').select(...).eq('user_id').in('concept_slug', [...])
// for the read, then from('concept_states').upsert(rows, { onConflict }) for the write.
function createChainableMock(existingRows: any[] = []) {
  const chain: any = {
    from: vi.fn(function () { return chain; }),
    select: vi.fn(function () { return chain; }),
    eq: vi.fn(function () { return chain; }),
    in: vi.fn(function () { return Promise.resolve({ data: existingRows, error: null }); }),
    upsert: vi.fn(function () { return Promise.resolve({ data: null, error: null }); }),
    rpc: vi.fn(function () { return Promise.resolve({ data: null, error: null }); }),
  };
  return chain;
}

function upsertRows(mock: any): any[] {
  return mock.upsert.mock.calls[0][0];
}

describe('KG Interview Signal Integration', () => {
  let mockServiceClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceClient = createChainableMock();
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);
  });

  it('updates concept_states confidence upward for a passing score', async () => {
    mockServiceClient = createChainableMock([
      { concept_slug: 'arrays-strings', confidence: 0.4, evidence_count: 2, signal_history: [] },
    ]);
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 8,
    });

    expect(mockServiceClient.upsert).toHaveBeenCalledTimes(1);
    const row = upsertRows(mockServiceClient).find((r) => r.concept_slug === 'arrays-strings');
    // score 8 → delta = (0.8 - 0.5) * 0.12 = 0.036 → 0.4 + 0.036 = 0.436
    expect(row.confidence).toBeCloseTo(0.436, 3);
    expect(row.evidence_count).toBe(3);
    expect(row.user_id).toBe('u1');
    expect(row.last_session_type).toBe('interview');
    expect(row.last_session_id).toBe('s1');
    expect(mockServiceClient.upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id,concept_slug' });
    // the guarded RPC is no longer used
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  it('updates concept_states confidence downward for a failing score', async () => {
    mockServiceClient = createChainableMock([
      { concept_slug: 'arrays-strings', confidence: 0.6, evidence_count: 3, signal_history: [] },
    ]);
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 2,
    });

    const row = upsertRows(mockServiceClient).find((r) => r.concept_slug === 'arrays-strings');
    // score 2 → delta = (0.2 - 0.5) * 0.12 = -0.036 → 0.6 - 0.036 = 0.564
    expect(row.confidence).toBeCloseTo(0.564, 3);
    expect(row.confidence).toBeLessThan(0.6);
    expect(row.evidence_count).toBe(4);
  });

  it('clamps confidence to [0, 1]', async () => {
    mockServiceClient = createChainableMock([
      { concept_slug: 'arrays-strings', confidence: 0.99, evidence_count: 9, signal_history: [] },
    ]);
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 10,
    });

    const row = upsertRows(mockServiceClient)[0];
    expect(row.confidence).toBeLessThanOrEqual(1);
  });

  it('is a no-op when no tags map to concept slugs', async () => {
    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['unknown-tag'], primaryPattern: null, overallScore: 7,
    });

    expect(mockServiceClient.upsert).not.toHaveBeenCalled();
    expect(mockServiceClient.in).not.toHaveBeenCalled();
  });

  it('calls invalidateCache after updating', async () => {
    mockServiceClient = createChainableMock([
      { concept_slug: 'trees-traversal', confidence: 0.5, evidence_count: 1, signal_history: [] },
    ]);
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    const invalidateCacheSpy = vi.spyOn(kg, 'invalidateCache');

    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['trees'], primaryPattern: null, overallScore: 7,
    });

    expect(invalidateCacheSpy).toHaveBeenCalledWith('u1');
  });

  it('does not throw when upsert fails — logs error instead', async () => {
    mockServiceClient = createChainableMock([
      { concept_slug: 'arrays-strings', confidence: 0.5, evidence_count: 1, signal_history: [] },
    ]);
    mockServiceClient.upsert = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await expect(
      kg.onInterviewSessionCompleted({
        userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 7,
      })
    ).resolves.not.toThrow();

    expect(vi.mocked(monitoringModule.logSystemEvent)).toHaveBeenCalled();
  });

  it('does not throw when the pre-read fails — logs error and skips the write', async () => {
    mockServiceClient = createChainableMock();
    mockServiceClient.in = vi.fn().mockResolvedValue({ data: null, error: { message: 'read failed' } });
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await expect(
      kg.onInterviewSessionCompleted({
        userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 7,
      })
    ).resolves.not.toThrow();

    expect(mockServiceClient.upsert).not.toHaveBeenCalled();
    expect(vi.mocked(monitoringModule.logSystemEvent)).toHaveBeenCalled();
  });

  it('handles multiple concept slugs from tags and primaryPattern', async () => {
    mockServiceClient = createChainableMock([]);
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['arrays', 'trees'], primaryPattern: 'heap', overallScore: 7,
    });

    // one batched upsert with 3 rows (arrays-strings, trees-traversal, heaps)
    expect(mockServiceClient.upsert).toHaveBeenCalledTimes(1);
    expect(upsertRows(mockServiceClient).length).toBe(3);
  });

  it('uses default confidence 0.35 for new concepts', async () => {
    mockServiceClient = createChainableMock([]); // no existing state
    vi.mocked(supabaseServiceModule.getServiceClient).mockReturnValue(mockServiceClient);

    const kg = getKnowledgeGraphService();
    await kg.onInterviewSessionCompleted({
      userId: 'u1', sessionId: 's1', problemTags: ['arrays'], primaryPattern: null, overallScore: 7,
    });

    const row = upsertRows(mockServiceClient)[0];
    // base 0.35 + delta (7/10 - 0.5) * 0.12 = 0.024 → 0.374
    expect(row.confidence).toBeCloseTo(0.374, 3);
    expect(row.evidence_count).toBe(1);
    expect(row.signal_history).toHaveLength(1);
    expect(row.signal_history[0]).toMatchObject({ type: 'interview', session_id: 's1' });
  });
});
