import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../complete/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import * as jose from 'jose';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/kai-context', () => ({
    invalidateStudentContext: vi.fn(),
}));
vi.mock('@/lib/startup/validateEnv', () => ({
    validateEnv: vi.fn(),
}));
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';

// Helper: build a table-aware Supabase mock so each .from(table) returns
// an independent chain that resolves to table-specific data.
function buildSupabaseMock(overrides: Record<string, any> = {}) {
    const tableData: Record<string, any> = {
        candidate_submissions: {
            selectResult: { data: { status: 'in_progress', campaign_id: 'campaign-123', assigned_problem_id: 'prob-123' }, error: null },
            updateResult: { error: null },
        },
        assessment_campaigns: {
            selectResult: { data: { created_by: 'user-123', problem_id: 'prob-123' }, error: null },
        },
        ...overrides,
    };

    const functionsInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

    return {
        from: vi.fn().mockImplementation((table: string) => {
            const td = tableData[table] || {};

            const readChain: any = {};
            readChain.select = vi.fn().mockReturnValue(readChain);
            readChain.eq = vi.fn().mockReturnValue(readChain);
            readChain.single = vi.fn().mockImplementation(() =>
                Promise.resolve(td.selectResult || { data: null, error: null })
            );

            const updateResult = td.updateResult || { error: null };
            const updateChain: any = {};
            updateChain.eq = vi.fn().mockReturnValue(updateChain);
            updateChain.select = vi.fn().mockReturnValue(updateChain);
            updateChain.single = vi.fn().mockResolvedValue(
                updateResult.error
                    ? { data: null, error: updateResult.error }
                    : { data: { id: 'sub-123', candidate_id: 'user-123' }, error: null }
            );

            return {
                select: readChain.select,
                eq: readChain.eq,
                single: readChain.single,
                update: vi.fn().mockReturnValue(updateChain),
            };
        }),
        functions: { invoke: functionsInvoke },
        _functionsInvoke: functionsInvoke, // expose for assertions
    };
}

describe('Assess Complete API (/api/assess/complete)', () => {
    let validToken: string;

    beforeEach(async () => {
        vi.resetAllMocks();

        process.env.SUPABASE_JWT_SECRET = 'test-secret-key-that-needs-to-be-long-enough-for-hs256';
        process.env.INTERNAL_API_SECRET = 'test-internal-secret';

        const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
        validToken = await new jose.SignJWT({
            submissionId: 'sub-123',
            campaignId: 'campaign-123',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(secret);
    });

    afterEach(() => {
        delete (process.env as any).SUPABASE_JWT_SECRET;
        delete (process.env as any).INTERNAL_API_SECRET;
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/assess/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    it('1. Returns 200 immediately with analysisAvailable: false (async flow)', async () => {
        const mockSupa = buildSupabaseMock();
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupa as any);
        vi.mocked(getServiceClient).mockReturnValue(mockSupa as any);

        const req = createRequest({
            sessionToken: validToken,
            questionStates: [
                { problem_id: 'prob-1', transcript: [{ speaker: 'user', text: 'hello' }], elapsed_secs: 120 }
            ],
            totalDuration: 120,
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.analysisAvailable).toBe(false);
        expect(data.message).toContain('submitted');
    });

    it('2. Marks submission as pending and invokes edge function', async () => {
        const mockSupa = buildSupabaseMock();
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupa as any);
        vi.mocked(getServiceClient).mockReturnValue(mockSupa as any);

        const req = createRequest({
            sessionToken: validToken,
            questionStates: [
                { problem_id: 'prob-1', transcript: [{ speaker: 'user', text: 'hello' }], elapsed_secs: 100 }
            ],
        });

        await POST(req);

        // Verify update was called on candidate_submissions
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_submissions');

        // Verify edge function was invoked
        expect(mockSupa._functionsInvoke).toHaveBeenCalledWith(
            'run-assessment',
            expect.objectContaining({
                body: expect.objectContaining({ submissionId: 'sub-123' }),
            })
        );

        expect(invalidateStudentContext).toHaveBeenCalledWith('user-123');
    });

    it('3. Still returns 200 if edge function invoke fails (non-fatal)', async () => {
        const mockSupa = buildSupabaseMock();
        // Make edge function invoke reject
        mockSupa._functionsInvoke.mockRejectedValue(new Error('Edge function unavailable'));
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupa as any);
        vi.mocked(getServiceClient).mockReturnValue(mockSupa as any);

        const req = createRequest({
            sessionToken: validToken,
            questionStates: [
                { problem_id: 'prob-1', transcript: [{ speaker: 'user', text: 'hello' }], elapsed_secs: 100 }
            ],
        });

        const res = await POST(req);
        const data = await res.json();

        // Should still succeed — edge function failure is non-fatal
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('4. Session already completed -> 400', async () => {
        const mockSupa = buildSupabaseMock({
            candidate_submissions: {
                selectResult: { data: { status: 'completed', campaign_id: 'campaign-123' }, error: null },
            },
        });
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupa as any);
        vi.mocked(getServiceClient).mockReturnValue(mockSupa as any);

        const req = createRequest({
            sessionToken: validToken,
            transcript: [{ speaker: 'user', text: 'hello' }],
            duration: 120,
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain('Assessment already completed');
    });

    it('5. Invalid transcript (empty) -> 400', async () => {
        const req = createRequest({
            sessionToken: validToken,
            questionStates: [],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain('missing sessionToken or questionStates');
    });

    it('6. Invalid session format -> 401', async () => {
        const req = createRequest({
            sessionToken: 'bad.jwt.format',
            questionStates: [{ transcript: [{ speaker: 'user', text: 'hello' }], elapsed_secs: 120 }],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toContain('Invalid or expired session');
    });
});
