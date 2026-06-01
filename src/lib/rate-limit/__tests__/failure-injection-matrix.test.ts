/**
 * @codesage
 * @file      src/lib/rate-limit/__tests__/failure-injection-matrix.test.ts
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

describe('rate-limit failure injection matrix', () => {
    const rpc = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getServiceClient).mockReturnValue({ rpc } as never);
        rpc.mockRejectedValue(new Error('simulated backend outage'));
    });

    it('fails closed for critical endpoints under outage', async () => {
        const result = await checkIpRateLimit('1.1.1.1', {
            maxRequests: 5,
            windowSeconds: 60,
            endpoint: 'assess_start',
        });

        expect(result.allowed).toBe(false);
        expect(result.success).toBe(false);
    });

    it('fails open for non-critical endpoints under outage', async () => {
        const result = await checkIpRateLimit('1.1.1.1', {
            maxRequests: 60,
            windowSeconds: 60,
            endpoint: 'flags',
        });

        expect(result.allowed).toBe(true);
        expect(result.success).toBe(true);
    });

    it('fails open for unknown endpoint class', async () => {
        const result = await checkIpRateLimit('1.1.1.1', {
            maxRequests: 60,
            windowSeconds: 60,
            endpoint: 'unknown_new_endpoint',
        });

        expect(result.allowed).toBe(true);
        expect(result.success).toBe(true);
    });
});
