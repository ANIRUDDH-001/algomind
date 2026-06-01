/**
 * @codesage
 * @file      src/lib/rate-limit/__tests__/user-rate-limiter.test.ts
 * @purpose   Tests for Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUserRateLimit, incrementUserUsage, RATE_LIMIT } from '../user-rate-limiter';
import * as supabaseClientModule from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(),
    isSupabaseConfigured: vi.fn(() => true)
}));

vi.mock('@/app/actions/co-owner', () => ({
    checkCoOwnerStatus: vi.fn()
}));

import { checkCoOwnerStatus } from '@/app/actions/co-owner';

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
        
        (checkCoOwnerStatus as any).mockResolvedValue({ success: true, data: { isCoOwner: false } });
    });

    it('1. allows user below daily limit', async () => {
        mockRpc.mockResolvedValue({ data: [{ allowed: true, remaining: 8, is_admin_user: false }], error: null });
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(8);
    });

    it('2. blocks user at daily limit', async () => {
        mockRpc.mockResolvedValue({ data: [{ allowed: false, remaining: 0, is_admin_user: false }], error: null });
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('3. allows owner regardless of count', async () => {
        const buildOwnerFromMock = () => {
            const profileChain = {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { account_type: 'owner', rate_limit_override: null }, error: null }),
                    }),
                }),
            };
            return vi.fn((table: string) => {
                if (table === 'profiles') return profileChain;
                return profileChain;
            });
        };
        (supabaseClientModule.getSupabase as any).mockReturnValue({
            rpc: mockRpc,
            from: buildOwnerFromMock(),
        });
        const result = await checkUserRateLimit('owner-123');
        expect(result.allowed).toBe(true);
        expect(result.isAdmin).toBe(true);
    });

    it('4. allows co-owner regardless of count', async () => {
        (checkCoOwnerStatus as any).mockResolvedValue({ success: true, data: { isCoOwner: true } });
        const result = await checkUserRateLimit('co-owner-123');
        expect(result.allowed).toBe(true);
        expect(result.isAdmin).toBe(true);
    });

    it('5. fails CLOSED when RPC is missing (PGRST202)', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Function not found' } });
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(false);
        expect(result.error).toBe(true);
    });

    it('6. fails CLOSED when DB is unreachable', async () => {
        mockRpc.mockRejectedValue(new Error('Network error'));
        const result = await checkUserRateLimit('user-123');
        expect(result.allowed).toBe(false);
        expect(result.error).toBe(true);
    });

    it('7. guest user (null userId or guest-user) is always allowed', async () => {
        const resultNull = await checkUserRateLimit(null);
        expect(resultNull.allowed).toBe(true);

        const resultGuest = await checkUserRateLimit('guest-user');
        expect(resultGuest.allowed).toBe(true);

        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('6. incrementUserUsage(): calls correct RPC after session completes', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        await incrementUserUsage('user-123');

        expect(mockRpc).toHaveBeenCalledWith('record_user_question', {
            p_user_id: 'user-123'
        });
    });

    it('9. RATE_LIMIT constant exported and equals 10', () => {
        expect(RATE_LIMIT.DAILY_LIMIT).toBe(10);
    });
});
