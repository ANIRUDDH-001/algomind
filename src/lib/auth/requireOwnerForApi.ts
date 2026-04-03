import { createServerSupabase } from '@/lib/supabase/server';
import { authorizedApiResult, forbiddenApiResult, isOwnerOrCoOwner, type ApiAuthCheckResult, unauthorizedApiResult } from '@/lib/auth/account-type';

export async function requireOwnerForApi(): Promise<ApiAuthCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return unauthorizedApiResult();
    }

    const isOwner = await isOwnerOrCoOwner(user.id);

    if (!isOwner) {
        return forbiddenApiResult();
    }

    return authorizedApiResult({ id: user.id, email: user.email });
}
