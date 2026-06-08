/**
 * @codesage
 * @file      src/lib/auth/requireAdminForApi.ts
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
import { authorizedApiResult, forbiddenApiResult, type ApiAuthCheckResult, unauthorizedApiResult } from '@/lib/auth/account-type';

export async function requireAdminForApi(): Promise<ApiAuthCheckResult> {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return unauthorizedApiResult();
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc('check_is_admin');

    if (adminErr || !isAdmin) {
        console.error('Admin Check Failed:', { adminErr, isAdmin, userId: user.id });
        return forbiddenApiResult();
    }

    return authorizedApiResult({ id: user.id, email: user.email });
}
