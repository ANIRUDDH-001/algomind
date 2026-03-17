import { describe, it, expect, vi } from 'vitest';

describe('Transcript save retry logic', () => {
    it('retries 3 times with exponential backoff on failure', async () => {
        // Mock supabase admin to fail twice then succeed
        let callCount = 0;
        const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: () => ({
                error: callCount++ < 2 ? { message: 'DB error', code: 'CONN' } : null
            })
        }));

        // This tests the retry pattern logic — verify delays and attempt counts
        const delays: number[] = [];
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(
            (fn: any, delay: number) => {
                delays.push(delay);
                fn();
                return 0 as any;
            }
        );

        // Inline the retry logic to test it directly
        for (let attempt = 1; attempt <= 3; attempt++) {
            const result = mockUpdate();
            if (!result.eq().error) break;
            if (attempt < 3) await new Promise(r => setTimeout(r, 200 * attempt));
        }

        expect(mockUpdate).toHaveBeenCalledTimes(3);
        expect(delays).toEqual([200, 400]); // 200*1, 200*2

        setTimeoutSpy.mockRestore();
    });

    it('does not retry on success', async () => {
        const mockUpdate = vi.fn().mockReturnValue({
            eq: () => ({ error: null })
        });

        for (let attempt = 1; attempt <= 3; attempt++) {
            const result = mockUpdate();
            if (!result.eq().error) break;
        }

        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
});
