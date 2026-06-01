/**
 * @codesage
 * @file      src/app/api/assess/__tests__/start.test.ts
 * @purpose   Tests the candidate assessment start endpoint, including token validation and session initialization.
 * @tech      Vitest, Next.js, jose, TypeScript
 * @connects  ../start/route, @/lib/supabase/server
 * @apis      none
 * @db        assessment_campaigns, problems, candidate_submissions (mocked)
 * @state     none
 * @env       SUPABASE_JWT_SECRET (mocked)
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../start/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { NextRequest } from 'next/server';
import * as jose from 'jose';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/startup/validateEnv', () => ({
    validateEnv: vi.fn(),
}));

describe('Assess Start API (/api/assess/start)', () => {
    let mockSupabase: any;
    const mockDate = new Date('2026-02-21T12:00:00Z').getTime();

    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);

        // Required environment variable for JWT
        process.env.SUPABASE_JWT_SECRET = 'test-secret-key-that-needs-to-be-long-enough-for-hs256';

        mockSupabase = {
            rpc: vi.fn().mockResolvedValue({
                data: [{ id: 'campaign-123', problem_id: 'prob-123', time_limit_mins: 45 }],
                error: null
            }),
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'prob-123', title: 'Two Sum' }, error: null }),
            insert: vi.fn().mockReturnThis(),
        };

        // Setup select -> in -> mock problems
        const mockProblemsData = [{ id: 'prob-123', title: 'Two Sum', description: 'desc', difficulty: 'easy' }];

        mockSupabase.in = vi.fn().mockReturnValue(mockProblemsData);

        mockSupabase.select.mockImplementation(() => {
            return {
                eq: mockSupabase.eq,
                single: mockSupabase.single,
                in: vi.fn().mockResolvedValue({ data: mockProblemsData, error: null })
            }
        });

        // Setup insert to chain to select -> single
        mockSupabase.insert.mockImplementation(() => {
            return {
                select: () => ({
                    single: vi.fn().mockResolvedValue({ data: { id: 'sub-123' }, error: null })
                })
            };
        });

        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase);
        vi.mocked(getServiceClient).mockReturnValue(mockSupabase);
    });

    afterEach(() => {
        vi.useRealTimers();
        delete (process.env as any).SUPABASE_JWT_SECRET;
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    it('1. Valid campaign token -> 200 with session info', async () => {
        const req = createRequest({
            campaignToken: 'valid-token',
            candidateName: 'John Doe',
            candidateEmail: 'john@example.com'
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toHaveProperty('sessionToken');
        expect(data.questions[0]).toEqual({ id: 'prob-123', title: 'Two Sum', description: 'desc', difficulty: 'easy' });
        expect(data.submissionId).toBe('sub-123');

        // Verify the JWT was signed correctly
        const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
        const { payload } = await jose.jwtVerify(data.sessionToken, secret);
        expect(payload.submissionId).toBe('sub-123');
        expect(payload.campaignId).toBe('campaign-123');
    });

    it('2. claim_campaign_slot returns empty (slot full) -> 403 "link has reached its maximum uses"', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

        const req = createRequest({ campaignToken: 'full-token', candidateName: 'John Doe' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toContain('maximum number of uses');
    });

    it('3. claim_campaign_slot RPC missing/errors -> 403 (verify this gives a clear error, not crash)', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Could not find the function "claim_campaign_slot"' }
        });

        const req = createRequest({ campaignToken: 'missing-rpc-token', candidateName: 'John Doe' });
        const res = await POST(req);
        const data = await res.json();

        // The route treats RPC error the same as "slot full"
        expect(res.status).toBe(403);
        expect(data.error).toContain('maximum number of uses');
    });

    // 4. Expired campaign -> 403. Handled by claim_campaign_slot returning empty/null,
    // which triggers the same logic as "slot full"
    it('4. Expired campaign -> 403', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

        const req = createRequest({ campaignToken: 'expired-token', candidateName: 'John Doe' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toContain('maximum number of uses');
    });

    it('5. Invalid token format -> 400', async () => {
        const req = createRequest({ candidateName: 'John Doe' }); // Missing token
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain('campaignToken and candidateName are required');
    });
});
