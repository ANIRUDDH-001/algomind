import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { getVectorStore } from '@/lib/rag/vectorStore';

export async function POST(req: NextRequest) {
    try {

        let body: any = {};
        try {
            const text = await req.text();
            if (text && text.trim()) {
                body = JSON.parse(text);
            }
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }
        const { messages, systemPrompt, problemContext } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Get latest message content or problem context for RAG retrieval
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const query = lastUserMessage ? lastUserMessage.content : (problemContext ? `${problemContext.title} ${problemContext.content}` : '');

        console.log('🔍 [RAG] Query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));

        // Initialize and Load Vector Store
        const vectorStore = getVectorStore();
        await vectorStore.load(); // This loads embeddings.json

        console.log(`🔮 [RAG] Loaded ${vectorStore.size()} chunks from vector store`);

        // Perform RAG retrieval - use pre-embedded context if provided (for guests)
        let ragContext = '';
        if (problemContext?.ragContext && problemContext.ragContext.length > 0) {
            // Use pre-embedded RAG context (guest users with hardcoded problems)
            ragContext = problemContext.ragContext;
            console.log(`📚 [RAG] Using pre-embedded context (${ragContext.length} chars) - saving API calls`);
        } else if (query) {
            // Perform live RAG retrieval (authenticated users)
            try {
                const searchResults = await vectorStore.hybridSearch(query, 3);

                if (searchResults.length > 0) {
                    console.log(`✅ [RAG] Found ${searchResults.length} relevant chunks:`);
                    searchResults.forEach((r, idx) => {
                        console.log(`   ${idx + 1}. ${r.chunk.topic}/${r.chunk.subtopic} (${r.matchType}, score: ${r.score.toFixed(3)})`);
                    });

                    ragContext = searchResults.map(r =>
                        `### ${r.chunk.title}\n${r.chunk.content}`
                    ).join('\n\n---\n\n');
                } else {
                    console.log('⚠️ [RAG] No relevant chunks found for query');
                }
            } catch (searchError) {
                console.warn('❌ [RAG] Search failed:', searchError);
                // Continue without RAG if search fails
            }
        }

        const client = getAIClient();

        // Enhance system prompt with RAG context
        const enhancedSystemPrompt = systemPrompt + (ragContext
            ? `\n\n### RELEVANT DSA KNOWLEDGE (use this to give accurate, educational feedback):\n${ragContext}`
            : '');

        if (ragContext) {
            console.log(`📚 [AI] Injecting RAG context (${ragContext.length} chars)`);
        }

        const result = await client.generateResponse(messages, {
            preferredModel: 'auto',
            category: 'speed', // Hints/Chat
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500
        });

        if (!result.success) {
            console.error(`❌ [AI] Generation failed. Attempted models: ${result.attemptedModels.join(', ')}`);
            throw new Error(result.error || "Failed to generate response");
        }

        console.log(`✨ [AI] Response generated using ${result.modelUsed} (${result.provider})`);
        if (result.routing?.smartRoutingUsed) {
            console.log(
                `🧠 [AI] Smart routing: ${result.routing.classification.complexity} → ` +
                `${result.routing.routedTo} (${result.routing.classificationTimeMs.toFixed(1)}ms classify, ` +
                `${result.routing.totalTimeMs.toFixed(0)}ms total)`
            );
        }

        return NextResponse.json({
            response: result.response,
            modelUsed: result.modelUsed,
            provider: result.provider,
            ...(result.routing ? {
                routing: {
                    complexity: result.routing.classification.complexity,
                    category: result.routing.classification.category,
                    suggestedModel: result.routing.routedTo,
                    classificationTimeMs: Math.round(result.routing.classificationTimeMs),
                }
            } : {}),
        });

    } catch (error: any) {
        console.error('❌ [Chat API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
