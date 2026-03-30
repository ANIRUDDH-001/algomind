import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationIdFromRequest, withCorrelationId, withCorrelationIdHeaders } from '@/lib/tracing/correlation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return withCorrelationId(errorResponse, correlationId);

        const supabase = await createServerSupabase();
        const view = new URL(req.url).searchParams.get('view') || 'gaps';

        if (view === 'gaps') {
        const { data } = await supabase
            .from('knowledge_gaps')
            .select('*')
            .in('status', ['new', 'in-progress'])
            .order('priority', { ascending: false })
            .order('upvotes', { ascending: false })
            .limit(100);

            return jsonWithCorrelationId({ gaps: data || [] });
        }

        if (view === 'chunks') {
        const { data, count } = await supabase
            .from('knowledge_chunks')
            .select('id, topic, subtopic, title, usage_count, effectiveness_score, embedding_status, created_at',
                { count: 'exact' })
            .order('usage_count', { ascending: false })
            .limit(50);

        // Get embedding coverage stats
        const { data: stats } = await supabase
            .from('knowledge_chunks')
            .select('embedding_status')
            .then(r => ({
                data: r.data?.reduce((acc, row) => {
                    acc[row.embedding_status] = (acc[row.embedding_status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            }));

            return jsonWithCorrelationId({ chunks: data || [], total: count, stats });
        }

        return jsonWithCorrelationId({ error: 'Invalid view' }, { status: 400 });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[admin/rag] Error:', errMsg);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, correlationId, metadata: { route: 'admin/rag' } });
        return jsonWithCorrelationId({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const correlationId = getCorrelationIdFromRequest(req);
    const jsonWithCorrelationId = (body: unknown, init?: ResponseInit) =>
        NextResponse.json(body, { ...init, headers: withCorrelationIdHeaders(init?.headers, correlationId) });

    try {
        const { errorResponse, user } = await requireAdminForApi();
        if (errorResponse) return withCorrelationId(errorResponse, correlationId);

        const supabase = await createServerSupabase();
        const body = await req.json();
        const { action } = body;

        if (action === 'draft') {
        // AI drafts an answer for the gap
        const { gapId } = body;
        const { data: gap } = await supabase
            .from('knowledge_gaps')
            .select('*')
            .eq('id', gapId)
            .single();

        if (!gap) return jsonWithCorrelationId({ error: 'Gap not found' }, { status: 404 });

        const client = getAIClient();
        const result = await client.generateCompletion([{
            role: 'user',
            content: `Write a concise, accurate technical explanation for this DSA interview question gap:
            
Question: "${gap.user_query}"
Topic: ${gap.topic || 'Data Structures & Algorithms'}

Format your response as:
TITLE: [Short title for this knowledge chunk]
CONTENT: [Detailed explanation, 200-400 words, with examples and code snippets where relevant]
KEYWORDS: [comma-separated list of keywords]`
        }], { maxTokens: 600, preferredProvider: 'gemini', correlationId });

        // Parse the AI response
        const text = result.response;
        const titleMatch = text?.match(/TITLE:\s*(.+)/);
        const contentMatch = text?.match(/CONTENT:\s*([\s\S]+?)(?=KEYWORDS:|$)/);
        const keywordsMatch = text?.match(/KEYWORDS:\s*(.+)/);

        // Update gap with AI draft
        await supabase
            .from('knowledge_gaps')
            .update({
                suggested_title: titleMatch?.[1]?.trim(),
                suggested_content: contentMatch?.[1]?.trim(),
                ai_drafted: true,
                status: 'in-progress'
            })
            .eq('id', gapId);

            return jsonWithCorrelationId({
                title: titleMatch?.[1]?.trim(),
                content: contentMatch?.[1]?.trim(),
                keywords: keywordsMatch?.[1]?.split(',').map((k: string) => k.trim()),
            });
        }

        if (action === 'approve') {
        // Admin approves content and triggers embedding
        const { gapId, title, content, topic, subtopic, keywords, difficulty } = body;

        // Insert knowledge chunk
        const { data: chunk, error } = await supabase
            .from('knowledge_chunks')
            .insert({
                topic: topic || 'dsa',
                subtopic: subtopic || 'general',
                title,
                content,
                keywords: keywords || [],
                difficulty: difficulty || 'medium',
                embedding_status: 'pending',
                status: 'active',
                source_gap_id: gapId || null,
            })
            .select()
            .single();

        if (error || !chunk) {
            return jsonWithCorrelationId({ error: 'Failed to create chunk' }, { status: 500 });
        }

        // Mark gap as resolved if gapId exists
        if (gapId) {
            await supabase
                .from('knowledge_gaps')
                .update({
                    status: 'resolved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user!.id,
                })
                .eq('id', gapId);
        }

        // Trigger background embedding (fire and forget)
        triggerEmbedding(chunk.id).catch(console.error);

            return jsonWithCorrelationId({ success: true, chunkId: chunk.id });
        }

        if (action === 'process_pending') {
        const { data: pending } = await supabase
            .from('knowledge_chunks')
            .select('id')
            .in('embedding_status', ['pending', 'failed']);

        const count = pending?.length || 0;
        // Fire and forget for each
        for (const chunk of pending || []) {
            triggerEmbedding(chunk.id).catch(console.error);
        }

            return jsonWithCorrelationId({ success: true, count });
        }

        return jsonWithCorrelationId({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[admin/rag] Error:', errMsg);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, correlationId, metadata: { route: 'admin/rag' } });
        return jsonWithCorrelationId({ error: 'Internal server error' }, { status: 500 });
    }
}

async function triggerEmbedding(chunkId: string): Promise<void> {
    // Inline embedding (acceptable for admin flow, not user-facing)
    const supabase = await (await import('@/lib/supabase/server')).createServerSupabase();
    const client = getAIClient();

    await supabase
        .from('knowledge_chunks')
        .update({ embedding_status: 'processing' })
        .eq('id', chunkId);

    const { data: chunk } = await supabase
        .from('knowledge_chunks')
        .select('topic, subtopic, content, keywords')
        .eq('id', chunkId)
        .single();

    if (!chunk) return;

    const textToEmbed = `${chunk.topic}${chunk.subtopic ? ': ' + chunk.subtopic : ''}\n${chunk.content}\n${chunk.keywords?.join(' ')}`;

    const { embeddings } = await client.embed(textToEmbed);

    await supabase
        .from('knowledge_chunks')
        .update({
            embedding: embeddings[0],
            embedding_status: 'done',
            embedding_model: 'gemini-embedding-001',
        })
        .eq('id', chunkId);
}
