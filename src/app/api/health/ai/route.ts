import { NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";

export async function GET() {
    try {
        const client = getAIClient();
        const health = await client.checkAllModels();
        const healthyCount = Object.values(health).filter(h => h.available).length;

        // As per requirement: "status: healthyCount >= 7 ? 'healthy' : 'degraded'"
        // Total 14 models (7 Groq + 7 Gemini). 
        // If one provider is down (e.g. Gemini), count will be 7 -> Healthy.
        // If both down, count 0 -> Degraded.

        return NextResponse.json({
            status: healthyCount >= 7 ? 'healthy' : 'degraded',
            healthyCount,
            models: health
        });

    } catch (error) {
        return NextResponse.json(
            { status: 'error', message: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
