import { createServerSupabase } from '@/lib/supabase/server';
import { authorizedApiResult, forbiddenApiResult, type ApiAuthCheckResult, unauthorizedApiResult } from '@/lib/auth/account-type';

export async function requireAdminForApi(): Promise<ApiAuthCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return unauthorizedApiResult();
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc('check_is_admin');

    if (adminErr || !isAdmin) {
        console.error('Admin Check Failed:', { adminErr, isAdmin, userId: user.id });
        return forbiddenApiResult();
    }

    return authorizedApiResult({ id: user.id, email: user.email });
}
