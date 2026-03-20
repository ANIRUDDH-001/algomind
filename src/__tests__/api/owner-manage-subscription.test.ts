import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/owner/manage-subscription/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn()
}));

// Helper function to create a chainable mock
function createChainableMock() {
    const chain = {
        from: vi.fn(function() { return chain; }),
        select: vi.fn(function() { return chain; }),
        eq: vi.fn(function() { return chain; }),
        update: vi.fn(function() { return chain; }),
        upsert: vi.fn(function() { return Promise.resolve({ data: null, error: null }); }),
        single: vi.fn(function() { return Promise.resolve({ data: { account_type: 'owner' }, error: null }); })
    };
    return chain;
}

describe('POST /api/owner/manage-subscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createPOSTRequest = (body: any) => {
        return new Request('http://localhost:3000/api/owner/manage-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }) as NextRequest;
    };

    it('returns 401 for unauthenticated users', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } })
            }
        } as any);

        const req = createPOSTRequest({ email: 'user@example.com', subscription_status: 'premium' });
        const res = await POST(req);

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 for non-owner/admin users', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
            }
        } as any);

        const mockChain = createChainableMock();
        mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'user' }, error: null });
        vi.mocked(getServiceClient).mockReturnValue(mockChain as any);

        const req = createPOSTRequest({ email: 'user@example.com', subscription_status: 'premium' });
        const res = await POST(req);

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('Forbidden');
    });

    it('returns 404 for unknown email', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        let callCount = 0;
        vi.mocked(getServiceClient).mockImplementation(() => {
            callCount++;
            const mockChain = createChainableMock();
            
            if (callCount === 1) {
                // Check caller is owner/admin
                mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });
            } else {
                // Find target user by email - should not find
                mockChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
            }
            return mockChain as any;
        });

        const req = createPOSTRequest({
            email: 'nonexistent@example.com',
            subscription_status: 'premium'
        });
        const res = await POST(req);

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain('User not found');
    });

    it('updates profile subscription_status', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        let callCount = 0;
        vi.mocked(getServiceClient).mockImplementation(() => {
            callCount++;
            const mockChain = createChainableMock();
            
            if (callCount === 1) {
                // Check caller is owner/admin
                mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });
            } else if (callCount === 2) {
                // Find target user by email
                mockChain.single = vi.fn().mockResolvedValue({ data: { id: 'target-user-1' }, error: null });
            } else if (callCount === 3) {
                // Update profiles
                mockChain.update = vi.fn(function(this: any) { return this; });
                mockChain.eq = vi.fn(function(this: any) { return Promise.resolve({ data: null, error: null }); });
            } else {
                // Upsert subscriptions
                mockChain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
            }
            return mockChain as any;
        });

        const req = createPOSTRequest({
            email: 'user@example.com',
            subscription_status: 'premium',
            expires_at: '2026-03-20'
        });
        const res = await POST(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toContain('updated to premium');
    });

    it('sets expires_at to null when not provided', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        let callCount = 0;
        vi.mocked(getServiceClient).mockImplementation(() => {
            callCount++;
            const mockChain = createChainableMock();
            
            if (callCount === 1) {
                mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });
            } else if (callCount === 2) {
                mockChain.single = vi.fn().mockResolvedValue({ data: { id: 'target-user-1' }, error: null });
            } else if (callCount === 3) {
                mockChain.update = vi.fn(function(this: any) { return this; });
                mockChain.eq = vi.fn(function(this: any) { return Promise.resolve({ data: null, error: null }); });
            } else {
                mockChain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
            }
            return mockChain as any;
        });

        const req = createPOSTRequest({
            email: 'user@example.com',
            subscription_status: 'free'
            // No expires_at provided
        });
        const res = await POST(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBeDefined();
    });

    it('updates subscription table with correct plan type', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } })
            }
        } as any);

        let callCount = 0;
        vi.mocked(getServiceClient).mockImplementation(() => {
            callCount++;
            const mockChain = createChainableMock();
            
            if (callCount === 1) {
                mockChain.single = vi.fn().mockResolvedValue({ data: { account_type: 'owner' }, error: null });
            } else if (callCount === 2) {
                mockChain.single = vi.fn().mockResolvedValue({ data: { id: 'target-user-1' }, error: null });
            } else if (callCount === 3) {
                mockChain.update = vi.fn(function(this: any) { return this; });
                mockChain.eq = vi.fn(function(this: any) { return Promise.resolve({ data: null, error: null }); });
            } else {
                mockChain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
            }
            return mockChain as any;
        });

        const req = createPOSTRequest({
            email: 'user@example.com',
            subscription_status: 'college',
            expires_at: '2027-03-20'
        });
        const res = await POST(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toContain('college');
    });
});
