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

describe('middleware minimal responsibility', () => {
    it('does not enforce employer feature-tier gating for /api/employer routes', async () => {
        const previous = process.env.ENABLE_EMPLOYER_TIER;
        process.env.ENABLE_EMPLOYER_TIER = 'false';

        try {
            const req = new NextRequest('http://localhost/api/employer/campaigns');
            const res = await middleware(req);

            // Middleware should now be neutral here and let route-level guards decide.
            expect(res.status).toBe(200);
        } finally {
            process.env.ENABLE_EMPLOYER_TIER = previous;
        }
    });

    it('does not enforce test-page blocking in non-development env', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        try {
            const req = new NextRequest('http://localhost/test');
            const res = await middleware(req);

            expect(res.status).toBe(200);
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
