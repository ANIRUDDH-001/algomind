/**
 * /api/health — Binary liveness check.
 *
 * Returns 200 if the app can reach Supabase, 503 otherwise.
 * Exposes NO secrets, keys, or infrastructure details.
 *
 * For detailed diagnostics, use the Supabase dashboard directly.
 */
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createServerSupabase();
        // Minimal connectivity check — just verify Supabase responds
        const { error } = await supabase.from('global_feature_flags').select('key').limit(1);
        if (error) {
            return NextResponse.json({ status: 'degraded', reason: 'database' }, { status: 503 });
        }
        return NextResponse.json({ status: 'ok' });
    } catch {
        return NextResponse.json({ status: 'error' }, { status: 503 });
    }
}
