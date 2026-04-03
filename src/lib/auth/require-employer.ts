import { createServerSupabase } from '@/lib/supabase/server';
import { authorizedApiResult, forbiddenApiResult, getAccountType, type ApiAuthCheckResult, unauthorizedApiResult } from './account-type';
import { User } from '@supabase/supabase-js';

export async function requireEmployerForApi(): Promise<ApiAuthCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return unauthorizedApiResult();
    }

    const accountType = await getAccountType(user.id);

    if (accountType !== 'employer' && accountType !== 'admin' && accountType !== 'owner') {
        return forbiddenApiResult();
    }

    return authorizedApiResult({ id: user.id, email: user.email });
}

export async function requireEmployer(): Promise<{ user: User | null; error: string | null; status: number }> {
    const authResult = await requireEmployerForApi();
    if (authResult.errorResponse) {
        const status = authResult.errorResponse.status;
        return {
            user: null,
            error: status === 401 ? 'Unauthorized' : 'Forbidden: Employer access required',
            status,
        };
    }

    return {
        user: { id: authResult.user.id, email: authResult.user.email } as User,
        error: null,
        status: 200,
    };
}
