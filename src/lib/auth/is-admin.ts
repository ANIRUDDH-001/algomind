import { createServerSupabase } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export async function requireAdmin(): Promise<User> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user || error) {
        redirect('/login');
    }

    const { data: adminRecord } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email!)
        .single();

    if (!adminRecord) {
        redirect('/dashboard'); // Not an admin — send to normal dashboard
    }

    return user;
}
