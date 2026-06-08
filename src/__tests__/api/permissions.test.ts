import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/owner/rate-limits/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

vi.mock('@/lib/auth/account-type', () => ({
    isOwnerOrCoOwner: vi.fn()
}));

describe('owner/rate-limits API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createGETRequest = () => {
        return new Request('http://localhost:3000/api/owner/rate-limits', {
            method: 'GET'
        }) as NextRequest;
    };

    it('rejects unauthenticated users with 401 Unauthorized', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } })
            }
        } as any);

        // @ts-expect-error -- automated unused local suppression
        const req = createGETRequest();
        const res = await GET();

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('allows sys admins and returns rate limit data', async () => {
        const mockSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ identifier: '1.2.3.4', success: false, attempted_at: new Date().toISOString() }],
                error: null
            })
        };
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase as any);
        vi.mocked(isOwnerOrCoOwner).mockResolvedValue(true);

        // @ts-expect-error -- automated unused local suppression
        const req = createGETRequest();
        const res = await GET();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.attempts['1.2.3.4'].failures).toBe(1);
    });

    it('handles database errors gracefully', async () => {
        const mockSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockRejectedValue(new Error('DB failure'))
        };
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase as any);
        vi.mocked(isOwnerOrCoOwner).mockResolvedValue(true);

        // @ts-expect-error -- automated unused local suppression
        const req = createGETRequest();
        const res = await GET();

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Failed to fetch rate limits');
    });
});
