import { NextResponse, NextRequest } from "next/server";
import { getRateLimiter } from "@/lib/ai/rate-limiter";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    try {
        // 1. Admin Security Check
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: adminRecord } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', user.email!)
            .single();

        if (!adminRecord) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Parse Body
        const body = await req.json();
        const { modelId } = body;

        if (!modelId || typeof modelId !== 'string') {
            return NextResponse.json({ error: "Invalid modelId" }, { status: 400 });
        }

        // 3. Reset Model
        const rateLimiter = getRateLimiter();
        rateLimiter.resetModel(modelId);

        if (process.env.NODE_ENV === 'development') {
            console.log(`[Admin] Reset rate limits for model: ${modelId} by ${user.email}`);
        }

        return NextResponse.json({
            success: true,
            message: `Rate limits reset for ${modelId}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
