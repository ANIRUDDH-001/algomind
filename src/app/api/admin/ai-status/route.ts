/**
 * @codesage
 * @file      src/app/api/admin/ai-status/route.ts
 * @purpose   Retrieves and returns the status of AI models and rate limiter usage.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/supabase/service, @/lib/ai/client, @/lib/auth/requireAdminForApi, @/lib/tracing/correlation
 * @apis      none
 * @db        model_registry
 * @state     none
 * @env       none
 * @issues    Flagged uncertain dead code / empty catch for rate limiter enrichment failure.
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getAIClient } from "@/lib/ai/client";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getCorrelationIdFromRequest, withCorrelationId, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        // 1. Admin Security Check
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return withCorrelationId(errorResponse, correlationId);

        // 2. Fetch model registry data
        const svc = getServiceClient();
        const { data: models, error } = await svc
            .from('model_registry')
            .select('model_id, provider, tier, is_active, is_verified, deprecated_at, notes, last_verified')
            .order('is_active', { ascending: false })
            .order('tier', { ascending: true });

        if (error) {
            return jsonWithCorrelationId(
                { error: 'Failed to fetch model registry' },
                { status: 500 }
            );
        }

        // 3. Optional rate limiter enrichment (non-fatal)
        let rateLimiterUsage: Record<string, unknown> = {};
        try {
            const client = getAIClient();
            const status = await client.getRateLimiterStatus();
            rateLimiterUsage = (status.usage as Record<string, unknown>) ?? {};
        } catch {
            // Ignore enrichment failures and still return model list.
        }

        const modelList = (models ?? []).map((model) => ({
            id: model.model_id,
            provider: model.provider,
            tier: model.tier,
            is_active: model.is_active,
            is_verified: model.is_verified,
            deprecated_at: model.deprecated_at,
            notes: model.notes,
            last_verified: model.last_verified,
            rateLimiterData: rateLimiterUsage[model.model_id] ?? null,
        }));

        return jsonWithCorrelationId({ models: modelList });

    } catch (error) {
        return jsonWithCorrelationId(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
