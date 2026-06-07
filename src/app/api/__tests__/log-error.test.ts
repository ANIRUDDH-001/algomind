import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/log-error/route';

// Mock rate limiter
vi.mock('@/lib/rate-limit/ip-rate-limiter', () => ({
    checkIpRateLimit: vi.fn().mockResolvedValue({ success: true, allowed: true, remaining: 9 }),
}));

// Mock service client
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
            insert: vi.fn().mockResolvedValue({ error: null }),
        }),
    }),
}));

// Mock server supabase (no session by default)
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn().mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    }),
}));

// Mock getCorrelationId
vi.mock('@/lib/tracing/correlation', () => ({
    getCorrelationId: vi.fn().mockResolvedValue('test-correlation-id')
}));

import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getServiceClient } from '@/lib/supabase/service';

function makeRequest(body: Record<string, unknown>, ip = '1.2.3.4') {
    return new Request('http://localhost/api/log-error', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': ip,
        },
        body: JSON.stringify(body),
    });
}

describe('POST /api/log-error', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkIpRateLimit).mockResolvedValue({ success: true, allowed: true, remaining: 9 });
    });

    it('returns 200 for a valid error report', async () => {
        const req = makeRequest({ error_message: 'Something broke', url: '/dashboard' });
        const res = await POST(req as any);
        expect(res.status).toBe(200);
    });

    it('returns 429 when rate limit is exceeded', async () => {
        vi.mocked(checkIpRateLimit).mockResolvedValue({ success: true, allowed: false, remaining: 0 });
        const req = makeRequest({ error_message: 'flood' });
        const res = await POST(req as any);
        expect(res.status).toBe(429);
    });

    it('returns 400 when error_message is missing', async () => {
        const req = makeRequest({ url: '/some-page' });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });

    it('truncates oversized fields to their max lengths', async () => {
        const longMessage = 'x'.repeat(2000);
        const req = makeRequest({ error_message: longMessage });
        const res = await POST(req as any);
        expect(res.status).toBe(200);

        // Verify the insert was called with truncated message
        const insertMock = vi.mocked(getServiceClient)().from('system_events').insert;
        const insertCall = vi.mocked(insertMock).mock.calls[0][0] as any;
        expect(insertCall.metadata.error_message.length).toBeLessThanOrEqual(500);
    });

    it('uses a shared key for unknown IPs', async () => {
        const req = new Request('http://localhost/api/log-error', {
            method: 'POST',
            // No x-forwarded-for or x-real-ip headers
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error_message: 'test' }),
        });

        await POST(req as any);

        expect(checkIpRateLimit).toHaveBeenCalledWith(
            'log-error:unknown-ip',
            expect.objectContaining({ maxRequests: 5 })
        );
    });

    it('returns 400 for invalid JSON', async () => {
        const req = new Request('http://localhost/api/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
            body: 'not-json{{{',
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });
});
