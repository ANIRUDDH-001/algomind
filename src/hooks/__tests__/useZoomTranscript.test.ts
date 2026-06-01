/**
 * @codesage
 * @file      src/hooks/__tests__/useZoomTranscript.test.ts
 * @purpose   Unit tests for the useZoomTranscript React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useZoomTranscript
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoomTranscript, useProgressiveReveal } from '../useZoomTranscript';

describe('useZoomTranscript', () => {
  it('shows initial message', () => {
    const { result } = renderHook(() => useZoomTranscript('Hello!'));
    expect(result.current.displayedKaiMessage).toBe('Hello!');
  });

  it('transitions to new message when kaiMessage changes', async () => {
    const { result, rerender } = renderHook(
      ({ msg }) => useZoomTranscript(msg),
      { initialProps: { msg: 'Message 1' } }
    );

    rerender({ msg: 'Message 2' });
    expect(result.current.isTransitioning).toBe(true);

    await act(async () => new Promise(r => setTimeout(r, 300)));
    expect(result.current.displayedKaiMessage).toBe('Message 2');
    expect(result.current.isTransitioning).toBe(false);
  });
});

describe('useProgressiveReveal', () => {
  it('shows all text immediately when not speaking', () => {
    const { result } = renderHook(() => useProgressiveReveal('one two three', false));
    expect(result.current).toBe('one two three');
  });

  it('reveals words progressively when speaking', async () => {
    const { result } = renderHook(() => useProgressiveReveal('one two three four', true));
    // Initially shows 0 words
    expect(result.current).toBe('');

    // After some time, reveals words
    await act(async () => new Promise(r => setTimeout(r, 400)));
    expect(result.current.split(' ').length).toBeGreaterThan(0);
  });
});
