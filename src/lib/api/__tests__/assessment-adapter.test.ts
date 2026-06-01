/**
 * @codesage
 * @file      src/lib/api/__tests__/assessment-adapter.test.ts
 * @purpose   Tests for assessment API adapter
 * @tech      vitest
 * @connects  imports AssessmentAdapter from '@/lib/api/adapters/assessment-adapter'
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AssessmentAdapter } from '@/lib/api/adapters/assessment-adapter';

describe('assessment adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts verify-code payload and returns response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ valid: true, questions: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await AssessmentAdapter.verifyCode({
      publicToken: 'token',
      entryCode: 'ABC-123-XYZ',
      candidateName: 'Jane',
      candidateEmail: 'jane@example.com',
    });

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assess/verify-code',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts save-progress payload as void request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await AssessmentAdapter.saveProgress({
      sessionToken: 'session',
      questionStates: [],
      currentProblemId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assess/save-progress',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('creates campaign via typed adapter endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ campaign: { id: 'cmp_1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await AssessmentAdapter.createCampaign({
      title: 'SDE Round 1',
      campaignQuestions: [{ problem_id: 'p1', time_limit_mins: 15 }],
      defaultEasyMins: 15,
      defaultMediumMins: 25,
      defaultHardMins: 40,
      expiresAt: new Date().toISOString(),
      showScoreToCandidate: true,
    });

    expect(result.campaign).toEqual({ id: 'cmp_1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employer/campaigns',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
