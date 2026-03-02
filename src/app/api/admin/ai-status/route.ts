import { NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';

export async function GET() {
    try {
        // 1. Admin Security Check
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

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
