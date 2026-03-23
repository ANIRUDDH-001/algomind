import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/user/placement-context/route';
import { createServerSupabase } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));

describe('placement-context API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (body: unknown) => {
        const req = new Request('http://localhost:3000/api/user/placement-context', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers({
                'content-type': 'application/json',
            }),
        });
        req.json = Object.assign(vi.fn().mockResolvedValue(body), req.json);
        return req;
    };

    it('rejects unauthenticated requests with 401', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
        } as any);

        const res = await POST(createRequest({ placementMonth: '2025-06-01', targetCompanies: [] }));

        expect(res.status).toBe(401);
    });

    it('saves placement_month and target_companies to user_preferences', async () => {
        const upsert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
            from: vi.fn(() => ({
                upsert,
            })),
        } as any);

        const res = await POST(createRequest({
            placementMonth: '2025-06-01',
            targetCompanies: ['Google', 'Microsoft'],
        }));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true });
        expect(upsert).toHaveBeenCalledWith({
            user_id: 'user-1',
            placement_month: '2025-06-01',
            target_companies: ['Google', 'Microsoft'],
        }, { onConflict: 'user_id' });
    });

    it('accepts empty targetCompanies array', async () => {
        const upsert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
            from: vi.fn(() => ({
                upsert,
            })),
        } as any);

        const res = await POST(createRequest({
            placementMonth: '2025-06-01',
            targetCompanies: [],
        }));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true });
    });

    it('skips save when placementMonth is empty string', async () => {
        vi.mocked(createServerSupabase).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
        } as any);

        const res = await POST(createRequest({
            placementMonth: '',
            targetCompanies: [],
        }));

        expect(res.status).toBe(400);
    });
});
