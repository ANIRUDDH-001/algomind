import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';
import { getServiceClient } from '@/lib/supabase/service';
import { getCircuitState, getRedis } from '@/lib/upstash/client';

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

vi.mock('@/lib/upstash/client', () => ({
    getRedis: vi.fn(),
    getCircuitState: vi.fn(),
}));

describe('/api/health contract', () => {
    const selectLimit = vi.fn();
    const selectStuck = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        const from = vi.fn((table: string) => {
            if (table === 'global_feature_flags') {
                return {
                    select: vi.fn(() => ({
                        limit: selectLimit,
                    })),
                };
            }

            if (table === 'candidate_submissions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            lt: selectStuck,
                        })),
                    })),
                };
            }

            return { select: vi.fn() };
        });

        vi.mocked(getServiceClient).mockReturnValue({ from } as never);
        vi.mocked(getRedis).mockReturnValue({ ping: vi.fn().mockResolvedValue('PONG') } as never);
        vi.mocked(getCircuitState).mockReturnValue({
            state: 'closed',
            consecutiveErrors: 0,
            openedAt: null,
            lastError: null,
        });

        selectLimit.mockResolvedValue({ error: null });
        selectStuck.mockResolvedValue({ count: 0 });
    });

    it('returns healthy when dependencies are healthy', async () => {
        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('healthy');
        expect(body.redis).toBe('ok');
        expect(body.db).toBe('ok');
    });

    it('returns degraded when circuit is open', async () => {
        vi.mocked(getCircuitState).mockReturnValue({
            state: 'open',
            consecutiveErrors: 5,
            openedAt: Date.now(),
            lastError: 'redis down',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('degraded');
        expect(body.redis).toBe('circuit_open');
    });

    it('returns unhealthy when stale pending analyses exceed threshold', async () => {
        selectStuck.mockResolvedValue({ count: 6 });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('unhealthy');
        expect(body.stuck_analyses).toBe(6);
    });
});
