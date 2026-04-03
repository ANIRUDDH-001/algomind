import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';
import { getServiceClient } from '@/lib/supabase/service';

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

describe('POST /api/log-error', () => {
    const mockInsert = vi.fn();
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));

    beforeEach(() => {
        vi.clearAllMocks();
        mockInsert.mockResolvedValue({ error: null });
        vi.mocked(getServiceClient).mockReturnValue({ from: mockFrom } as never);
    });

    it('writes client_error event with canonical type field', async () => {
        const req = new Request('http://localhost/api/log-error', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                error_message: 'boom',
                error_stack: 'stack',
                component_stack: 'component stack',
                url: '/foo',
                user_agent: 'jest',
                severity: 'error',
            }),
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true });
        expect(mockFrom).toHaveBeenCalledWith('system_events');
        expect(mockInsert).toHaveBeenCalledTimes(1);

        const payload = mockInsert.mock.calls[0][0];
        expect(payload.type).toBe('client_error');
        expect(payload.event_type).toBeUndefined();
        expect(payload.metadata.error_message).toBe('boom');
    });

    it('rejects payload without error_message', async () => {
        const req = new Request('http://localhost/api/log-error', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ severity: 'error' }),
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe('error_message required');
        expect(mockInsert).not.toHaveBeenCalled();
    });
});
