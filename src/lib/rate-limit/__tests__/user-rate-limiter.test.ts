import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUserRateLimit, incrementUserUsage, RATE_LIMIT } from '../user-rate-limiter';
import * as supabaseClientModule from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(),
    isSupabaseConfigured: vi.fn(() => true)
}));

/**
 * 🚨 [SECURITY NOTE]
 * The previous rate limiter implementation had a critical silent-bypass vulnerability.
 * If the underlying Supabase RPC ('check_user_rate_limit') was missing, the DB would
 * return a PGRST202 error. Instead of failing loudly or blocking, the code would implicitly
 * return { allowed: true, remaining: 5 }, bypassing all rate limiting constraints entirely.
 * 
 * These tests strictly assert that PGRST202 boundaries map to strict { allowed: false, remaining: 0 } drops.
 */

describe('User Rate Limiter', () => {
    let mockRpc: any;

    // Build a chainable .from() mock that satisfies:
    //   supabase.from('profiles').select(...).eq(...).single()
    //   supabase.from('co_owners').select(...).eq(...).limit(...).maybeSingle()
    const buildFromMock = () => {
        const profileResult = { data: { account_type: 'candidate', rate_limit_override: null }, error: null };
        const coOwnerResult = { data: null, error: null };

        const profileChain = {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue(profileResult),
                }),
            }),
        };

        const coOwnerChain = {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue(coOwnerResult),
                    }),
                }),
            }),
        };

        return vi.fn((table: string) => {
            if (table === 'profiles') return profileChain;
            if (table === 'co_owners') return coOwnerChain;
            return profileChain;
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRpc = vi.fn();

        (supabaseClientModule.getSupabase as any).mockReturnValue({
            rpc: mockRpc,
            from: buildFromMock(),
        });
    });

    it('1. RPC returns { allowed: true, remaining: 3 } -> passed through correctly', async () => {
        mockRpc.mockResolvedValue({
            data: [{ allowed: true, remaining: 3, is_admin_user: false }],
            error: null
        });

        const result = await checkUserRateLimit('user-123');
        expect(result).toEqual({ allowed: true, remaining: 3, isAdmin: false });
        expect(mockRpc).toHaveBeenCalledWith('check_user_rate_limit', {
            p_limit: 5,
            p_user_id: 'user-123'
        });
    });

    it('2. RPC returns { allowed: false, remaining: 0 } -> correctly blocks the request', async () => {
        mockRpc.mockResolvedValue({
            data: [{ allowed: false, remaining: 0, is_admin_user: false }],
            error: null
        });

        const result = await checkUserRateLimit('user-123');
        expect(result).toEqual({ allowed: false, remaining: 0, isAdmin: false });
    });

    it('3. RPC returns PGRST202 error (missing function) -> fails securely returning { allowed: false, remaining: 0 }', async () => {
        // Mock a missing database function error
        mockRpc.mockResolvedValue({
            data: null,
            error: { code: 'PGRST202', message: 'Could not find function' }
        });

        const result = await checkUserRateLimit('user-123');

        // Assert security constraint preventing implicit bypasses
        expect(result).toEqual({ allowed: false, remaining: 0, isAdmin: false, error: true });
    });

    it('4. Admin user: bypass check -> always returns { allowed: true, isAdmin: true }', async () => {
        mockRpc.mockResolvedValue({
            data: [{ allowed: true, remaining: 999, is_admin_user: true }],
            error: null
        });

        const result = await checkUserRateLimit('admin-456');
        expect(result).toEqual({ allowed: true, remaining: 999, isAdmin: true });
    });

    it('5. Guest user: checkUserRateLimit called with null userId -> handles gracefully', async () => {
        const resultNull = await checkUserRateLimit(null);
        expect(resultNull).toEqual({ allowed: true, remaining: 999, isAdmin: false });

        const resultGuest = await checkUserRateLimit('guest-user');
        expect(resultGuest).toEqual({ allowed: true, remaining: 999, isAdmin: false });

        // RPC should not even be called for guests natively
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('6. incrementUserUsage(): calls correct RPC after session completes', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        await incrementUserUsage('user-123');

        expect(mockRpc).toHaveBeenCalledWith('record_user_question', {
            p_user_id: 'user-123'
        });
    });

    it('7. RATE_LIMIT constant exported and equals 5', () => {
        expect(RATE_LIMIT.DAILY_LIMIT).toBe(5);
    });
});
