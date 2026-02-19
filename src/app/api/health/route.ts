import { NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";

export async function GET() {
    try {
        const client = getAIClient();

        // Check health of all providers
        const health = await client.runHealthCheck();
        const rateLimits = client.getRateLimitStatus();

        const isHealthy = Object.values(health).some(h => h.available);

        if (!isHealthy) {
            return NextResponse.json(
                {
                    status: "error",
                    message: "No AI providers available",
                    health,
                },
                { status: 503 }
            );
        }

        return NextResponse.json({
            status: "ok",
            providers: health,
            rateLimits: {
                remaining: rateLimits.remaining,
                usage: Object.fromEntries(
                    Object.entries(rateLimits.usage).map(([k, v]) => [k, { minute: parseInt(v.rpm), day: parseInt(v.rpd) }])
                ),
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
