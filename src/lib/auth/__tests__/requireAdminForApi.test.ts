import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminForApi } from '../requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import {  } from 'next/server';

// Mock Supabase server
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

// Mock Next.js NextResponse
vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((data, init) => ({
            json: async () => data,
            status: init?.status || 200
        }))
    }
}));

describe('requireAdminForApi', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            auth: {
                getUser: vi.fn()
            },
            rpc: vi.fn()
        };

        (createServerSupabase as any).mockResolvedValue(mockSupabase);
    });

    it('1. Valid admin user: auth.getUser() returns user + check_is_admin RPC returns true', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'admin-123', email: 'admin@example.com' } },
            error: null
        });
        mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

        const result = await requireAdminForApi();

        expect(result.user).toEqual({ id: 'admin-123', email: 'admin@example.com' });
        expect(result.errorResponse).toBeNull();
    });

    it('2. Not logged in: auth.getUser() returns null', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null
        });

        const result = await requireAdminForApi();

        expect(result.user).toBeNull();
        expect(result.errorResponse?.status).toBe(401);

        const errorData = await (result.errorResponse as any).json();
        expect(errorData.error).toBe('Unauthorized');
    });

    it('3. Logged in but not admin: check_is_admin returns false', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123', email: 'user@example.com' } },
            error: null
        });
        mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

        const result = await requireAdminForApi();

        expect(result.user).toBeNull();
        expect(result.errorResponse?.status).toBe(403);

        const errorData = await (result.errorResponse as any).json();
        expect(errorData.error).toBe('Forbidden');
    });

    it('4. check_is_admin RPC missing (PGRST202 error)', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123', email: 'user@example.com' } },
            error: null
        });
        // PGRST202 is missing function
        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST202', message: 'Function not found' }
        });

        const result = await requireAdminForApi();

        expect(result.user).toBeNull();
        expect(result.errorResponse?.status).toBe(403);
    });

    it('5. DB connection failure during auth', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Database connecting error', status: 500 }
        });

        const result = await requireAdminForApi();

        expect(result.user).toBeNull();
        // The implementation returns 401 if error || !user
        expect(result.errorResponse?.status).toBe(401);
    });

    it('6. User has email but check_is_admin returns false -> 403, not 401', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-456', email: 'test@example.com' } },
            error: null
        });
        mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

        const result = await requireAdminForApi();

        expect(result.user).toBeNull();
        expect(result.errorResponse?.status).toBe(403);
    });
});
