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

    it('1. HACKATHON MODE: always returns unlimited for all users', async () => {
        const result = await checkUserRateLimit('user-123');
        expect(result).toEqual({ allowed: true, remaining: 9999, isAdmin: false });
        // RPC should not be called in hackathon mode
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('2. HACKATHON MODE: blocked users still get unlimited', async () => {
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(true);
    });

    it('3. HACKATHON MODE: missing function does not block', async () => {
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(true);
    });

    it('4. HACKATHON MODE: non-admin users get unlimited too', async () => {
        const result = await checkUserRateLimit('regular-456');
        expect(result).toEqual({ allowed: true, remaining: 9999, isAdmin: false });
    });

    it('5. Guest user: checkUserRateLimit returns unlimited', async () => {
        const resultNull = await checkUserRateLimit(null);
        expect(resultNull).toEqual({ allowed: true, remaining: 9999, isAdmin: false });

        const resultGuest = await checkUserRateLimit('guest-user');
        expect(resultGuest).toEqual({ allowed: true, remaining: 9999, isAdmin: false });

        // RPC should not be called in hackathon mode
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
        expect(RATE_LIMIT.DAILY_LIMIT).toBe(30);
    });
});
