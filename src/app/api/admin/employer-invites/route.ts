import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { nanoid } from 'nanoid';

export async function GET() {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
        .from('employer_invites')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites: data });
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireAdminForApi();
    if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { email, companyName, expiresAt } = body;

    if (!companyName || typeof companyName !== 'string') {
        return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email is required to generate an employer invite' }, { status: 400 });
    }

    const inviteCode = nanoid(10);
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
        .from('employer_invites')
        .insert({
            invite_code: inviteCode,
            email: email.trim().toLowerCase(),
            company_name: companyName.trim(),
            expires_at: expiresAt || null,
            created_by: user.id
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invite: data });
}

export async function DELETE(req: NextRequest) {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const { error } = await serviceClient
        .from('employer_invites')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
