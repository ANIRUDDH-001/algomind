// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
import { logSystemEvent } from '@/lib/monitoring/events';

//  -- automated unused local suppression
export async function GET(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ isOwner: false });
        }

        const isOwner = await isOwnerOrCoOwner(user.id);
        return NextResponse.json({ isOwner });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[user/owner-status] Error:', errMsg);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'user/owner-status' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
