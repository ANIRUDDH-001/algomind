import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '@/middleware';

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } })),
        },
    })),
}));

describe('assessment auth boundary contract', () => {
    it('does not redirect unauthenticated /assess requests to /login', async () => {
        const req = new NextRequest('http://localhost/assess/token-123');
        const res = await middleware(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('location')).toBeNull();
    });

    it('still redirects unauthenticated protected dashboard routes', async () => {
        const req = new NextRequest('http://localhost/dashboard');
        const res = await middleware(req);

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });
});
