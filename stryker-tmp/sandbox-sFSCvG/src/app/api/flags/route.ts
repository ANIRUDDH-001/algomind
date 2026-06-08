/**
 * @codesage
 * @file      src/app/api/flags/route.ts
 * @purpose   Provides public read access and admin write access to global feature flags.
 * @tech      Next.js
 * @connects  @/lib/auth/requireAdminForApi, @/lib/feature-flags-server, @/lib/feature-flags, @/lib/monitoring/events, @/lib/rate-limit/ip-rate-limiter
 * @apis      None
 * @db        global_feature_flags (via helper)
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getAllGlobalFeatureFlags, setGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flags — return all server-side flags and their current values.
 * Public (no auth required) so client hooks can read flags on page load.
 * Rate-limited to 60 requests/min per IP to prevent abuse.
 */
export async function GET(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateLimitResult = await checkIpRateLimit(ip, {
        maxRequests: 60,
        windowSeconds: 60,
        endpoint: 'flags',
        failureMode: 'fail-open',
    });
    if (!rateLimitResult.allowed) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const flags = await getAllGlobalFeatureFlags();
    return NextResponse.json(flags);
}

/**
 * POST /api/flags — admin-only: toggle a flag on or off.
 * Body: { key: string, isEnabled: boolean }
 */
export async function POST(req: NextRequest) {
    const { errorResponse, user } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const { key, isEnabled } = body;

        if (!key || typeof isEnabled !== 'boolean') {
            return NextResponse.json(
                { error: 'key and isEnabled required' },
                { status: 400 },
            );
        }

        if (!(key in FEATURE_FLAGS)) {
            return NextResponse.json(
                { error: `Unknown flag: ${key}` },
                { status: 400 },
            );
        }

        await setGlobalFeatureFlag(key as FeatureFlagKey, isEnabled, user!.id);

        // Log this admin action for audit trail
        await logSystemEvent({
            type: 'admin_action',
            userId: user!.id,
            metadata: { action: 'toggle_feature_flag', key, isEnabled }
        });

        return NextResponse.json({ success: true, key, isEnabled });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
