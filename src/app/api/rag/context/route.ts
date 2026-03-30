import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCorrelationIdFromRequest, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user) {
            return jsonWithCorrelationId({ chunks: [] }, { status: 401 });
        }

        const { query } = await req.json();

        if (!query || typeof query !== 'string') {
            return jsonWithCorrelationId({ chunks: [] }, { status: 400 });
        }

        const supabase = getServiceClient();
        const aiClient = getAIClient();

        const { embeddings } = await aiClient.embed(query, { correlationId });

        if (!embeddings || embeddings.length === 0) {
            return jsonWithCorrelationId({ chunks: [] });
        }

        const { data, error } = await supabase.rpc('match_knowledge_chunks', {
            query_embedding: embeddings[0],
            match_threshold: 0.5, // Standard threshold
            match_count: 3        // Return top 3 chunks
        });

        if (error) {
            console.error('[RAG API] DB Match Error:', error);
            return jsonWithCorrelationId({ chunks: [] }, { status: 500 });
        }

        return jsonWithCorrelationId({ chunks: data ?? [] });
    } catch (error) {
        console.error('[RAG API] Processing Error:', error);
        // Fail open - return empty array
        return jsonWithCorrelationId({ chunks: [] }, { status: 500 });
    }
}
