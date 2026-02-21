import { createServerSupabase } from '@/lib/supabase/server';
import { getAccountType } from './account-type';
import { User } from '@supabase/supabase-js';

export async function requireEmployer(): Promise<{ user: User | null; error: string | null; status: number }> {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { user: null, error: 'Unauthorized', status: 401 };
    }

    const accountType = await getAccountType(user.id);

    if (accountType !== 'employer' && accountType !== 'admin') {
        return { user: null, error: 'Forbidden: Employer access required', status: 403 };
    }

    return { user, error: null, status: 200 };
}
