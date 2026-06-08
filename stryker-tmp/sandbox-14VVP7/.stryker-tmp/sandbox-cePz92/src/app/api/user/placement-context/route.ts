// @ts-nocheck
// 
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
        placementMonth?: string;
        targetCompanies?: unknown;
    } | null;

    const placementMonth = body?.placementMonth?.trim() ?? '';
    const targetCompanies = body?.targetCompanies;

    if (!placementMonth || !DATE_REGEX.test(placementMonth)) {
        return NextResponse.json({ error: 'Invalid placementMonth' }, { status: 400 });
    }

    if (!Array.isArray(targetCompanies) || targetCompanies.some((company) => typeof company !== 'string')) {
        return NextResponse.json({ error: 'Invalid targetCompanies' }, { status: 400 });
    }

    const normalizedCompanies = targetCompanies
        .map((company) => company.trim())
        .filter(Boolean);

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: user.id,
            placement_month: placementMonth,
            target_companies: normalizedCompanies,
        }, { onConflict: 'user_id' });

    if (error) {
        return NextResponse.json({ error: 'Failed to save placement context' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
