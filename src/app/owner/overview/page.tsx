import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
import { TEST_ACCOUNT_EMAIL_LIKE } from '@/lib/owner/test-accounts';
import { OverviewClient } from './OverviewClient';

export default async function OverviewPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) {
        redirect('/dashboard');
    }

    const adminSupabase = await createServiceRoleSupabase();
    // Exclude QA/test accounts (@algomind.test) so the headline counts reflect real users.
    const results = await Promise.allSettled([
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).not('email', 'like', TEST_ACCOUNT_EMAIL_LIKE),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'admin').not('email', 'like', TEST_ACCOUNT_EMAIL_LIKE),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'employer').not('email', 'like', TEST_ACCOUNT_EMAIL_LIKE),
    ]);

    const [usersRes, adminsRes, employersRes] = results;
    const totalUsers = usersRes.status === 'fulfilled' ? (usersRes.value.count ?? 0) : 0;
    const totalAdmins = adminsRes.status === 'fulfilled' ? (adminsRes.value.count ?? 0) : 0;
    const totalEmployers = employersRes.status === 'fulfilled' ? (employersRes.value.count ?? 0) : 0;

    return (
        <OverviewClient 
            totalUsers={totalUsers}
            totalAdmins={totalAdmins}
            totalEmployers={totalEmployers}
        />
    );
}
