import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

export async function GET(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ isOwner: false });
    }

    const isOwner = await isOwnerOrCoOwner(user.id);
    return NextResponse.json({ isOwner });
}
