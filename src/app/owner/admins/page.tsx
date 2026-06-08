import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isPrimaryOwner } from '@/lib/auth/account-type';
import { UsersClient } from '../users/users-client';

export default async function AdminsPage({
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
        .eq('account_type', 'admin')
        .order('created_at', { ascending: false })
        .limit(100);

    if (query) {
        dbQuery = dbQuery.ilike('email', `%${query}%`);
    }

    // @ts-expect-error -- automated unused local suppression
    const { data: admins, error } = await dbQuery;

    let adminsWithPrefs: any[] = [];

    if (admins && admins.length > 0) {
        const adminIds = admins.map(a => a.id);
        const { data: prefs } = await adminSupabase
            .from('user_preferences')
            .select('user_id, tts_provider')
            .in('user_id', adminIds);

        adminsWithPrefs = admins.map(admin => {
            const p = prefs?.find(p => p.user_id === admin.id);
            return {
                ...admin,
                tts_provider: p?.tts_provider || null
            };
        });
    }

    return (
        <div className="bg-[var(--surface-0)] border border-[var(--surface-edge)] rounded-2xl overflow-hidden shadow-2xl p-6">
            <UsersClient initialUsers={adminsWithPrefs || []} initialQuery={query} title="Platform Admins" />
        </div>
    );
}
