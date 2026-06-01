/**
 * @codesage
 * @file      src/app/owner/page.tsx
 * @purpose   Server component for the owner dashboard, pre-fetching platform statistics and system events securely using the service role.
 * @tech      Next.js, Supabase
 * @connects  Imports OwnerDashboardClient
 * @apis      None
 * @db        Supabase (profiles, global_feature_flags, co_owners, system_events)
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OwnerDashboardClient } from './client';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

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

    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) {
        redirect('/dashboard');
    }

    // Use service role client for admin reads (bypasses RLS)
    const adminSupabase = await createServiceRoleSupabase();
    const results = await Promise.allSettled([
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'admin'),
        adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'employer'),
        adminSupabase.from('global_feature_flags').select('*').order('key'),
        adminSupabase.from('co_owners').select('*').order('granted_at', { ascending: false }),
        adminSupabase
            .from('system_events')
            .select('*')
            .in('type', [
                'db_error',
                'db.error',
                'route_error',
                'api.route_error',
                'model_error',
                'ai.model_error',
                'model_deprecated',
                'ai.model_deprecated',
                'model_verification_failed',
                'ai.model_verification_failed',
                'cron_failed',
                'cron.failed',
                'batch.failed',
                'assessment_insufficient',
                'assessment.insufficient_response',
                'embedding_failed',
                'ai.embedding_failed',
                'piston_error',
                'integration.piston_error',
                'leetcode_fetch_failed',
                'integration.leetcode_fetch_failed',
                'transcript_save_failed',
                'integration.transcript_save_failed',
            ])
            .order('created_at', { ascending: false })
            .limit(20),
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
