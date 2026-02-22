import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../chat/route';
import { getAIClient } from '@/lib/ai/client';
import { getRedis } from '@/lib/upstash/client';
import { NextRequest } from 'next/server';
import * as jose from 'jose';

vi.mock('@/lib/ai/client');
vi.mock('@/lib/upstash/client');
vi.mock('@/lib/startup/validateEnv', () => ({
    validateEnv: vi.fn(),
}));

describe('Assess Chat API (/api/assess/chat)', () => {
    let mockAIClient: any;
    let mockRedis: any;
    let validToken: string;

    beforeEach(async () => {
        vi.resetAllMocks();

        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-that-needs-to-be-long-enough-for-hs256';

        // Generate a valid mock JWT
        const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
        };
        vi.mocked(getRedis).mockReturnValue(mockRedis);
    });

    afterEach(() => {
        delete (process.env as any).SUPABASE_SERVICE_ROLE_KEY;
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
        expect(data.limitReached).toBe(true);
    });
});
