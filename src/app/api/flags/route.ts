import { NextRequest, NextResponse } from 'next/server';
import {
    getAllGlobalFeatureFlags,
    setGlobalFeatureFlag,
    clearGlobalFeatureFlag,
    type ServerFlagKey,
    SERVER_FLAGS,
} from '@/lib/feature-flags-server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flags — return all server-side flags and their current values.
 * No auth required so the client can read flags on page load.
 */
export async function GET() {
    return NextResponse.json(getAllGlobalFeatureFlags());
}

/**
 * PATCH /api/flags — admin-only: set or clear a flag override.
 * Body: { flag: string, value: boolean | null }
 * value=null clears the override (falls back to env/default).
 */
export async function PATCH(req: NextRequest) {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const { flag, value } = body as { flag: string; value: boolean | null };

        if (!flag || !(flag in SERVER_FLAGS)) {
            return NextResponse.json(
                { error: `Unknown flag: ${flag}` },
                { status: 400 },
            );
        }

        const key = flag as ServerFlagKey;

        if (value === null) {
            clearGlobalFeatureFlag(key);
        } else {
            setGlobalFeatureFlag(key, value);
        }

        return NextResponse.json({
            flag: key,
            value: value,
            message: value === null ? 'Override cleared' : `Set to ${value}`,
        });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
