import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/assess/verify-code/route';
import * as routeFile from '@/app/api/assess/verify-code/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(() => ({
        rpc: vi.fn().mockImplementation((fnName, args) => {
            if (fnName === 'record_code_attempt') {
                return Promise.resolve({ error: null });
            }
            if (fnName === 'check_code_rate_limit') {
                // If ip is 'blocked-ip', simulate rate-limited
                if (args.p_identifier === 'blocked-ip') {
                    return Promise.resolve({ data: { allowed: false, remaining: 0 }, error: null });
                }
                return Promise.resolve({ data: { allowed: true, remaining: 5 }, error: null });
            }
            if (fnName === 'verify_campaign_entry_code') {
                return Promise.resolve({ data: [{ valid: true }], error: null });
            }
            return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => ({
                        data: { id: 'test-campaign', title: 'Test', is_active: true }
                    })),
                    maybeSingle: vi.fn(() => ({
                        data: { id: 'test-campaign', title: 'Test', is_active: true }
                    }))
                }))
            }))
        }))
    }))
}));

describe('verify-code API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (body: any, ip: string = '127.0.0.1') => {
        const req = new Request('http://localhost:3000/api/assess/verify-code', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers({
                'x-forwarded-for': ip,
                'content-type': 'application/json'
            })
        });
        // Override json() to simulate how Next.js processes bodies
        req.json = Object.assign(vi.fn().mockResolvedValue(body), req.json);
        return req;
    };

    it('rejects invalid code formats immediately via regex', async () => {
        // Bad format
        const req = createRequest({ entryCode: 'INVALID-CODE', publicToken: 'tok', candidateName: 'John', candidateEmail: 'john@doe.com' });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.reason).toMatch(/Invalid entry code format/i);
    });

    it('blocks rate-limited IPs', async () => {
        const req = createRequest({ entryCode: 'ABC-123-XYZ', publicToken: 'tok', candidateName: 'John Smith', candidateEmail: 'john@doe.com' }, 'blocked-ip');
        const res = await POST(req);
        expect(res.status).toBe(429);
        const data = await res.json();
        expect(data.reason).toMatch(/Too many attempts/i);
    });

    it('accepts correctly formatted codes if not rate limited', async () => {
        // Valid format according to our regex: ^[A-HJ-NP-Z]{3}-[2-9]{3}-[A-HJ-NP-Z]{3}$
        const req = createRequest({ entryCode: 'ABC-345-XYZ', publicToken: 'tok', candidateName: 'John Smith', candidateEmail: 'john@doe.com' }, 'clean-ip');
        const res = await POST(req);

        // As long as it doesn't return 400 or 429, the regex and rate limit passed
        expect(res.status).toBe(200);
    });
});
