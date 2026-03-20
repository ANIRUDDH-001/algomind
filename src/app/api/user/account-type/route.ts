import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET() {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ accountType: 'candidate' });

        const { data } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('id', user.id)
            .single();

        return NextResponse.json({ accountType: data?.account_type || 'candidate' });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[user/account-type] Error:', errMsg);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'user/account-type' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
