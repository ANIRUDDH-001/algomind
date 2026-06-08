import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // @ts-expect-error -- automated unused local suppression
        const { user, errorResponse } = await requireOwnerForApi();
        if (errorResponse) return errorResponse;

        const supabase = await createServerSupabase();

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
