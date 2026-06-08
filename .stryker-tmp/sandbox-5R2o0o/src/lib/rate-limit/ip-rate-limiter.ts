/**
 * @codesage
 * @file      src/lib/rate-limit/ip-rate-limiter.ts
 * @purpose   Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { getServiceClient } from '@/lib/supabase/service';
import { getFailureMode } from './decision-layer';

export async function checkIpRateLimit(
    ip: string,
    options: {
        maxRequests: number;
        windowSeconds: number;
        endpoint?: string;
        failureMode?: 'fail-open' | 'fail-closed';
    }
): Promise<{ success: boolean; allowed?: boolean; remaining?: number }> {
    const rawIp = ip && ip !== 'unknown' ? ip : null;

    if (!rawIp) {
        console.warn('[IPRateLimit] Request received with no IP headers (x-forwarded-for, x-real-ip both null)', {
            endpoint: options.endpoint,
        });
    }

    // When IP is unknown, use a shared conservative key.
    // This is rate-limited more strictly than known IPs to prevent
    // load balancer misconfiguration from being exploited.
    const effectiveIp = rawIp ?? 'shared:unknown-ip';
    const effectiveMaxRequests = rawIp
        ? options.maxRequests
        : Math.floor(options.maxRequests * 0.3); // 30% of normal limit for unknown IPs

    const failureMode = options.failureMode
        ?? getFailureMode(options.endpoint)
        ?? 'fail-open';

    try {
        const supabase = getServiceClient();

        const identifier = options.endpoint ? `${options.endpoint}:${effectiveIp}` : effectiveIp;

        // Use the generic check_code_rate_limit DB function
        const { data } = await supabase.rpc('check_code_rate_limit', {
            p_identifier: identifier,
            p_window_seconds: options.windowSeconds,
            p_max_attempts: effectiveMaxRequests,
        });

        const result = Array.isArray(data) ? data[0] : data;

        // The legacy checker returned `{ success: boolean, remaining?: number }`
        // Convert to exactly matched schema for compatibility
        const allowed = result?.allowed ?? true;
        return {
            success: allowed,
            allowed: allowed,
            remaining: Math.max(0, options.maxRequests - (result?.attempts_in_window ?? 0)),
        };
    } catch (error) {
        console.error('[Rate Limit] DB error:', error);
        if (failureMode === 'fail-closed') {
            return { success: false, allowed: false, remaining: 0 };
        }
        return { success: true, allowed: true, remaining: options.maxRequests };
    }
}
