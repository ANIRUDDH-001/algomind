import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
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
    const results = await Promise.allSettled([
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'admin'),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'employer'),
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
