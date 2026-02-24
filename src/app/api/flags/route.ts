import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getAllGlobalFeatureFlags, setGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';
import { logSystemEvent } from '@/lib/monitoring/events';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flags — return all server-side flags and their current values.
 * Public (no auth required) so client hooks can read flags on page load.
 */
export async function GET() {
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
        void logSystemEvent({
            type: 'admin_action',
            userId: user!.id,
            metadata: { action: 'toggle_feature_flag', key, isEnabled }
        });

        return NextResponse.json({ success: true, key, isEnabled });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
