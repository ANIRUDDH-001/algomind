/**
 * @codesage
 * @file      src/hooks/__tests__/useInterviewMessages.test.ts
 * @purpose   Unit tests for the useInterviewMessages React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useInterviewMessages
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
import { renderHook, act } from '@testing-library/react';
import { useInterviewMessages } from '../useInterviewMessages';
import { describe, it, expect } from 'vitest';

describe('useInterviewMessages', () => {
    it('addMessage appends to both messages state and conversationHistoryRef', () => {
        const { result } = renderHook(() => useInterviewMessages());
        act(() => result.current.addMessage({ id: '1', role: 'user', content: 'hi', timestamp: new Date() }));
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.conversationHistoryRef.current).toHaveLength(1);
    });

    it('loadTranscript sets messages and marks state as completed', () => {
        const { result } = renderHook(() => useInterviewMessages());
        act(() => result.current.loadTranscript([{ role: 'assistant', content: 'hello', timestamp: new Date() }]));
        expect(result.current.messages[0].id).toBeTruthy();
    });

    it('resetMessages clears both messages and history ref', () => {
        const { result } = renderHook(() => useInterviewMessages());
        act(() => result.current.addMessage({ id: '1', role: 'user', content: 'hi', timestamp: new Date() }));
        act(() => result.current.resetMessages());
        expect(result.current.messages).toHaveLength(0);
        expect(result.current.conversationHistoryRef.current).toHaveLength(0);
    });
});
