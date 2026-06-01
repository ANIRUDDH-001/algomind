/**
 * @codesage
 * @file      src/hooks/__tests__/useLearnSession.test.ts
 * @purpose   Unit tests for the useLearnSession React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useLearnSession
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
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { useLearnSession } from '../useLearnSession';

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('useLearnSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));
    expect(result.current.state).toBe('idle');
    expect(result.current.transcript).toHaveLength(0);
  });

  it('does set state to active when startSession succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, { sessionId: 's-1', response: 'Hello from Kai' })
    );

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.state).toBe('active');
    expect(result.current.sessionId).toBe('s-1');
  });

  it('does add Kai opening message when startSession returns response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, { sessionId: 's-1', response: 'Opening prompt' })
    );

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0]?.role).toBe('assistant');
    expect(result.current.transcript[0]?.content).toBe('Opening prompt');
  });

  it('does call onSpeakMessage when Kai returns text', async () => {
    const onSpeakMessage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, { sessionId: 's-1', response: 'Kai says hi' })
    );

    const { result } = renderHook(() =>
      useLearnSession({ conceptSlug: 'arrays-strings', onSpeakMessage })
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(onSpeakMessage).toHaveBeenCalledWith('Kai says hi');
  });

  it('does set LIMIT_REACHED error when startSession returns 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(429, { error: 'limit_reached' }));

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('LIMIT_REACHED');
  });

  it('does append user and assistant messages when sendMessage succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, { sessionId: 's-1', response: 'Opening' }))
      .mockResolvedValueOnce(mockResponse(200, { response: 'Turn reply', sessionComplete: false }));

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.sendMessage('How does this work?');
    });

    expect(result.current.transcript.map((t) => t.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(result.current.transcript[1]?.content).toBe('How does this work?');
    expect(result.current.transcript[2]?.content).toBe('Turn reply');
  });

  it('does ignore sendMessage when a turn is already in flight', async () => {
    let resolveTurn: ((value: Response) => void) | null = null;
    const turnPromise = new Promise<Response>((resolve) => {
      resolveTurn = resolve;
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, { sessionId: 's-1', response: 'Opening' }))
      .mockReturnValueOnce(turnPromise);

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    act(() => {
      void result.current.sendMessage('first');
    });

    await waitFor(() => expect(result.current.kaiTyping).toBe(true));

    await act(async () => {
      await result.current.sendMessage('second');
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveTurn?.(mockResponse(200, { response: 'done', sessionComplete: false }));
      await turnPromise;
    });
  });

  it('does transition to complete when endSession succeeds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T10:00:00.000Z'));

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, { sessionId: 's-1', response: 'Opening' }))
      .mockResolvedValueOnce(
        mockResponse(200, {
          sessionId: 's-1',
          assessment: { understood: ['arrays'], struggled: ['dp'], notes: 'good', confidenceDelta: 0.1 },
        })
      );

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    vi.setSystemTime(new Date('2026-03-20T10:00:10.000Z'));

    await act(async () => {
      await result.current.endSession();
    });

    expect(result.current.state).toBe('complete');
    expect(result.current.results?.durationSeconds).toBe(10);
    expect(result.current.results?.assessment.understood).toEqual(['arrays']);
    vi.useRealTimers();
  });

  it('does call onSessionEnd when session completes from turn response', async () => {
    const onSessionEnd = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, { sessionId: 's-1', response: 'Opening' }))
      .mockResolvedValueOnce(
        mockResponse(200, {
          sessionId: 's-1',
          sessionComplete: true,
          assessment: { understood: [], struggled: [], notes: '', confidenceDelta: 0 },
        })
      );

    const { result } = renderHook(() =>
      useLearnSession({ conceptSlug: 'arrays-strings', onSessionEnd })
    );

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => expect(result.current.state).toBe('active'));

    await act(async () => {
      await result.current.sendMessage('wrap up');
    });

    await waitFor(() => expect(result.current.state).toBe('complete'));

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('does reset state and transcript when reset is called', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, { sessionId: 's-1', response: 'Opening' })
    );

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.transcript).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('does abort in-flight request when reset is called', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    let resolveTurn: ((value: Response) => void) | null = null;
    const turnPromise = new Promise<Response>((resolve) => {
      resolveTurn = resolve;
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, { sessionId: 's-1', response: 'Opening' }))
      .mockReturnValueOnce(turnPromise);

    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));

    await act(async () => {
      await result.current.startSession();
    });

    act(() => {
      void result.current.sendMessage('pending turn');
    });

    await waitFor(() => expect(result.current.kaiTyping).toBe(true));

    act(() => {
      result.current.reset();
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveTurn?.(mockResponse(200, { response: 'late', sessionComplete: false }));
      await turnPromise;
    });
  });
});