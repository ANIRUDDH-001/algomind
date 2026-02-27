import { createServerSupabase } from '@/lib/supabase/server';

export type AccountType = 'candidate' | 'employer' | 'admin' | 'owner';

export async function getAccountType(userId: string): Promise<AccountType> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', userId)
        .single();

    if (error || !data || !data.account_type) {
        return 'candidate';
    }

    return data.account_type as AccountType;
}

// Helper to check if user is the primary owner or a granted co-owner
export async function isOwnerOrCoOwner(userId: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, email')
        .eq('id', userId)
        .single();

    if (profile?.account_type === 'owner') return true;

    if (profile?.email) {
        // Check co_owners table
        const { data: coOwner } = await supabase
            .from('co_owners')
            .select('id')
            .eq('email', profile.email)
            .maybeSingle();

        return !!coOwner;
    }

    return false;
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
