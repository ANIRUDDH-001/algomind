import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';

// ONLY the primary owner can add or remove co-owners.
export async function POST(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Strict primary owner check
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .single();

    if (profile?.account_type !== 'owner') {
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
            void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, coOwner });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Strict primary owner check
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .single();

    if (profile?.account_type !== 'owner') {
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
            void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/co-owners' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
