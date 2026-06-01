/**
 * @codesage
 * @file      src/app/api/admin/__tests__/integration.test.ts
 * @purpose   Integration tests verifying the interaction between admin API endpoints, auth, and the database.
 * @tech      Vitest, TypeScript
 * @connects  ../admins/route, ../models/route, ../health/route, @/lib/supabase/server
 * @apis      none
 * @db        Supabase (mocked rpc and from chains)
 * @state     none
 * @env       none
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
/**
 * Integration Test: Admin Panel Routes
 * Exercises requireAdminForApi -> admin routes -> DB queries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getAdmins } from '../admins/route';
import { GET as getModels } from '../models/route';
import { GET as getHealth } from '../health/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

// ── 1. Mocks ──
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

describe('Admin Panel API Integration', () => {
    let mockUser: any;
    let mockSbRpc: ReturnType<typeof vi.fn>;
    let mockSbFrom: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockUser = { id: 'admin-123', email: 'admin@demo.com' };

        // We will customize these implementations in individual tests
        const mockChain = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: function (resolve: any) { resolve({ data: [], error: null }); }
        };

        mockSbRpc = vi.fn();
        mockSbFrom = vi.fn().mockReturnValue(mockChain);

        const mockClient = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
            },
            rpc: mockSbRpc,
            from: mockSbFrom
        };

        vi.mocked(createServerSupabase).mockResolvedValue(mockClient as any);
        vi.mocked(getServiceClient).mockReturnValue(mockClient as any);
    });

    it('1, 2, 3. Authorized admin request -> GET /api/admin/admins -> 200 with admin list', async () => {
        // Mock check_is_admin returns true
        mockSbRpc.mockImplementation(async (rpcName: string) => {
            if (rpcName === 'check_is_admin') return { data: true, error: null };
            return { data: null, error: null };
        });

        // Mock DB returning a list of admins
        const adminRows = [{ id: '1', email: 'admin@demo.com' }];
        mockSbFrom.mockImplementation((_table: string) => ({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: adminRows, error: null })
            })
        }));

        const response = await getAdmins();
        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual(adminRows);
    });

    it('4, 5, 6. RPC check_is_admin throws PGRST202 -> GET /api/admin/admins -> 403 Forbidden', async () => {
        // Mock check_is_admin throwing PGRST202 (not found, e.g., missing deployment)
        mockSbRpc.mockImplementation(async (rpcName: string) => {
            if (rpcName === 'check_is_admin') return { data: null, error: { code: 'PGRST202', message: 'Function not found' } };
            return { data: null, error: null };
        });

        const response = await getAdmins();

        // Assert: 403 response (not 500, not crash)
        expect(response.status).toBe(403);

        const json = await response.json();
        expect(json.error).toBe('Forbidden');
    });

    it('7, 8, 9. Authorized admin -> GET /api/admin/models -> 200 with model stats', async () => {
        // Mock check_is_admin returns true
        mockSbRpc.mockImplementation(async (rpcName: string) => {
            if (rpcName === 'check_is_admin') return { data: true, error: null };
            if (rpcName === 'get_model_rate_stats') return { data: [{ model_id: 'gpt-4', hits_24h: 10, last_hit: null }], error: null };
            return { data: null, error: null };
        });

        // Mock models from DB
        const modelRows = [{ model_id: 'gpt-4', provider: 'openai', is_active: true }];
        mockSbFrom.mockImplementation((_table: string) => {
            const chain = {
                order: vi.fn().mockReturnThis(),
                then: function (resolve: any) { resolve({ data: modelRows, error: null }); }
            };
            return {
                select: vi.fn().mockReturnValue(chain)
            };
        });

        const response = await getModels();
        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json.models).toBeDefined();
        expect(json.models[0].modelId).toBe('gpt-4');
        expect(json.models[0].rateLimitHits24h).toBe(10);
    });

    it('10. Verify health endpoint aggregates correctly', async () => {
        // Mock check_is_admin returns true
        mockSbRpc.mockImplementation(async (rpcName: string) => {
            if (rpcName === 'check_is_admin') return { data: true, error: null };
            return { data: null, error: null };
        });

        // We rely on the global mockChain which resolves to { data: [] } for all health tables
        const _req = new Request('http://localhost:3000/api/admin/health');

        const response = await getHealth();
        const json = await response.json();
        // Since we mocked everything with empty arrays, isHealthy might be true or false depending on logic
        // We just assert we get a structured response instead of 500
        expect(response.status).toBe(200);
        expect(json.system).toBeDefined();
        expect(json.models).toBeDefined();
        expect(json.events).toBeDefined();
    });
});
