// @ts-nocheck
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isPrimaryOwner } from '@/lib/auth/account-type';
import { UsersClient } from './users-client';

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        redirect('/owner/overview');
    }

    const sp = await searchParams;
    const query = sp?.q || '';

    const adminSupabase = await createServiceRoleSupabase();
    let dbQuery = adminSupabase
        .from('profiles')
        .select('id, account_type, email, created_at, updated_at, rate_limit_override, is_suspended, suspended_reason, suspended_at')
        .order('created_at', { ascending: false })
        .limit(100);

    if (query) {
        dbQuery = dbQuery.ilike('email', `%${query}%`);
    }

    const { data: users, error } = await dbQuery;

    let usersWithPrefs: any[] = [];

    if (!error && users) {
        const userIds = users.map(u => u.id);
        const { data: prefs } = await adminSupabase
            .from('user_preferences')
            .select('user_id, tts_provider')
            .in('user_id', userIds);

        const prefsMap = Object.fromEntries((prefs || []).map(p => [p.user_id, p.tts_provider]));
        usersWithPrefs = users.map(u => ({ ...u, tts_provider: prefsMap[u.id] || 'auto' }));
    }

    return (
        <UsersClient initialUsers={usersWithPrefs} initialQuery={query} />
    );
}
