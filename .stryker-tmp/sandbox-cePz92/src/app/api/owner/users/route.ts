/**
 * @codesage
 * @file      src/app/api/owner/users/route.ts
 * @purpose   Owner-only API for listing users and modifying account statuses/preferences.
 * @tech      Next.js, Supabase Service Client
 * @connects  @/lib/supabase/server, @/lib/auth/account-type, @/lib/auth/requireOwnerForApi, @/lib/monitoring/events
 * @apis      None
 * @db        profiles, user_preferences
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
//  -- automated unused local suppression
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { isPrimaryOwner } from '@/lib/auth/account-type';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET(req: NextRequest) {
    //  -- automated unused local suppression
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    // Use service role client for data reads (bypasses RLS)
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

    if (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/users' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const userIds = users.map(u => u.id);
    const { data: prefs } = await adminSupabase
        .from('user_preferences')
        .select('user_id, tts_provider')
        .in('user_id', userIds);

    const prefsMap = Object.fromEntries((prefs || []).map(p => [p.user_id, p.tts_provider]));
    const usersWithPrefs = users.map(u => ({ ...u, tts_provider: prefsMap[u.id] || 'auto' }));

    return NextResponse.json({ users: usersWithPrefs });
}

export async function PATCH(req: NextRequest) {
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    // Restrict user account mutations to the primary owner.
    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        return NextResponse.json({ error: 'Only the primary owner can modify user accounts' }, { status: 403 });
    }

    // Use service role client for data modifications (bypasses RLS)
    const adminSupabase = await createServiceRoleSupabase();

    try {
        const body = await req.json();
        const { userId, accountType, suspend, rateLimitOverride, ttsProvider } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Prevent owners from demoting or suspending other owners
        if (accountType || suspend !== undefined) {
            const { data: target } = await adminSupabase
                .from('profiles')
                .select('account_type')
                .eq('id', userId)
                .single();

            if (target?.account_type === 'owner') {
                return NextResponse.json({ error: 'Cannot modify primary owner account' }, { status: 403 });
            }
        }

        const updates: Record<string, unknown> = {};
        if (accountType !== undefined) updates.account_type = accountType;
        if (suspend !== undefined) {
            updates.is_suspended = suspend;
            updates.suspended_at = suspend ? new Date().toISOString() : null;
            updates.suspended_reason = suspend ? 'Suspended by Owner' : null;
        }
        if (rateLimitOverride !== undefined) updates.rate_limit_override = rateLimitOverride;

        if (Object.keys(updates).length > 0) {
            const { error } = await adminSupabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/users' } });
                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
            }
        }

        if (ttsProvider !== undefined) {
            await adminSupabase
                .from('user_preferences')
                .upsert({ user_id: userId, tts_provider: ttsProvider }, { onConflict: 'user_id' });
        }

        await logSystemEvent({
            type: 'admin_action',
            userId: user.id,
            metadata: {
                route: 'owner/users',
                targetUserId: userId,
                changedFields: Object.keys(updates),
                updatedTtsProvider: ttsProvider !== undefined,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/users' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
