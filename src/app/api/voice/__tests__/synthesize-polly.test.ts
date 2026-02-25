// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

    it('returns 503 with fallback:"browser" when Polly flag is false', async () => {
        mockSynthesizeWithPolly.mockRejectedValue(new Error('AWS_POLLY_DISABLED'));

        const res = await POST(makeRequest({ text: 'hello' }));
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.fallback).toBe('browser');
        expect(json.provider).toBe('aws');
        expect(json.error).toContain('disabled');
    });

    it('returns 503 when Polly flag is true but not integrated yet', async () => {
        mockSynthesizeWithPolly.mockRejectedValue(new Error('AWS_POLLY_NOT_INTEGRATED'));

        const res = await POST(makeRequest({ text: 'hello' }));
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.fallback).toBe('browser');
        expect(json.error).toContain('Coming soon');
    });

    it('response includes X-TTS-Provider: aws-polly header on success path', async () => {
        // Mock returning a fake ArrayBuffer
        const fakeBuffer = new ArrayBuffer(16);
        mockSynthesizeWithPolly.mockResolvedValue(fakeBuffer);

        const res = await POST(makeRequest({ text: 'hello' }));

        expect(res.status).toBe(200);
        expect(res.headers.get('X-TTS-Provider')).toBe('aws-polly');
        expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    });
});
