import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

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

// Helper to check if user is the primary owner or a granted co-owner.
// Uses service client to bypass RLS on co_owners table.
export async function isOwnerOrCoOwner(userId: string): Promise<boolean> {
    const svc = getServiceClient();
    const { data: profile } = await svc
        .from('profiles')
        .select('account_type, email')
        .eq('id', userId)
        .single();

    if (profile?.account_type === 'owner') return true;

    // Check co_owners by user_id OR email (user_id may not be backfilled yet)
    const { data: coOwner } = await svc
        .from('co_owners')
        .select('id')
        .or(`user_id.eq.${userId}${profile?.email ? `,email.eq.${profile.email}` : ''}`)
        .limit(1)
        .maybeSingle();

    return !!coOwner;
}

export async function isPrimaryOwner(userId: string): Promise<boolean> {
    const svc = getServiceClient();
    const { data: profile } = await svc
        .from('profiles')
        .select('account_type')
        .eq('id', userId)
        .single();

    return profile?.account_type === 'owner';
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
