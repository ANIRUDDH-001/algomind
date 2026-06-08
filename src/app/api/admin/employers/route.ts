/**
 * @codesage
 * @file      src/app/api/admin/employers/route.ts
 * @purpose   Fetches a list of all employer profiles for the admin dashboard.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/supabase/service, @/lib/monitoring/events
 * @apis      none
 * @db        profiles (account_type = employer)
 * @state     none
 * @env       none
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-expect-error -- automated unused local suppression
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const serviceClient = getServiceClient();

    // Fetch all profiles where account_type is 'employer'
        const { data, error } = await serviceClient
            .from('profiles')
            .select('*')
            .eq('account_type', 'employer')
            .order('created_at', { ascending: false });

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/employers' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ employers: data });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/employers' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
