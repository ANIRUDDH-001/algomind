import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../chat/route';
import { getAIClient } from '@/lib/ai/client';
import { getRedis } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { NextRequest } from 'next/server';
import * as jose from 'jose';

vi.mock('@/lib/ai/client');
vi.mock('@/lib/upstash/client');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/startup/validateEnv', () => ({
    validateEnv: vi.fn(),
}));

describe('Assess Chat API (/api/assess/chat)', () => {
    let mockAIClient: any;
    let mockRedis: any;
    let mockSupabaseAdmin: any;
    let validToken: string;
    let submissionStatus: string;
    let submissionAnalysisStatus: string | null;

    beforeEach(async () => {
        vi.resetAllMocks();

        process.env.SUPABASE_JWT_SECRET = 'test-secret-key-that-needs-to-be-long-enough-for-hs256';

        // Generate a valid mock JWT
        const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
        validToken = await new jose.SignJWT({
            submissionId: 'sub-123',
            campaignId: 'campaign-123',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600) // 1 hr from now
            .sign(secret);

        mockAIClient = {
            generateResponse: vi.fn().mockResolvedValue({
                success: true,
                response: 'This is the AI response',
                modelUsed: 'mock-model',
                provider: 'mock-provider'
            })
        };
        vi.mocked(getAIClient).mockReturnValue(mockAIClient);

        mockRedis = {
            incr: vi.fn().mockResolvedValue(1),
            expire: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue('1'),
            set: vi.fn().mockResolvedValue('OK'),
        };
        vi.mocked(getRedis).mockReturnValue(mockRedis);

        submissionStatus = 'in_progress';
        submissionAnalysisStatus = null;

        mockSupabaseAdmin = {
            from: vi.fn().mockImplementation((table: string) => {
                if (table === 'candidate_submissions') {
                    return {
                        select: vi.fn().mockImplementation((columns: string) => ({
                            eq: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue(
                                    columns === 'status, analysis_status'
                                        ? {
                                            data: { status: submissionStatus, analysis_status: submissionAnalysisStatus },
                                            error: null,
                                        }
                                        : columns === 'campaign_id'
                                            ? { data: { campaign_id: null }, error: null }
                                            : { data: { current_transcript: [] }, error: null }
                                ),
                            }),
                        })),
                        update: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ error: null }),
                        }),
                    };
                }

                if (table === 'assessment_campaigns') {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                            }),
                        }),
                    };
                }

                if (table === 'user_preferences') {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                            }),
                        }),
                    };
                }

                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                    }),
                };
            }),
        };
        vi.mocked(getServiceClient).mockReturnValue(mockSupabaseAdmin);
    });

    afterEach(() => {
        delete (process.env as any).SUPABASE_JWT_SECRET;
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/assess/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    it('1. Valid session, valid message -> streamed AI response', async () => {
        const req = createRequest({
            sessionToken: validToken,
            messages: [{ role: 'user', content: 'hello' }]
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.response).toBe('This is the AI response');
        expect(mockAIClient.generateResponse).toHaveBeenCalled();
        expect(res.headers.get('X-Messages-Used')).toBe('1');
    });

    it('2. Invalid session ID -> 401', async () => {
        const req = createRequest({
            sessionToken: 'invalid.jwt.token',
            messages: [{ role: 'user', content: 'hello' }]
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toContain('Invalid or expired session');
        expect(mockAIClient.generateResponse).not.toHaveBeenCalled();
        expect(data.retryable).toBe(false);
    });

    it('3. Empty message/Invalid format -> 400', async () => {
        const req = createRequest({
            sessionToken: validToken,
            messages: null // Invalid
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain('Invalid messages format');
    });

    it('Additional: Rate limit exceeded -> 429', async () => {
        mockRedis.incr.mockResolvedValue(32); // Exceeds limit of 30

        const req = createRequest({
            sessionToken: validToken,
            messages: [{ role: 'user', content: 'hello' }]
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(429);
        expect(data.error).toContain('Message limit reached');
        expect(data.code).toBe('message_limit_reached');
        expect(data.retryable).toBe(false);
        expect(res.headers.get('X-Messages-Used')).toBe('31');
        expect(res.headers.get('X-Messages-Limit')).toBe('30');
    });

    it('Additional: completed submission blocks chat -> 409', async () => {
        submissionStatus = 'completed';

        const req = createRequest({
            sessionToken: validToken,
            messages: [{ role: 'user', content: 'hello' }],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(409);
        expect(data.code).toBe('session_not_active');
        expect(data.error).toContain('No further messages allowed');
        expect(mockAIClient.generateResponse).not.toHaveBeenCalled();
    });

    it('Additional: analysis already started blocks chat -> 409', async () => {
        submissionAnalysisStatus = 'completed';

        const req = createRequest({
            sessionToken: validToken,
            messages: [{ role: 'user', content: 'hello' }],
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(409);
        expect(data.code).toBe('analysis_started');
        expect(data.error).toContain('analysis has already begun');
        expect(mockAIClient.generateResponse).not.toHaveBeenCalled();
    });
});
