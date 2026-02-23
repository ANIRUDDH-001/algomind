import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getResponseCache } from '@/lib/ai/response-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const cache = getResponseCache();
        const stats = cache.getStats();

        // Note: ENABLE_RESPONSE_CACHE is a localStorage-based flag (client-side only).
        // We do NOT call getFeatureFlag() here because on the server typeof window === 'undefined'
        // always returns the hardcoded defaultValue (false), making the status always show "Disabled".
        // The client component reads the flag directly from localStorage instead.

        return NextResponse.json({ stats });
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
