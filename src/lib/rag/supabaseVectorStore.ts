import { createServerSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { SearchResult, KnowledgeChunk } from './types';

export async function supabaseHybridSearch(query: string, limit = 3): Promise<SearchResult[]> {
    const supabase = await createServerSupabase();
    const client = getAIClient();

    // Get embedding for query
    // We use the same embed method as the ingestion script/vector store
    // getAIClient().embed returns { embeddings: number[][], ... }
    let queryVector: number[] | null = null;

    try {
        const { embeddings } = await client.embed(query);
        if (embeddings && embeddings.length > 0) {
            queryVector = embeddings[0];
        }
    } catch (error) {
        console.error('❌ [SupabaseVectorStore] Embedding failed:', error);
        // If embedding fails, we can't do vector search. 
        // We could fallback to keyword search if we implemented it via Postgres full text search,
        // but for now we'll throw or return empty.
        return [];
    }

    if (!queryVector) {
        return [];
    }

    // Vector search via RPC
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: queryVector,
        match_threshold: 0.5, // Lowered threshold slightly to ensure recall
        match_count: limit
    });

    if (error) {
        console.error('❌ [SupabaseVectorStore] RPC matching failed:', error);
        throw error;
    }

    if (!data) return [];

    // Map to SearchResult interface
    return data.map((row: any) => {
        // Construct a partial KnowledgeChunk with available data
        const chunk: KnowledgeChunk = {
            id: row.id,
            topic: row.topic || 'unknown',
            subtopic: row.subtopic || 'unknown',
            title: row.title || 'Untitled',
            content: row.content || '',
            // Fill required fields with defaults as they aren't returned by RPC currently
            keywords: [],
            difficulty: 'medium',
            patterns: []
        };

        return {
            chunk,
            score: row.similarity,
            matchType: 'semantic' as const
        };
    });
}
