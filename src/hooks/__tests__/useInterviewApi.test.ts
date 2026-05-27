/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useInterviewApi } from '../useInterviewApi';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn().mockReturnValue({
        channel: vi.fn().mockReturnValue({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn((cb) => {
                cb('SUBSCRIBED');
                return { unsubscribe: vi.fn() };
            }),
        }),
        removeChannel: vi.fn(),
    }),
}));

describe('useInterviewApi', () => {
    const mockOptions = {
        conversationHistoryRef: { current: [] },
        currentProblemRef: { current: null },
        stateMachineRef: { current: { getState: () => 'idle' } } as any,
        optionsRef: { current: { apiEndpoint: '/api/chat', config: {} } } as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetchWithRetry retries on 5xx and succeeds on 3rd attempt', async () => {
        let calls = 0;
        global.fetch = vi.fn().mockImplementation(() => {
            calls++;
            if (calls < 3) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ response: 'ok' }) });
        });
        const { result } = renderHook(() => useInterviewApi(mockOptions as any));
        const res = await result.current.fetchWithRetry('/api/chat', { method: 'POST' }, 3, 0);
        expect(calls).toBe(3);
        expect(res.response).toBe('ok');
    });

    it('callChatApi falls back to JSON path for non-main endpoints', async () => {
        const customOptions = { ...mockOptions, optionsRef: { current: { apiEndpoint: '/api/assess/chat', config: {} } } };
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ response: 'chat response' }) });
        const { result } = renderHook(() => useInterviewApi(customOptions as any));
        
        const res = await result.current.callChatApi('hello', 'system prompt', {} as any);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(res).toBe('chat response');
    });
});
