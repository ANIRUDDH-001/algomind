import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildRagResponse, mapRpcChunk } from '@/lib/rag/contract';
import { getCorrelationIdFromRequest, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user) {
            return jsonWithCorrelationId({ error: 'Unauthorized', ...buildRagResponse('', []) }, { status: 401 });
        }

        const { query } = await req.json();

        if (!query || typeof query !== 'string') {
            return jsonWithCorrelationId({ error: 'Query is required', ...buildRagResponse('', []) }, { status: 400 });
        }

        const supabase = getServiceClient();
        const aiClient = getAIClient();

        const { embeddings } = await aiClient.embed(query, { correlationId });

        if (!embeddings || embeddings.length === 0) {
            return jsonWithCorrelationId(buildRagResponse(query, []));
        }

        const { data, error } = await supabase.rpc('match_knowledge_chunks', {
            query_embedding: embeddings[0],
            match_threshold: 0.5, // Standard threshold
            match_count: 3        // Return top 3 chunks
        });

        if (error) {
            console.error('[RAG API] DB Match Error:', error);
            return jsonWithCorrelationId({ error: 'Failed to retrieve context', ...buildRagResponse(query, []) }, { status: 500 });
        }

        const chunks = Array.isArray(data)
            ? data.map((row) => mapRpcChunk(row as Record<string, unknown>))
            : [];

        return jsonWithCorrelationId(buildRagResponse(query, chunks));
    } catch (error) {
        console.error('[RAG API] Processing Error:', error);
        // Fail open - return empty array
        return jsonWithCorrelationId({ error: 'Failed to retrieve context', ...buildRagResponse('', []) }, { status: 500 });
    }
}
