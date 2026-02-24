import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockGetGlobalFeatureFlag = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn().mockResolvedValue({
        auth: {
            getUser: () => mockGetUser(),
        },
    }),
}));

vi.mock('@/lib/feature-flags-server', () => ({
    getGlobalFeatureFlag: (key: string) => mockGetGlobalFeatureFlag(key),
}));

vi.mock('@/lib/voice/tts-preprocessor', () => ({
    preprocessForTTS: (text: string) => {
        // Real-ish replacement for testing
        return text.replace(/O\(n\)/gi, 'O of N');
    },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { POST } from '../synthesize/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('/api/voice/synthesize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: authenticated user
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        // Default: flag off
        mockGetGlobalFeatureFlag.mockResolvedValue(false);
        // Default: no API key
        delete process.env.GROQ_API_KEY;
    });

    it('returns 503 when ENABLE_GROQ_TTS=false', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(false);

        const res = await POST(makeRequest({ text: 'Hello' }));
        expect(res.status).toBe(503);

        const body = await res.json();
        expect(body.fallback).toBe('browser');
    });

    it('returns 401 for unauthenticated request', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });

        const res = await POST(makeRequest({ text: 'Hello' }));
        expect(res.status).toBe(401);
    });

    it('preprocesses DSA terms before sending to Groq', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(true);
        process.env.GROQ_API_KEY = 'test-key';

        // Mock fetch to capture what was sent to Groq
        const capturedBodies: string[] = [];
        global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
            capturedBodies.push(opts.body as string);
            return {
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(8),
            };
        });

        await POST(makeRequest({ text: 'The time complexity is O(n)' }));

        // Verify the text sent to Groq has preprocessed DSA terms
        expect(capturedBodies.length).toBe(1);
        const sentBody = JSON.parse(capturedBodies[0]);
        expect(sentBody.input).toContain('O of N');
        expect(sentBody.input).not.toContain('O(n)');
    });

    it('returns 503 when GROQ_API_KEY is missing', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(true);
        // No GROQ_API_KEY set

        const res = await POST(makeRequest({ text: 'Hello' }));
        expect(res.status).toBe(503);

        const body = await res.json();
        expect(body.fallback).toBe('browser');
    });

    it('validates text length — truncates > 4000 chars', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(true);
        process.env.GROQ_API_KEY = 'test-key';

        const capturedBodies: string[] = [];
        global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
            capturedBodies.push(opts.body as string);
            return {
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(8),
            };
        });

        const longText = 'A'.repeat(5000);
        await POST(makeRequest({ text: longText }));

        const sentBody = JSON.parse(capturedBodies[0]);
        expect(sentBody.input.length).toBeLessThanOrEqual(4000);
    });
});
