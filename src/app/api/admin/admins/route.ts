import { NextResponse } from "next/server";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';

async function getMasterAdminEmail(): Promise<string> {
    const { data } = await getServiceClient()
        .from('system_config')
        .select('value')
        .eq('key', 'primary_owner_email')
        .single();
    return data?.value ?? '';
}

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const supabaseAdmin = getServiceClient();
        const { data: admins, error } = await supabaseAdmin
            .from('admin_users') // ← FIXED: was 'adminusers'
            .select('id, email, name, added_at, added_by')
            .order('added_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(admins || []);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const { user, errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const { email } = body as { email?: string };

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        const { data: existing } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: "Already an admin" }, { status: 409 });
        }

        const { error } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .insert({ email, added_by: user!.email });

        if (error) throw error;
        return NextResponse.json({ success: true, email });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const { email } = body as { email?: string };

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const masterEmail = await getMasterAdminEmail();
        if (masterEmail && email === masterEmail) {
            return NextResponse.json(
                { error: "Cannot delete master admin" },
                { status: 403 }
            );
        }

        const supabaseAdmin = getServiceClient();

        const { count, error: countError } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        if ((count || 0) <= 1) {
            return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .delete()
            .eq('email', email);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
