import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { upgradeToEmployer } from '@/lib/auth/account-type';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { companyName } = body;

        if (!companyName || typeof companyName !== 'string') {
            return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
        }

        const trimmedName = companyName.trim();
        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return NextResponse.json({ error: 'Company name must be between 2 and 100 characters' }, { status: 400 });
        }

        await upgradeToEmployer(user.id, trimmedName);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[EMPLOYER_UPGRADE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
