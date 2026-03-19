/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useLearnSession } from '../useLearnSession';

vi.stubGlobal('fetch', vi.fn());

describe('useLearnSession', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useLearnSession({ conceptSlug: 'arrays-strings' }));
    expect(result.current.state).toBe('idle');
    expect(result.current.transcript).toHaveLength(0);
  });

  it('transitions to starting on startSession()', async () => {});
  it('transitions to active after successful start', async () => {});
  it('adds Kai opening message to transcript', async () => {});
  it('calls onSpeakMessage with Kai response', async () => {});
  it('handles 429 limit_reached error', async () => {});
  it('adds user message to transcript on sendMessage()', async () => {});
  it('prevents sending when kaiTyping is true', async () => {});
  it('transitions to complete on endSession()', async () => {});
  it('calls onSessionEnd with results', async () => {});
  it('resets all state on reset()', async () => {});
  it('aborts in-flight request on reset()', async () => {});
});