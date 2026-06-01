/**
 * @codesage
 * @file      src/hooks/__tests__/useConceptHeatmap.test.ts
 * @purpose   Unit tests for the useConceptHeatmap React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useConceptHeatmap
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConceptHeatmap } from '../useConceptHeatmap';

const mockConcepts = [
  { slug: 'arrays-strings', displayName: 'Arrays', confidence: 0.7, level: 'solid', evidenceCount: 5, icon: '[]', lastSessionType: null, lastSignalAt: null },
  { slug: 'dynamic-programming', displayName: 'DP', confidence: 0.2, level: 'weak', evidenceCount: 2, icon: 'dp', lastSessionType: 'interview', lastSignalAt: null },
];

describe('useConceptHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('does start in loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { result } = renderHook(() => useConceptHeatmap());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.concepts).toHaveLength(0);
  });

  it('does load concepts from API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ concepts: mockConcepts }) })
    );

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.concepts).toHaveLength(2);
  });

  it('does set error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.error).toBe('Network error'));
  });

  it('does compute weakest and strongest concepts from evidence data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ concepts: mockConcepts }) })
    );

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.weakestConcept?.slug).toBe('dynamic-programming');
    expect(result.current.strongestConcept?.slug).toBe('arrays-strings');
  });

  it('does infer diagnostic false when API false and no evidence', async () => {
    const noEvidence = mockConcepts.map((c) => ({ ...c, evidenceCount: 0 }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ concepts: noEvidence, hasCompletedDiagnostic: false }),
      })
    );

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasCompletedDiagnostic).toBe(false);
  });

  it('does infer diagnostic true when API says true', async () => {
    const noEvidence = mockConcepts.map((c) => ({ ...c, evidenceCount: 0 }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ concepts: noEvidence, hasCompletedDiagnostic: true }),
      })
    );

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasCompletedDiagnostic).toBe(true);
  });

  it('does refetch when refresh is called', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ concepts: mockConcepts }) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useConceptHeatmap());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does auto-refresh on interval when enabled', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ concepts: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useConceptHeatmap({ autoRefresh: true, refreshIntervalMs: 5000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
