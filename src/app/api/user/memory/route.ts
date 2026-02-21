import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('learner_profiles')
            .select('kai_memory')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('❌ [Memory API] DB error:', error.message);
            return NextResponse.json({ kaiMemory: null });
        }

        return NextResponse.json({ kaiMemory: data?.kai_memory ?? null });
    } catch (err) {
        console.error('❌ [Memory API] Unexpected error:', err);
        return NextResponse.json({ kaiMemory: null });
    }
}
