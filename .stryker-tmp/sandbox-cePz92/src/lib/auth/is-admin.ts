/**
 * @codesage
 * @file      src/lib/auth/is-admin.ts
 * @purpose   Authentication guards, roles, and session management.
 * @tech      Node.js, NextAuth / Auth handlers
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { createServerSupabase } from '@/lib/supabase/server';
import { type User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

import { cookies } from 'next/headers';

export async function requireAdmin(): Promise<User> {
    // E2E Test Bypass
    const cookieStore = await cookies();
    if (process.env.NODE_ENV !== 'production' &&
        cookieStore.get('playwright-e2e')?.value === 'true') {
        return { id: 'test-user', email: 'admin@algomind.dev' } as User;
    }

    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user || error) {
        redirect('/login');
    }

    // Check admin status AND owner status in parallel
    const [{ data: isAdmin, error: adminErr }, ownerStatus] = await Promise.all([
        supabase.rpc('check_is_admin'),
        isOwnerOrCoOwner(user.id),
    ]);

    // Allow access if user is an admin OR an owner/co-owner
    if ((adminErr || !isAdmin) && !ownerStatus) {
        redirect('/dashboard'); // Neither admin nor owner — send to normal dashboard
    }

    return user;
}
