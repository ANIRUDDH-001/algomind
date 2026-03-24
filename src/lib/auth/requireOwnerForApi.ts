import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

type OwnerCheckResult =
    | { user: { id: string; email: string | undefined }; errorResponse: null }
    | { user: null; errorResponse: NextResponse };

export async function requireOwnerForApi(): Promise<OwnerCheckResult> {
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
