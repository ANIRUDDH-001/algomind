/**
 * @codesage
 * @file      src/lib/rate-limit/__tests__/ip-rate-limiter.failure-mode.test.ts
 * @purpose   Tests for Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkIpRateLimit } from '../ip-rate-limiter';
import { getServiceClient } from '@/lib/supabase/service';

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

describe('checkIpRateLimit failureMode', () => {
    const rpc = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServiceClient).mockReturnValue({ rpc } as never);
    });

    it('fails open when failureMode is fail-open and backend errors', async () => {
        rpc.mockRejectedValueOnce(new Error('redis down'));

        const result = await checkIpRateLimit('1.2.3.4', {
            maxRequests: 10,
            windowSeconds: 60,
            endpoint: 'flags',
            failureMode: 'fail-open',
        });

        expect(result.success).toBe(true);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10);
    });

    it('fails closed when failureMode is fail-closed and backend errors', async () => {
        rpc.mockRejectedValueOnce(new Error('db down'));

        const result = await checkIpRateLimit('1.2.3.4', {
            maxRequests: 5,
            windowSeconds: 600,
            endpoint: 'assess_start',
            failureMode: 'fail-closed',
        });

        expect(result.success).toBe(false);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('uses endpoint default failure policy when failureMode omitted', async () => {
        rpc.mockRejectedValueOnce(new Error('db down'));
        const closedResult = await checkIpRateLimit('1.2.3.4', {
            maxRequests: 5,
            windowSeconds: 600,
            endpoint: 'assess_start',
        });

        rpc.mockRejectedValueOnce(new Error('db down'));
        const openResult = await checkIpRateLimit('1.2.3.4', {
            maxRequests: 60,
            windowSeconds: 60,
            endpoint: 'flags',
        });

        expect(closedResult.success).toBe(false);
        expect(openResult.success).toBe(true);
    });
});
