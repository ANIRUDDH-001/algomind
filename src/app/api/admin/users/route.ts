import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';

export async function GET(request: Request) {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'employer';
    const search = searchParams.get('search')?.trim();

    try {
        const supabase = getServiceClient();
        let query = supabase
            .from('profiles')
            .select('id, full_name, email, company_name, account_type');

        if (search) {
            // Email autocomplete: search all non-employer users
            query = query
                .ilike('email', `%${search}%`)
                .neq('account_type', 'employer')
                .order('email')
                .limit(5);
        } else {
            query = query
                .eq('account_type', type)
                .order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch users:', error);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const { errorResponse } = await requireAdminForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await request.json();
        const { email, accountType, companyName } = body;

        if (!email || !accountType) {
            return NextResponse.json(
                { error: 'Email and account type are required' },
                { status: 400 }
            );
        }

        const supabase = getServiceClient();

        // Use the profiles table email field to find the user
        const updateData: { account_type: string, company_name?: string | null } = {
            account_type: accountType
        };

        if (companyName !== undefined) {
            updateData.company_name = companyName;
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('email', email)
            .select()
            .single();

        if (error) {
            console.error('Failed to update user role:', error);
            // If the error is PGRST116, it means no rows were matched
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: data });
    } catch (error) {
        console.error('Error updating user role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
