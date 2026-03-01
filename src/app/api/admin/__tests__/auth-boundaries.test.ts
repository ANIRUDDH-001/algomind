/**
 * Auth Boundary Tests for Admin API Routes
 * 
 * Verifies that every admin endpoint enforces authentication
 * and admin-level authorization correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ── Mocks ──
vi.mock('@/lib/auth/requireAdminForApi');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: vi.fn() }));
vi.mock('@/lib/ai/model-registry', () => ({
    invalidateModelCache: vi.fn(),
    markModelDeprecated: vi.fn(),
}));
vi.mock('@/lib/ai/rate-limiter', () => ({
    getRateLimiter: () => ({ resetModel: vi.fn() }),
}));

import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';

// Route handlers
import { GET as getAdmins, POST as postAdmins, DELETE as deleteAdmins } from '../admins/route';
import { GET as getHealth } from '../health/route';
import { GET as getModels } from '../models/route';
// import { GET as getUsers } from '../users/route';
import { POST as postResetModel } from '../reset-model/route';
import { GET as getEvents } from '../events/route';

// ── Helpers ──
function mockUnauth() {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    vi.mocked(requireAdminForApi).mockResolvedValue({ user: null, errorResponse: res });
}

function mockNonAdmin() {
    const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    vi.mocked(requireAdminForApi).mockResolvedValue({ user: null, errorResponse: res });
}

function makeRequest(url: string, method = 'GET', body?: Record<string, unknown>) {
    const opts: RequestInit = { method };
    if (body) opts.body = JSON.stringify(body);
    return new Request(`http://localhost:3000${url}`, opts);
}

function mockSupabaseForResetModel(isUser: boolean, isAdmin: boolean) {
    const mockSb = {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: isUser ? { id: 'u1', email: 'user@test.com' } : null },
                error: null,
            }),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: isAdmin ? { id: '1' } : null,
                        error: isAdmin ? null : { code: 'PGRST116' },
                    }),
                }),
            }),
        }),
    };
    vi.mocked(createServerSupabase).mockResolvedValue(mockSb as any);
}

// ── Supabase service mock ──
let mockSvcClient: any;

beforeEach(() => {
    vi.resetAllMocks();
    mockSvcClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSvcClient as any);
    vi.mocked(createServerSupabase).mockResolvedValue(mockSvcClient as any);
});

// ═══════════════════════════════════════════════
//  Section 1: Unauthenticated Access → 401
// ═══════════════════════════════════════════════
describe('Unauthenticated access → 401', () => {
    beforeEach(() => mockUnauth());

    it('GET /api/admin/admins → 401', async () => {
        const res = await getAdmins();
        expect(res.status).toBe(401);
    });

    it('POST /api/admin/admins → 401', async () => {
        const req = makeRequest('/api/admin/admins', 'POST', { email: 'x@y.com' });
        const res = await postAdmins(req);
        expect(res.status).toBe(401);
    });

    it('DELETE /api/admin/admins → 401', async () => {
        const req = makeRequest('/api/admin/admins', 'DELETE', { email: 'x@y.com' });
        const res = await deleteAdmins(req);
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/health → 401', async () => {
        const res = await getHealth();
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/models → 401', async () => {
        const res = await getModels();
        expect(res.status).toBe(401);
    });

    /* it('GET /api/admin/users → 401', async () => {
        const req = makeRequest('/api/admin/users');
        const res = await getUsers(req);
        expect(res.status).toBe(401);
    }); */

    it('POST /api/admin/reset-model → 401 (no session)', async () => {
        mockSupabaseForResetModel(false, false);
        const req = makeRequest('/api/admin/reset-model', 'POST', { modelId: 'gpt-4' });
        const res = await postResetModel(req as any);
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/events → 401', async () => {
        const req = makeRequest('/api/admin/events');
        const res = await getEvents(req);
        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════
//  Section 2: Authenticated but Not Admin → 403
// ═══════════════════════════════════════════════
describe('Authenticated non-admin → 403', () => {
    beforeEach(() => mockNonAdmin());

    it('GET /api/admin/admins → 403', async () => {
        const res = await getAdmins();
        expect(res.status).toBe(403);
    });

    it('POST /api/admin/admins → 403', async () => {
        const req = makeRequest('/api/admin/admins', 'POST', { email: 'x@y.com' });
        const res = await postAdmins(req);
        expect(res.status).toBe(403);
    });

    it('DELETE /api/admin/admins → 403', async () => {
        const req = makeRequest('/api/admin/admins', 'DELETE', { email: 'x@y.com' });
        const res = await deleteAdmins(req);
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/health → 403', async () => {
        const res = await getHealth();
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/models → 403', async () => {
        const res = await getModels();
        expect(res.status).toBe(403);
    });

    /* it('GET /api/admin/users → 403', async () => {
        const req = makeRequest('/api/admin/users');
        const res = await getUsers(req);
        expect(res.status).toBe(403);
    }); */

    it('POST /api/admin/reset-model → 403 (user but not admin)', async () => {
        mockSupabaseForResetModel(true, false);
        const req = makeRequest('/api/admin/reset-model', 'POST', { modelId: 'gpt-4' });
        const res = await postResetModel(req as any);
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/events → 403', async () => {
        const req = makeRequest('/api/admin/events');
        const res = await getEvents(req);
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════
//  Section 3: Privilege Escalation Prevention
// ═══════════════════════════════════════════════
describe('Privilege escalation prevention', () => {
    it('Regular user cannot add themselves to admin_users via POST /api/admin/admins', async () => {
        mockNonAdmin();
        const req = makeRequest('/api/admin/admins', 'POST', { email: 'attacker@evil.com' });
        const res = await postAdmins(req);
        expect(res.status).toBe(403);
        // Ensure the service client was NOT called (guard short-circuited)
        expect(mockSvcClient.from).not.toHaveBeenCalled();
    });

    it('Regular user cannot read admin_users list via GET /api/admin/admins', async () => {
        mockNonAdmin();
        const res = await getAdmins();
        expect(res.status).toBe(403);
        expect(mockSvcClient.from).not.toHaveBeenCalled();
    });
});
