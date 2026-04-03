import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../events/route';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import { redisGet, redisSet, getRedis } from '@/lib/upstash/client';

vi.mock('@/lib/auth/requireAdminForApi');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/upstash/client');

// ── Helpers ──

const fakeEvents = [
    { id: '1', type: 'login', created_at: '2026-02-20T10:00:00Z', metadata: { ip: '1.2.3.4', agent: 'chrome' } },
    { id: '2', type: 'login', created_at: '2026-02-20T11:00:00Z', metadata: { ip: '5.6.7.8', agent: 'firefox' } },
    { id: '3', type: 'signup', created_at: '2026-02-21T09:00:00Z', metadata: { source: 'google' } },
];

const fakeStats = { total_users: 42, active_models: 3, total_sessions: 100 };

function makeRequest(params: Record<string, string> = {}): Request {
    const url = new URL('http://localhost:3000/api/admin/events');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new Request(url.toString());
}

// Build a chainable mock supabase that tracks whether .from() was called
function buildMockSupabase(queryTracker: { dbQueried: boolean }) {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn(function (this: any) {
            queryTracker.dbQueried = true;
            return Promise.resolve({ data: fakeEvents, error: null, count: fakeEvents.length });
        }),
    };
    return {
        from: vi.fn(() => chain),
        rpc: vi.fn().mockResolvedValue({ data: fakeStats, error: null }),
        _chain: chain,
    };
}

describe('Admin Analytics Caching (/api/admin/events)', () => {
    let mockSupabase: ReturnType<typeof buildMockSupabase>;
    let queryTracker: { dbQueried: boolean };

    beforeEach(() => {
        vi.resetAllMocks();
        queryTracker = { dbQueried: false };
        mockSupabase = buildMockSupabase(queryTracker);

        vi.mocked(requireAdminForApi).mockResolvedValue({
            user: { email: 'admin@test.com' } as any,
            errorResponse: null,
        });
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase as any);

        // Default: cache miss
        vi.mocked(redisGet).mockResolvedValue(null);
        vi.mocked(redisSet).mockResolvedValue(undefined);
    });

    // ── Test 1 ──
    it('1. First request fetches from DB and stores in Redis', async () => {
        const res = await GET(makeRequest());
        const data = await res.json();

        // DB was called
        expect(queryTracker.dbQueried).toBe(true);

        // redisSet was called for events cache key
        expect(redisSet).toHaveBeenCalledWith(
            'admin:events:7:all',
            expect.any(String),
            30,
        );

        // Response contains events
        expect(data.events).toHaveLength(3);
    });

    // ── Test 2 ──
    it('2. Second request within TTL returns cached result (DB not queried)', async () => {
        const cached = JSON.stringify({
            events: fakeEvents.map(({ metadata, ...rest }) => rest),
            analytics: [{ event_date: '2026-02-20', type: 'login', count: 2 }],
            totalCount: 3,
        });
        vi.mocked(redisGet).mockImplementation(async (key: string) => {
            if (key.startsWith('admin:events:')) return cached;
            if (key.startsWith('admin:stats:')) return JSON.stringify(fakeStats);
            return null;
        });

        const res = await GET(makeRequest());
        const data = await res.json();

        // DB was NOT called
        expect(queryTracker.dbQueried).toBe(false);
        expect(createServerSupabase).not.toHaveBeenCalled();

        // Response still contains data from cache
        expect(data.events).toBeDefined();
        expect(data.analytics).toBeDefined();
    });

    // ── Test 3 ──
    it('3. Cache key includes the `days` param (different days = different cache)', async () => {
        await GET(makeRequest({ days: '14' }));

        expect(redisGet).toHaveBeenCalledWith('admin:events:14:all');
        expect(redisSet).toHaveBeenCalledWith(
            'admin:events:14:all',
            expect.any(String),
            30,
        );
    });

    // ── Test 4 ──
    it('4. Cache key includes the `type` param', async () => {
        await GET(makeRequest({ type: 'login' }));

        expect(redisGet).toHaveBeenCalledWith('admin:events:7:login');
        expect(redisSet).toHaveBeenCalledWith(
            'admin:events:7:login',
            expect.any(String),
            30,
        );
    });

    // ── Test 5 ──
    it('5. When Redis is unavailable, falls back to DB without error', async () => {
        vi.mocked(redisGet).mockRejectedValue(new Error('Connection refused'));
        // redisGet in client.ts swallows errors and returns null, so mock it accordingly
        vi.mocked(redisGet).mockResolvedValue(null);
        vi.mocked(redisSet).mockRejectedValue(new Error('Connection refused'));

        const res = await GET(makeRequest());
        const data = await res.json();

        // Response should still succeed with DB data
        expect(res.status).toBe(200);
        expect(data.events).toHaveLength(3);
        expect(queryTracker.dbQueried).toBe(true);
    });

    // ── Test 6 ──
    it('6. Cache TTL is 30 seconds (verify TTL passed to redisSet)', async () => {
        await GET(makeRequest());

        // Every redisSet call should have 30 as the third argument
        const calls = vi.mocked(redisSet).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        for (const call of calls) {
            expect(call[2]).toBe(30);
        }
    });

    // ── Test 7 ──
    it('7. Manual refresh (?refresh=true) bypasses cache and re-fetches', async () => {
        // Populate cache
        const cached = JSON.stringify({
            events: [],
            analytics: [],
            totalCount: 0,
        });
        vi.mocked(redisGet).mockResolvedValue(cached);

        const res = await GET(makeRequest({ refresh: 'true' }));
        const data = await res.json();

        // redisGet should NOT have been called (bypass)
        expect(redisGet).not.toHaveBeenCalled();

        // DB WAS called
        expect(queryTracker.dbQueried).toBe(true);

        // Fresh data returned
        expect(data.events).toHaveLength(3);
    });

    // ── Test 8 ──
    it('8. Cache is invalidated when admin triggers cron job', async () => {
        // Import the trigger-cron POST handler
        const mockKeys = vi.fn().mockResolvedValue(['admin:events:7:all', 'admin:stats:7']);
        const mockDel = vi.fn().mockResolvedValue(2);
        const mockRedisInstance = { keys: mockKeys, del: mockDel };
        vi.mocked(getRedis).mockReturnValue(mockRedisInstance as any);

        // Mock fetch for GitHub API (trigger-cron calls fetch)
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '',
        }) as any;

        // Set env vars required by trigger-cron
        const origToken = process.env.GITHUB_TOKEN;
        const origRepo = process.env.GITHUB_REPO;
        process.env.GITHUB_TOKEN = 'test-token';
        process.env.GITHUB_REPO = 'test/repo';

        // Mock logSystemEvent used by trigger-cron
        vi.doMock('@/lib/monitoring/events', () => ({
            logSystemEvent: vi.fn().mockResolvedValue(undefined),
        }));

        // Dynamic import to pick up the mock
        const { POST } = await import('../trigger-cron/route');

        const res = await POST();
        const data = await res.json();

        expect(data.dispatched).toBe(true);
        expect(mockKeys).toHaveBeenCalledWith('admin:*');
        expect(mockDel).toHaveBeenCalledWith('admin:events:7:all', 'admin:stats:7');

        // Cleanup
        process.env.GITHUB_TOKEN = origToken;
        process.env.GITHUB_REPO = origRepo;
        globalThis.fetch = originalFetch;
    });

    // ── Test 9 ──
    it('9. systemStats are cached separately from event list', async () => {
        await GET(makeRequest());

        const setCalls = vi.mocked(redisSet).mock.calls;
        const cacheKeys = setCalls.map(c => c[0]);

        // Two separate cache keys
        expect(cacheKeys).toContain('admin:events:7:all');
        expect(cacheKeys).toContain('admin:stats:7');

        // Verify the events cache does NOT contain systemStats
        const eventsCall = setCalls.find(c => c[0] === 'admin:events:7:all');
        const eventsCachedData = JSON.parse(eventsCall![1]);
        expect(eventsCachedData).not.toHaveProperty('systemStats');

        // Verify the stats cache is the stats object
        const statsCall = setCalls.find(c => c[0] === 'admin:stats:7');
        const statsCachedData = JSON.parse(statsCall![1]);
        expect(statsCachedData).toHaveProperty('total_users');
    });

    // ── Test 10 ──
    it('10. Cache stores compressed JSON without full metadata', async () => {
        await GET(makeRequest());

        const eventsSetCall = vi.mocked(redisSet).mock.calls.find(c => c[0].startsWith('admin:events:'));
        expect(eventsSetCall).toBeDefined();

        const cachedPayload = JSON.parse(eventsSetCall![1]);

        // Verify events in cache do NOT have metadata field
        for (const evt of cachedPayload.events) {
            expect(evt).not.toHaveProperty('metadata');
        }

        // But they still have the core fields
        expect(cachedPayload.events[0]).toHaveProperty('id');
        expect(cachedPayload.events[0]).toHaveProperty('type');
        expect(cachedPayload.events[0]).toHaveProperty('created_at');
    });
});
