import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../chat/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { supabaseHybridSearch } from '@/lib/rag/supabaseVectorStore';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

vi.mock('@/lib/ai/client', () => ({
    getAIClient: vi.fn()
}));

vi.mock('@/lib/rag/supabaseVectorStore', () => ({
    supabaseHybridSearch: vi.fn()
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit/user-rate-limiter', () => ({
    incrementUserUsage: vi.fn().mockResolvedValue(true)
}));

describe('/api/chat', () => {
    // Setup common mocks
    const mockGenerateResponse = vi.fn();
    const mockGetUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        (getAIClient as any).mockReturnValue({
            generateResponse: mockGenerateResponse
        });

        (createServerSupabase as any).mockResolvedValue({
            auth: {
                getUser: mockGetUser
            }
        });

        // Default to no RAG results
        (supabaseHybridSearch as any).mockResolvedValue([]);
    });

    // Helper to create request
    const createRequest = (body: any) => {
        return new Request('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };

    it('should return 401 when unauthenticated and not guest mode', async () => {
        // Mock null user
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }],
            guestMode: false
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 200 when guest mode is true', async () => {
        // Mock null user
        mockGetUser.mockResolvedValue({ data: { user: null } });

        // Mock successful AI response
        mockGenerateResponse.mockResolvedValue({
            success: true,
            response: 'test response',
            modelUsed: 'llama-3.3-70b-versatile',
            attemptedModels: [],
            provider: 'groq'
        });

        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }],
            guestMode: true
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.response).toBe('test response');
        expect(mockGenerateResponse).toHaveBeenCalled();
    });

    it('should inject RAG context into system prompt', async () => {
        // Mock authenticated user
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

        // Mock RAG results
        const mockContext = {
            chunk: {
                title: 'Binary Search',
                topic: 'Algorithms',
                subtopic: 'Search',
                content: 'Binary search finds an item in a sorted array.'
            },
            matchType: 'hybrid',
            score: 0.9
        };
        (supabaseHybridSearch as any).mockResolvedValue([mockContext]);

        // Mock AI response
        mockGenerateResponse.mockResolvedValue({
            success: true,
            response: 'RAG response',
            modelUsed: 'llama-3',
            attemptedModels: []
        });

        const req = createRequest({
            messages: [{ role: 'user', content: 'How does binary search work?' }],
            systemPrompt: 'You are a helper.'
        });

        await POST(req as any);

        // Verify system prompt contains RAG context
        expect(mockGenerateResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                systemPrompt: expect.stringContaining('### RELEVANT DSA KNOWLEDGE')
            })
        );
        expect(mockGenerateResponse).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                systemPrompt: expect.stringContaining('Binary search finds an item')
            })
        );
    });

    it('should return 400 on invalid messages format', async () => {
        // Mock authenticated user to bypass auth
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

        const req = createRequest({
            messages: "not an array"
        });

        const res = await POST(req as any);

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Invalid messages format'); // Or 'Invalid messages format' depending on when it catches it. 
        // Note: JSON.parse might succeed but the validation "if (!messages || !Array.isArray(messages))" will catch it.
        // Wait, "not an array" string as body JSON.stringify("not an array") -> "\"not an array\"" -> JSON.parse -> "not an array"
        // body = "not an array".
        // const { messages } = body; -> undefined

        // Let's check the code:
        // const text = await req.text(); body = JSON.parse(text);
        // if text is "not an array", JSON.parse is "not an array".
        // body.messages will be undefined.
        // "if (!messages || !Array.isArray(messages))" will be true.
        // returns 400 'Invalid messages format'
    });

    it('should return 400 if messages is strictly not an array but valid json object', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
        const req = createRequest({
            messages: "not-array-string"
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Invalid messages format');
    });

    it('should return 500 when AI generation fails', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

        mockGenerateResponse.mockResolvedValue({
            success: false,
            error: 'All models failed',
            attemptedModels: ['llama']
        });

        const req = createRequest({
            messages: [{ role: 'user', content: 'hello' }]
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('All models failed');
    });
});
