/**
 * @codesage
 * @file      src/app/api/health/ai/route.ts
 * @purpose   Health check endpoint for verifying AI model availability.
 * @tech      Next.js
 * @connects  @/lib/ai/client, @/lib/tracing/correlation
 * @apis      AI Provider endpoints (via client.checkAllModels)
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextRequest, NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";
import { getCorrelationIdFromRequest, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export async function GET(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        const client = getAIClient();
        const health = await client.checkAllModels();
        const healthyCount = Object.values(health).filter(h => h.available).length;

        // As per requirement: "status: healthyCount >= 7 ? 'healthy' : 'degraded'"
        // Total 14 models (7 Groq + 7 Gemini). 
        // If one provider is down (e.g. Gemini), count will be 7 -> Healthy.
        // If both down, count 0 -> Degraded.

        return jsonWithCorrelationId({
            status: healthyCount >= 7 ? 'healthy' : 'degraded',
            healthyCount,
            models: health
        });

    } catch (error) {
        return jsonWithCorrelationId(
            { status: 'error', message: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
