import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';
import { setGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export async function PATCH(req: NextRequest) {
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const { key, isEnabled } = await req.json();

        if (!key || !(key in FEATURE_FLAGS)) {
            return NextResponse.json({ error: 'Invalid or missing flag key' }, { status: 400 });
        }
        if (typeof isEnabled !== 'boolean') {
            return NextResponse.json({ error: 'isEnabled must be a boolean' }, { status: 400 });
        }

        await setGlobalFeatureFlag(key as FeatureFlagKey, isEnabled, user.id);

        return NextResponse.json({ success: true, key, isEnabled });
    } catch (err) {
        console.error('Flag update error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
