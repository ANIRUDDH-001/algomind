import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createServerSupabase();

        // Verify owner status
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('id', user.id)
            .single();

        if (profile?.account_type !== 'owner') {
            // Also check co_owners
            const { data: coOwner } = await supabase
                .from('co_owners')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();

            if (!coOwner) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const { data } = await supabase
            .from('code_attempts')
            .select('identifier, success, attempted_at')
            // Look back 24 hours
            .gte('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('attempted_at', { ascending: false });

        // Group by identifier
        const byIp = (data || []).reduce((acc: any, row: any) => {
            if (!acc[row.identifier]) acc[row.identifier] = { total: 0, failures: 0 };
            acc[row.identifier].total++;
            if (!row.success) acc[row.identifier].failures++;
            return acc;
        }, {});

        return NextResponse.json({ attempts: byIp });
    } catch (error) {
        console.error('Rate Limits Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch rate limits' }, { status: 500 });
    }
}
