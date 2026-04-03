import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../trigger/route';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { logSystemLifecycle } from '@/lib/monitoring/events';

vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(),
    redisSet: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemLifecycle: vi.fn().mockResolvedValue(undefined),
}));

describe('/api/cron/trigger idempotency', () => {
    const originalFetch = global.fetch;
    const originalCronSecret = process.env.CRON_SECRET;
    const originalGithubToken = process.env.GITHUB_TOKEN;
    const originalGithubRepo = process.env.GITHUB_REPO;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'cron-secret';
        process.env.GITHUB_TOKEN = 'github-token';
        process.env.GITHUB_REPO = 'owner/repo';
        vi.mocked(redisGet).mockResolvedValue(null);
        vi.mocked(redisSet).mockResolvedValue(undefined);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '',
        }) as unknown as typeof fetch;
    });

    afterAll(() => {
        process.env.CRON_SECRET = originalCronSecret;
        process.env.GITHUB_TOKEN = originalGithubToken;
        process.env.GITHUB_REPO = originalGithubRepo;
        global.fetch = originalFetch;
    });

    it('returns 409 when idempotency key is reused', async () => {
        vi.mocked(redisGet).mockResolvedValue('already-processed');

        const request = new Request('http://localhost/api/cron/trigger', {
            headers: {
                authorization: 'Bearer cron-secret',
                'x-idempotency-key': 'abc-123',
            },
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.duplicate).toBe(true);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('stores dedupe key and triggers workflow for first request', async () => {
        const request = new Request('http://localhost/api/cron/trigger', {
            headers: {
                authorization: 'Bearer cron-secret',
                'x-idempotency-key': 'first-key',
            },
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.triggered).toBe(true);
        expect(redisSet).toHaveBeenCalledWith(
            'cron:idempotency:first-key',
            expect.any(String),
            86400
        );
        expect(logSystemLifecycle).toHaveBeenCalled();
    });
});
