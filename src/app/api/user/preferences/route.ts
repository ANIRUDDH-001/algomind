import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
        email_notifications?: unknown;
        practice_reminders?: unknown;
        placement_month?: unknown;
        target_companies?: unknown;
    } | null;

    if (!body) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
    };

    if ('email_notifications' in body) {
        if (typeof body.email_notifications !== 'boolean') {
            return NextResponse.json({ error: 'Invalid email_notifications' }, { status: 400 });
        }
        updates.email_notifications = body.email_notifications;
    }

    if ('practice_reminders' in body) {
        if (typeof body.practice_reminders !== 'boolean') {
            return NextResponse.json({ error: 'Invalid practice_reminders' }, { status: 400 });
        }
        updates.practice_reminders = body.practice_reminders;
    }

    if ('placement_month' in body) {
        if (
            body.placement_month !== null &&
            (typeof body.placement_month !== 'string' || !DATE_REGEX.test(body.placement_month))
        ) {
            return NextResponse.json({ error: 'Invalid placement_month' }, { status: 400 });
        }
        updates.placement_month = body.placement_month;
    }

    if ('target_companies' in body) {
        if (
            body.target_companies !== null &&
            (!Array.isArray(body.target_companies) || body.target_companies.some((company) => typeof company !== 'string'))
        ) {
            return NextResponse.json({ error: 'Invalid target_companies' }, { status: 400 });
        }
        updates.target_companies = body.target_companies;
    }

    if (Object.keys(updates).length === 2) {
        return NextResponse.json({ error: 'No supported preference fields provided' }, { status: 400 });
    }

    const { error } = await supabase
        .from('user_preferences')
        .upsert(updates, { onConflict: 'user_id' });

    if (error) {
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
