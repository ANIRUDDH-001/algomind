import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../complete/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import * as jose from 'jose';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/startup/validateEnv', () => ({
    validateEnv: vi.fn(),
}));
import { getServiceClient } from '@/lib/supabase/service';

const mockAnalyze = vi.fn();
vi.mock('@/lib/assessment/analyzer', () => ({
    CognitiveAnalyzer: class {
        analyze = mockAnalyze;
    },
}));

// Helper: build a table-aware Supabase mock so each .from(table) returns
// an independent chain that resolves to table-specific data.
function buildSupabaseMock(overrides: Record<string, any> = {}) {
    const tableData: Record<string, any> = {
        candidate_submissions: {
            selectResult: { data: { status: 'in_progress', campaign_id: 'campaign-123' }, error: null },
            updateResult: { error: null },
        },
        assessment_campaigns: {
            selectResult: { data: { created_by: 'user-123', problem_id: 'prob-123' }, error: null },
        },
        problems: {
            selectResult: { data: { title: 'Two Sum', description: 'desc', difficulty: 'easy' }, error: null },
        },
        interview_sessions: {
            insertResult: { data: { id: 'session-123' }, error: null },
        },
        assessments: {
            insertResult: { data: { id: 'assessment-123' }, error: null },
        },
        ...overrides,
    };

    return {
        from: vi.fn().mockImplementation((table: string) => {
            const td = tableData[table] || {};

            // Read chain: .select().eq().single()
            const readChain: any = {};
            readChain.select = vi.fn().mockReturnValue(readChain);
            readChain.eq = vi.fn().mockReturnValue(readChain);
            readChain.single = vi.fn().mockImplementation(() =>
                Promise.resolve(td.selectResult || { data: null, error: null })
            );

            // Insert chain: .insert().select().single()
            const insertResult = td.insertResult || { data: { id: 'default-id' }, error: null };
            const insertChain: any = {};
            insertChain.select = vi.fn().mockReturnValue(insertChain);
            insertChain.single = vi.fn().mockResolvedValue(insertResult);

            // Update chain: .update().eq()
            const updateResult = td.updateResult || { error: null };
            const updateChain: any = {};
            updateChain.eq = vi.fn().mockResolvedValue(updateResult);

            return {
                select: readChain.select,
                eq: readChain.eq,
                single: readChain.single,
                insert: vi.fn().mockReturnValue(insertChain),
                update: vi.fn().mockReturnValue(updateChain),
            };
        }),
    };
}

describe('Assess Complete API (/api/assess/complete)', () => {
    let validToken: string;

    beforeEach(async () => {
        vi.resetAllMocks();

        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-that-needs-to-be-long-enough-for-hs256';
        const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY);
        validToken = await new jose.SignJWT({
            submissionId: 'sub-123',
            campaignId: 'campaign-123',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(secret);

        mockAnalyze.mockResolvedValue({
            skills: {
                problem_decomposition: { score: 80 },
                pattern_recognition: { score: 75 },
            },
            overallFeedback: 'Good job',
            nextSteps: 'Keep practicing',
        });

        vi.mocked(getServiceClient).mockReturnValue(buildSupabaseMock() as any);
    });

    afterEach(() => {
        process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/assess/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    it('1. Valid session -> saves assessment, returns report', async () => {
        const mockSupa = buildSupabaseMock();
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupa as any);
        vi.mocked(getServiceClient).mockReturnValue(mockSupa as any);

        const req = createRequest({
            sessionToken: validToken,
            transcript: [{ speaker: 'user', text: 'hello' }],
            duration: 120,
            finalCode: 'console.log("hello");',
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.overallScore).toBe(77.5); // (80 + 75) / 2
    });

    it('2. Session already completed -> 400', async () => {
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

    it('3. Invalid transcript (empty) -> 400', async () => {
        const req = createRequest({
            sessionToken: validToken,
            transcript: [],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain('Invalid transcript');
    });

    it('4. Invalid session format -> 401', async () => {
        const req = createRequest({
            sessionToken: 'bad.jwt.format',
            transcript: [{ speaker: 'user', text: 'hello' }],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toContain('Invalid or expired session');
    });
});
