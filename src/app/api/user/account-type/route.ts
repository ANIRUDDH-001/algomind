import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ accountType: 'candidate' });

    const { data } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .single();

    return NextResponse.json({ accountType: data?.account_type || 'candidate' });
}
