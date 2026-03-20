import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { companyName, inviteCode } = await req.json();

    if (!inviteCode) {
        return NextResponse.json(
            { error: 'An invite code is required. Contact admin to get access.' },
            { status: 403 }
        );
    }

        const serviceClient = getServiceClient();

    // Validate invite code
        const { data: invite, error: inviteError } = await serviceClient
        .from('employer_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 403 });
        }

    // Check if invite is expired
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invite code has expired' }, { status: 403 });
        }

    // Strictly check if the invite email matches the user email
        if (!invite.email || invite.email.toLowerCase() !== user.email?.toLowerCase()) {
            return NextResponse.json({ error: 'This invite code is for a different email address' }, { status: 403 });
        }

    // Check if already used
        if (invite.used_by) {
            return NextResponse.json({ error: 'This invite code has already been used' }, { status: 403 });
        }

    // Validate company name
        const trimmedName = (companyName || invite.company_name || '').trim();
        if (trimmedName.length < 2) {
            return NextResponse.json({ error: 'Company name required' }, { status: 400 });
        }

    // Mark invite as used
        await serviceClient
            .from('employer_invites')
            .update({ used_by: user.id, used_at: new Date().toISOString(), is_active: false })
            .eq('id', invite.id);

    // Upgrade account
        await serviceClient
            .from('profiles')
            .update({ account_type: 'employer', company_name: trimmedName })
            .eq('id', user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[employer/upgrade] Error:', errMsg);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'employer/upgrade' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
