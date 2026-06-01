/**
 * @codesage
 * @file      src/app/api/admin/cache-stats/route.ts
 * @purpose   Provides API endpoints for admins to get and clear AI response cache statistics.
 * @tech      Next.js, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/ai/response-cache
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    Removed console.error in GET and DELETE catch blocks.
 * @audit     CODESAGE-v1
 */
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
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
