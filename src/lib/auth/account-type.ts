import { createServerSupabase } from '@/lib/supabase/server';

export async function getAccountType(userId: string): Promise<'candidate' | 'employer' | 'admin'> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', userId)
        .single();

    if (error || !data || !data.account_type) {
        return 'candidate';
    }

    return data.account_type as 'candidate' | 'employer' | 'admin';
}

export async function upgradeToEmployer(userId: string, companyName: string): Promise<void> {
    const supabase = await createServerSupabase();
    const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'employer', company_name: companyName })
        .eq('id', userId);

    if (error) {
        throw new Error(`Failed to upgrade to employer: ${error.message}`);
    }
}
