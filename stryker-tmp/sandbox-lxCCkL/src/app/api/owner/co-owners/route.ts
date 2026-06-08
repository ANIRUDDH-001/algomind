/**
 * @codesage
 * @file      src/app/api/owner/co-owners/route.ts
 * @purpose   Allows the primary owner to grant or revoke co-owner access.
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/monitoring/events, @/lib/auth/account-type
 * @apis      None
 * @db        co_owners
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';
import { isPrimaryOwner } from '@/lib/auth/account-type';

// ONLY the primary owner can add or remove co-owners.
export async function POST(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        return NextResponse.json({ error: 'Only the primary owner can grant co-owner access' }, { status: 403 });
    }

    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

        const { data: coOwner, error } = await supabase
            .from('co_owners')
            .insert({
                email,
                granted_by: user.id
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return NextResponse.json({ error: 'User is already a co-owner' }, { status: 400 });
            const errMsg = error instanceof Error ? error.message : String(error);
            await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        await logSystemEvent({
            type: 'admin_action',
            userId: user.id,
            metadata: {
                route: 'owner/co-owners',
                action: 'grant_co_owner',
                coOwnerId: coOwner?.id,
            },
        });

        return NextResponse.json({ success: true, coOwner });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        return NextResponse.json({ error: 'Only the primary owner can revoke co-owner access' }, { status: 403 });
    }

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabase
            .from('co_owners')
            .delete()
            .eq('id', id);

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        await logSystemEvent({
            type: 'admin_action',
            userId: user.id,
            metadata: {
                route: 'owner/co-owners',
                action: 'revoke_co_owner',
                coOwnerId: id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
