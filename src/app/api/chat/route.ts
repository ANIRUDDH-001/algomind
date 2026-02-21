import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseHybridSearch } from '@/lib/rag/supabaseVectorStore';
import { incrementUserUsage } from '@/lib/rate-limit/user-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function POST(req: NextRequest) {
    try {

        interface ChatRequestBody {
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            systemPrompt?: string;
            problemContext?: {
                title?: string;
                content?: string;
                ragContext?: string;
            };
            guestMode?: boolean;
            companyPersona?: string;
            kaiMemory?: string;
        }

        let body: ChatRequestBody = { messages: [] };
        try {
            const text = await req.text();
            if (text && text.trim()) {
                body = JSON.parse(text);
            }
        } catch (_parseError) {
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }
        const { messages, systemPrompt, problemContext, guestMode, companyPersona, kaiMemory } = body;

        // 🔒 Auth Check
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!guestMode && !user) {
            console.warn('⛔ [Chat API] Unauthorized access attempt');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (user) {
            console.log(`👤 [Chat API] Authenticated user: ${user.id}`);
        } else if (guestMode) {
            console.log('👀 [Chat API] Guest mode access');
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Get latest message content or problem context for RAG retrieval
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const query = lastUserMessage ? lastUserMessage.content : (problemContext ? `${problemContext.title} ${problemContext.content}` : '');

        console.log('🔍 [RAG] Query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));

        // Initialize and Load Vector Store

        // Perform RAG retrieval - use pre-embedded context if provided (for guests)
        let ragContext = '';
        if (problemContext?.ragContext && problemContext.ragContext.length > 0) {
            // Use pre-embedded RAG context (guest users with hardcoded problems)
            ragContext = problemContext.ragContext;
            console.log(`📚 [RAG] Using pre-embedded context (${ragContext.length} chars) - saving API calls`);
        } else if (query) {
            // Perform live RAG retrieval (authenticated users) via Supabase
            try {
                // Determine limit based on query complexity/length if needed, default to 3
                const searchResults = await supabaseHybridSearch(query, 3);

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
                console.warn('❌ [RAG] Embedding failed — proceeding without RAG context:', searchError);
                void logSystemEvent({
                    type: 'embedding_failed',
                    errorMessage: searchError instanceof Error ? searchError.message : String(searchError)
                });
                // Continue without RAG if search fails
            }
        }

        const client = getAIClient();

        // Enhance system prompt with RAG context and Company Persona
        let enhancedSystemPrompt = systemPrompt || '';

        if (companyPersona) {
            enhancedSystemPrompt += '\n\n## COMPANY INTERVIEW STYLE\n' + companyPersona;
            console.log(`🏢 [AI] Applying Company Persona`);
        }

        if (kaiMemory) {
            enhancedSystemPrompt += '\n\n## YOUR MEMORY OF THIS STUDENT\n' + kaiMemory +
                '\n\nUse this naturally. Do NOT announce that you remember them. Simply demonstrate it through your questions and observations.';
            console.log('🧠 [AI] Injecting Kai memory');
        }

        if (ragContext) {
            enhancedSystemPrompt += `\n\n### RELEVANT DSA KNOWLEDGE (use this to give accurate, educational feedback):\n${ragContext}`;
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

        // 💾 Track usage for authenticated users
        if (user && !guestMode) {
            // Fire and forget - don't block response
            incrementUserUsage(user.id, supabase).catch(err =>
                console.error('❌ [Chat API] Failed to track usage:', err)
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

    } catch (error: unknown) {
        console.error('❌ [Chat API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
