import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { getVectorStore } from '@/lib/rag/vectorStore';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, systemPrompt, problemContext } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Get latest message content or problem context for RAG retrieval
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const query = lastUserMessage ? lastUserMessage.content : (problemContext ? `${problemContext.title} ${problemContext.content}` : '');

        // Initialize and Load Vector Store
        const vectorStore = getVectorStore();
        await vectorStore.load(); // This loads embeddings.json

        // Perform RAG retrieval
        let ragContext = '';
        if (query) {
            try {
                const searchResults = await vectorStore.hybridSearch(query, 3);
                ragContext = searchResults.map(r => r.chunk.content).join('\n---\n');
            } catch (searchError) {
                console.warn('RAG search failed:', searchError);
                // Continue without RAG if search fails
            }
        }

        const client = getAIClient();

        // Enhance system prompt with RAG context
        const enhancedSystemPrompt = systemPrompt + (ragContext ? `\n\n### RELEVANT KNOWLEDGE BASE CONTEXT:\n${ragContext}` : '');

        const result = await client.chat(messages, {
            systemPrompt: enhancedSystemPrompt,
            temperature: 0.7,
            maxTokens: 1024
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
