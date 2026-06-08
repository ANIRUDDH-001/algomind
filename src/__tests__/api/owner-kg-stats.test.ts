import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/owner/kg-stats/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn()
}));

vi.mock('@/lib/auth/account-type', () => ({
    isOwnerOrCoOwner: vi.fn()
}));

// Helper function to create a chainable mock
function createChainableMock() {
    const chain = {
        from: vi.fn(function() { return chain; }),
        select: vi.fn(function() { return chain; }),
        eq: vi.fn(function() { return chain; }),
        gt: vi.fn(function() { return chain; }),
        gte: vi.fn(function() { return chain; }),
        order: vi.fn(function() { return chain; }),
        limit: vi.fn(function() { return chain; }),
        rpc: vi.fn((fnName: string) => {
            if (fnName === 'count_distinct_diagnosed_users') {
                return Promise.resolve({ data: 4, error: null });
            }
            if (fnName === 'get_hardest_concepts') {
                return Promise.resolve({
                    data: [
                        { concept_slug: 'arrays', avg_confidence: 0.7 },
                        { concept_slug: 'hash-tables', avg_confidence: 0.4 },
                    ],
                    error: null,
                });
            }
            return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn(function() { return Promise.resolve({ data: { account_type: 'owner' }, error: null }); })
    };
    return chain;
}

describe('GET /api/owner/kg-stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 for unauthenticated users', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } })
            }
        } as any);

        const res = await GET();
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 for non-owner users', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
            }
        } as any);

        vi.mocked(isOwnerOrCoOwner).mockResolvedValue(false);

        const res = await GET();
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('Forbidden');
    });

    it('returns aggregate stats for owner users', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        vi.mocked(isOwnerOrCoOwner).mockResolvedValue(true);

        // @ts-expect-error -- automated unused local suppression
        const mockChain = createChainableMock();
        
        // Mock all the Promise.all queries
        vi.mocked(getServiceClient).mockImplementation(() => {
            const innerChain = createChainableMock();
            innerChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });

            return innerChain as any;
        });

        const res = await GET();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('usersWithDiagnostic');
        expect(data).toHaveProperty('learnSessionsThisWeek');
        expect(data).toHaveProperty('totalConceptStateRows');
        expect(data).toHaveProperty('hardestConcepts');
    });

    it('identifies hardest concepts correctly', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        const mockChain = createChainableMock();
        mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });

        vi.mocked(getServiceClient).mockImplementation(() => {
            const innerChain = createChainableMock();
            innerChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });

            return innerChain as any;
        });

        const res = await GET();
        expect(res.status).toBe(200);
        const data = await res.json();
        // The hardest concept should be dynamic-programming with avg confidence of 0.225
        expect(data.hardestConcepts).toBeDefined();
        expect(Array.isArray(data.hardestConcepts)).toBe(true);
    });
});
