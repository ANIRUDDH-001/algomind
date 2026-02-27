// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: () => Promise.resolve({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) }
    }),
}));

// Mock TTS preprocessor
vi.mock('@/lib/voice/tts-preprocessor', () => ({
    preprocessForTTS: (text: string) => text,
}));

// Mock synthesizeWithPolly
const mockSynthesizeWithPolly = vi.fn();
vi.mock('@/lib/aws/polly', () => ({
    synthesizeWithPolly: (...args: unknown[]) => mockSynthesizeWithPolly(...args),
}));

const { POST } = await import('../synthesize-polly/route');

function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/voice/synthesize-polly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/voice/synthesize-polly', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 503 with fallback:"groq" when Polly flag is false', async () => {
        mockSynthesizeWithPolly.mockRejectedValue(new Error('AWS_POLLY_DISABLED'));

        const res = await POST(makeRequest({ text: 'hello' }));
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.fallback).toBe('groq');
        expect(json.error).toContain('disabled');
    });

    it('returns 503 when Polly is not configured', async () => {
        mockSynthesizeWithPolly.mockRejectedValue(new Error('AWS_POLLY_NOT_CONFIGURED'));

        const res = await POST(makeRequest({ text: 'hello' }));
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.fallback).toBe('groq');
        expect(json.error).toContain('not configured');
    });

    it('returns 502 when Polly synthesis fails', async () => {
        mockSynthesizeWithPolly.mockRejectedValue(new Error('AWS_POLLY_FAILED'));

        const res = await POST(makeRequest({ text: 'hello' }));
        const json = await res.json();

        expect(res.status).toBe(502);
        expect(json.fallback).toBe('groq');
    });

    it('response includes X-TTS-Provider: aws-polly header on success path', async () => {
        const fakeBuffer = new ArrayBuffer(16);
        mockSynthesizeWithPolly.mockResolvedValue(fakeBuffer);

        const res = await POST(makeRequest({ text: 'hello' }));

        expect(res.status).toBe(200);
        expect(res.headers.get('X-TTS-Provider')).toBe('aws-polly');
        expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
        expect(res.headers.get('X-Voice')).toBe('Kajal');
    });

    it('returns 400 for missing text', async () => {
        const res = await POST(makeRequest({}));
        expect(res.status).toBe(400);
    });
});
