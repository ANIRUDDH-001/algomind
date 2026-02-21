import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceClient } from '@/lib/supabase/service';

async function verifyAdminForApi() {
    const supabase = await createServerSupabase();

    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
        return null;
    }

    const { data: adminRecord } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email!)
        .single();

    if (!adminRecord) {
        return null;
    }

    return user;
}



export async function GET() {
    try {
        const user = await verifyAdminForApi();
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabaseAdmin = getServiceClient();
        const { data: admins, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, email, added_at')
            .order('added_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(admins || []);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAdminForApi();
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { email } = body as { email?: string };

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        const { data: existing } = await supabaseAdmin
            .from('admin_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: "Already an admin" }, { status: 409 });
        }

        const { error } = await supabaseAdmin
            .from('admin_users')
            .insert({ email, added_by: user.email });

        if (error) throw error;

        return NextResponse.json({ success: true, email });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await verifyAdminForApi();
        if (!user) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { email } = body as { email?: string };

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        const { count, error: countError } = await supabaseAdmin
            .from('admin_users')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        if ((count || 0) <= 1) {
            return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('admin_users')
            .delete()
            .eq('email', email);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
