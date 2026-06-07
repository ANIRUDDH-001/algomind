import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isPrimaryOwner } from '@/lib/auth/account-type';
import { CoOwnersClient } from './co-owners-client';

export default async function CoOwnersPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        redirect('/owner/overview');
    }

    const adminSupabase = await createServiceRoleSupabase();
    const { data: coOwners } = await adminSupabase
        .from('co_owners')
        .select('*')
        .order('granted_at', { ascending: false });

    return <CoOwnersClient initialCoOwners={coOwners || []} />;
}
