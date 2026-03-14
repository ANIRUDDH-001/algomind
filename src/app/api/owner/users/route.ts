import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

export async function GET(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    // Use service role client for data reads (bypasses RLS)
    const adminSupabase = await createServiceRoleSupabase();
    let dbQuery = adminSupabase
        .from('profiles')
        .select('id, account_type, email, updated_at, rate_limit_override, is_suspended, suspended_reason, suspended_at')
        .order('updated_at', { ascending: false })
        .limit(100);

    if (query) {
        dbQuery = dbQuery.ilike('email', `%${query}%`);
    }

    const { data: users, error } = await dbQuery;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if the caller is an owner/co-owner
    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

        const updates: any = {};
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
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        if (ttsProvider !== undefined) {
            await adminSupabase
                .from('user_preferences')
                .upsert({ user_id: userId, tts_provider: ttsProvider }, { onConflict: 'user_id' });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
