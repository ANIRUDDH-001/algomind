import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getResponseCache } from '@/lib/ai/response-cache';
import { getFeatureFlag } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const cache = getResponseCache();
        const stats = cache.getStats();

        // getFeatureFlag reads localStorage on the client, so we pass the default
        // server-side value here (flag default from config)
        const enabled = getFeatureFlag('ENABLE_RESPONSE_CACHE');

        return NextResponse.json({ stats, enabled });
    } catch (error) {
        console.error('[Admin Cache Stats API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const cache = getResponseCache();
        cache.clear();

        return NextResponse.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
        console.error('[Admin Cache Stats API] DELETE Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
