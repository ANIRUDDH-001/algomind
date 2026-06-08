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
// @ts-nocheck

// 

import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getResponseCache } from '@/lib/ai/response-cache';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const cache = getResponseCache();
        const stats = cache.getStats();

        const supabase = await createServerSupabase();
        const { data: flagData } = await supabase
            .from('global_feature_flags')
            .select('is_enabled')
            .eq('key', 'ENABLE_RESPONSE_CACHE')
            .single();

        const isEnabled = flagData?.is_enabled ?? false;

        return NextResponse.json({ stats, isEnabled });
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
