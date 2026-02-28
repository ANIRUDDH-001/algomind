import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OwnerDashboardClient } from './client';

export default async function OwnerPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, email')
        .eq('id', user.id)
        .single();

    if (profile?.account_type !== 'owner') {
        // Check co_owners table
        const { data: coOwner } = await supabase
            .from('co_owners')
            .select('id')
            .eq('email', user.email || '')
            .maybeSingle();

        if (!coOwner) {
            redirect('/dashboard');
        }
    }

    // Fetch summary stats for owner dashboard
    const results = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'admin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'employer'),
        supabase.from('global_feature_flags').select('*').order('key'),
        supabase.from('co_owners').select('*').order('granted_at', { ascending: false }),
        supabase.from('system_events').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    const [usersRes, adminsRes, employersRes, flagsRes, coOwnersRes, eventsRes] = results;
    const totalUsers = usersRes.status === 'fulfilled' ? (usersRes.value.count ?? 0) : 0;
    const totalAdmins = adminsRes.status === 'fulfilled' ? (adminsRes.value.count ?? 0) : 0;
    const totalEmployers = employersRes.status === 'fulfilled' ? (employersRes.value.count ?? 0) : 0;
    const featureFlags = flagsRes.status === 'fulfilled' ? (flagsRes.value.data ?? []) : [];
    const coOwners = coOwnersRes.status === 'fulfilled' ? (coOwnersRes.value.data ?? []) : [];
    const recentEvents = eventsRes.status === 'fulfilled' ? (eventsRes.value.data ?? []) : [];

    return (
        <OwnerDashboardClient
            stats={{
                totalUsers: totalUsers || 0,
                totalAdmins: totalAdmins || 0,
                totalEmployers: totalEmployers || 0
            }}
            featureFlags={featureFlags || []}
            coOwners={coOwners || []}
            recentEvents={recentEvents || []}
            isPrimaryOwner={profile?.account_type === 'owner'}
            userEmail={user.email || ''}
        />
    );
}
