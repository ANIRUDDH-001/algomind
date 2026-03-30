import { NextRequest, NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getCorrelationIdFromRequest, withCorrelationId, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export async function GET(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        // 1. Admin Security Check
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return withCorrelationId(errorResponse, correlationId);

        // 2. Fetch Status
        const client = getAIClient();
        const status = await client.getRateLimiterStatus();

        return jsonWithCorrelationId(status);

    } catch (error) {
        return jsonWithCorrelationId(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
