import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../connect/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { fetchAndSaveLeetCodeProfile } from '@/lib/leetcode/client';
import { getRedis, redisDel } from '@/lib/upstash/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/leetcode/client');
vi.mock('@/lib/upstash/client');

describe('LeetCode Connect API (/api/leetcode/connect)', () => {
    let mockSupabase: any;
    let mockRedis: any;

    beforeEach(() => {
        vi.resetAllMocks();

        mockSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { leetcode_username: 'olduser' } }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
        };
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase);

        mockRedis = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue('OK'),
        };
        vi.mocked(getRedis).mockReturnValue(mockRedis);
        vi.mocked(redisDel).mockResolvedValue();

        vi.mocked(fetchAndSaveLeetCodeProfile).mockResolvedValue({ success: true, profile: null });
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/leetcode/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    it('1. Valid username, upsert succeeds -> 200', async () => {
        const req = createRequest({ username: 'valid_user-123' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('Profile connected');

        // Assert upsert was called with correct data
        expect(mockSupabase.upsert).toHaveBeenCalledWith(
            {
                user_id: 'user-123',
                leetcode_username: 'valid_user-123',
                leetcode_fetch_status: 'pending'
            },
            { onConflict: 'user_id' }
        );
        // Assert sync was triggered
        expect(fetchAndSaveLeetCodeProfile).toHaveBeenCalledWith('user-123', 'valid_user-123');
        // Assert Redis cooldown was set
        expect(mockRedis.set).toHaveBeenCalledWith('leetcode:refresh:user-123', '1', { ex: 3600 });
    });

    it('2. Upsert fails due to missing unique constraint (PGRST116) -> 500 "Database error"', async () => {
        mockSupabase.upsert.mockResolvedValueOnce({
            error: { code: 'PGRST116', message: 'DB Error' }
        });

        const req = createRequest({ username: 'valid_user' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Database error');
        expect(fetchAndSaveLeetCodeProfile).not.toHaveBeenCalled();
    });

    it('3. Unauthenticated -> 401', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

        const req = createRequest({ username: 'valid_user' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('4. Missing username in body -> 400', async () => {
        const req = createRequest({}); // Missing username
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Invalid username format');
        expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    describe('5. LeetCode username validation', () => {
        const invalidUsernames = [
            '', // empty string
            'ab', // too short (<3 chars)
            'this_username_is_way_too_long_for_leetcode', // too long (>25 chars)
            'special!@#chars', // special chars not allowed
            'spaces inside', // spaces not allowed
            12345, // not a string
            null, // null
        ];

        invalidUsernames.forEach((invalidUsername) => {
            it(`Rejects invalid username: ${invalidUsername}`, async () => {
                const req = createRequest({ username: invalidUsername });
                const res = await POST(req);
                const data = await res.json();

                expect(res.status).toBe(400);
                expect(data.error).toBe('Invalid username format');
                expect(mockSupabase.upsert).not.toHaveBeenCalled();
            });
        });
    });

    it('6. user_preferences row already exists -> upsert updates correctly (no duplicate)', async () => {
        // Mock that old preferences exist and upsert updates them successfully
        mockSupabase.single.mockResolvedValueOnce({ data: { leetcode_username: 'olduser' } });
        mockSupabase.upsert.mockResolvedValueOnce({ error: null });

        const req = createRequest({ username: 'newuser' });
        const res = await POST(req);

        expect(res.status).toBe(200);

        // Assert upsert was called which handles existing rows via onConflict
        expect(mockSupabase.upsert).toHaveBeenCalledWith(
            {
                user_id: 'user-123',
                leetcode_username: 'newuser',
                leetcode_fetch_status: 'pending'
            },
            { onConflict: 'user_id' }
        );

        // Assert old cached profile is cleared
        expect(redisDel).toHaveBeenCalledWith('leetcode:profile:user-123');
        expect(redisDel).toHaveBeenCalledWith('leetcode:fetching:olduser');
    });

    it('7. Rate limit cooldown active -> 429', async () => {
        // Mock Redis telling us a cooldown exists
        mockRedis.get.mockResolvedValueOnce('1');

        const req = createRequest({ username: 'valid_user' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(429);
        expect(data.error).toContain('wait 1 hour');
        expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });
});
