import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner, type ApiAuthCheckResult } from '@/lib/auth/account-type';
import { NextResponse } from 'next/server';

export async function requireOwnerForApi(): Promise<ApiAuthCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            user: null,
            errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const isOwner = await isOwnerOrCoOwner(user.id);

    if (!isOwner) {
        return {
            user: null,
            errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return {
        user: { id: user.id, email: user.email },
        errorResponse: null,
    };
}
