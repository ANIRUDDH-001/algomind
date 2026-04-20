import { NextResponse, NextRequest } from "next/server";
import { getRateLimiter } from "@/lib/ai/rate-limiter";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';

export async function POST(req: NextRequest) {
    try {
        // 1. Admin Security Check
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

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
            console.info(`[Admin] Reset rate limits for model: ${modelId}`);
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
