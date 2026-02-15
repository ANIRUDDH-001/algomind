import { NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
    try {
        // 1. Admin Security Check
        const supabase = await createServerSupabase();

        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check admin role via RPC (matches client-side useAdmin logic)
        const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');

        if (rpcError || !isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Fetch Status
        const client = getAIClient();
        const status = client.getRateLimitStatus();

        return NextResponse.json(status);

    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
