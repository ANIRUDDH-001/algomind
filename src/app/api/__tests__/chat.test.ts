import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../chat/route';
import { getAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { checkUserRateLimit, incrementUserUsage } from '@/lib/rate-limit/user-rate-limiter';
import { supabaseHybridSearch } from '@/lib/rag/supabaseVectorStore';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getActiveModels } from '@/lib/ai/model-registry';
import { NextRequest } from 'next/server';

vi.mock('@/lib/ai/client');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/rate-limit/user-rate-limiter');
vi.mock('@/lib/rag/supabaseVectorStore');
vi.mock('@/lib/monitoring/events');
vi.mock('@/lib/rate-limit/ip-rate-limiter');
vi.mock('@/lib/ai/model-registry');

const GEMINI_MODEL = {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    tier: 1,
    rpm: 15,
    tpm: 1000000,
    rpd: 1500,
    contextWindow: 1000000,
    supportsEmbeddings: false,
    description: 'Gemini Flash',
};

describe('Chat API (/api/chat)', () => {
    let mockSupabase: any;
    let mockAIClient: any;

    beforeEach(() => {
        vi.resetAllMocks();

        mockSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
            }
        };
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase);

        mockAIClient = {
            generateResponse: vi.fn().mockResolvedValue({
                success: true,
                response: 'AI response text',
            }),
        };
        vi.mocked(getAIClient).mockReturnValue(mockAIClient);

        vi.mocked(checkUserRateLimit).mockResolvedValue({ allowed: true, remaining: 5, isAdmin: false });
        vi.mocked(incrementUserUsage).mockResolvedValue(undefined as any);
        vi.mocked(supabaseHybridSearch).mockResolvedValue([]);
        vi.mocked(logSystemEvent).mockResolvedValue(undefined);
        vi.mocked(checkIpRateLimit).mockResolvedValue({ success: true, remaining: 19 } as any);
        vi.mocked(getActiveModels).mockResolvedValue([GEMINI_MODEL] as any);
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    it('1. Authenticated user, under rate limit -> streams AI response', async () => {
        const req = createRequest({ messages: [{ role: 'user', content: 'hello' }] });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.response).toBe('AI response text');
        expect(mockAIClient.generateResponse).toHaveBeenCalled();
    });

    it('2. Authenticated user, rate limit exceeded -> 429', async () => {
        vi.mocked(checkUserRateLimit).mockResolvedValue({ allowed: false, remaining: 0, isAdmin: false });

        const req = createRequest({ messages: [{ role: 'user', content: 'hello' }] });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(429);
        expect(data.error).toBe('Rate limit exceeded');
        expect(mockAIClient.generateResponse).not.toHaveBeenCalled();
    });

    it('3. Guest mode (guestMode: true) -> bypasses rate limit check', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

        const req = createRequest({ messages: [{ role: 'user', content: 'hello' }], guestMode: true });
        const res = await POST(req);
        const _data = await res.json();

        expect(res.status).toBe(200);
        expect(checkUserRateLimit).not.toHaveBeenCalled();
        expect(mockAIClient.generateResponse).toHaveBeenCalled();
    });

    it('4. Invalid/missing messages array -> 400', async () => {
        const req = createRequest({}); // missing messages
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Invalid messages format');
    });

    it('5. AI client throws -> 500 with error message', async () => {
        mockAIClient.generateResponse.mockResolvedValue({
            success: false,
            error: 'Mock Error',
        });

        const req = createRequest({ messages: [{ role: 'user', content: 'hello' }] });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Mock Error');
    });

    it('6. RAG context injected when problemContext.ragContext provided', async () => {
        // With the new architecture, client ragContext is already baked into
        // the system prompt. Server only adds RAG if it differs from client.
        // When no interviewState/title triggers server RAG, the fallback
        // ragContext equals problemContext.ragContext, so server skip re-injection.
        // Verify the API still succeeds and uses the client's system prompt.
        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }],
            systemPrompt: 'System prompt with Injected Rag Context already baked in',
            problemContext: { ragContext: 'Injected Rag Context' }
        });
        await POST(req);

        expect(mockAIClient.generateResponse).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                systemPrompt: expect.stringContaining('Injected Rag Context')
            })
        );
        expect(supabaseHybridSearch).not.toHaveBeenCalled();
    });

    it('7. Company persona applied when companyPersona param present', async () => {
        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }],
            companyPersona: 'Google Interviewer'
        });
        await POST(req);

        expect(mockAIClient.generateResponse).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                systemPrompt: expect.stringContaining('Google Interviewer')
            })
        );
    });

    it('8. System prompt override applied when systemPrompt provided', async () => {
        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }],
            systemPrompt: 'Custom System Prompt'
        });
        await POST(req);

        expect(mockAIClient.generateResponse).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                systemPrompt: expect.stringContaining('Custom System Prompt')
            })
        );
    });

    it('9. Rate limit increment called after successful response', async () => {
        const req = createRequest({ messages: [{ role: 'user', content: 'hello' }] });
        await POST(req);

        expect(incrementUserUsage).toHaveBeenCalledWith('user-123', mockSupabase);
    });

    it('10. System event logged on AI error', async () => {
        mockAIClient.generateResponse.mockResolvedValue({
            success: false,
            error: 'Mock Error',
        });

        const req = createRequest({ messages: [{ role: 'user', content: 'search term' }] });
        await POST(req);

        expect(logSystemEvent).toHaveBeenCalledWith({
            type: 'model_error',
            errorMessage: 'Mock Error'
        });
    });
});
