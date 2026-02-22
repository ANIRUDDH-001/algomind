import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';

export async function GET() {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    const serviceClient = getServiceClient();

    // Fetch all profiles where account_type is 'employer'
    const { data, error } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('account_type', 'employer')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employers: data });
}
