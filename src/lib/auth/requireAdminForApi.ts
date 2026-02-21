import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type AdminCheckResult =
    | { user: { id: string; email: string | undefined }; errorResponse: null }
    | { user: null; errorResponse: NextResponse };

export async function requireAdminForApi(): Promise<AdminCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            user: null,
            errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc('check_is_admin');

    if (adminErr || !isAdmin) {
        console.error('Admin Check Failed:', { adminErr, isAdmin, userId: user.id });
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
