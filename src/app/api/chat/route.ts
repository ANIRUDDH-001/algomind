import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { incrementUserUsage, checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getPhaseContext, type InterviewPhase } from '@/lib/rag/phase-retriever';
import type { InterviewState } from '@/lib/interview/state-machine';

export async function POST(req: NextRequest) {
    try {

        interface ChatRequestBody {
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            systemPrompt?: string;
            problemContext?: {
                title?: string;
                content?: string;
                ragContext?: string;
                tags?: string[];
            };
            guestMode?: boolean;
            companyPersona?: string;
            kaiMemory?: string;
            interviewState?: InterviewState;
            sessionId?: string;
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
        const { messages, systemPrompt, problemContext, guestMode, companyPersona, kaiMemory, interviewState, sessionId: clientSessionId } = body;

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
            if (process.env.NODE_ENV === 'development') {
                console.log(`👤 [Chat API] Authenticated user: ${user.id}`);
            }
            if (!guestMode) {
                const rateLimit = await checkUserRateLimit(user.id);
                if (!rateLimit.allowed) {
                    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
                }
            }
        } else if (guestMode) {
            console.log('👀 [Chat API] Guest mode access');
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? 'unknown';
            const ipRateLimit = await checkIpRateLimit(ip, { maxRequests: 20, windowSeconds: 3600 });
            if (!ipRateLimit.success) {
                return NextResponse.json({ error: 'Guest rate limit exceeded. Please try again later.' }, { status: 429 });
            }
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // ── Phase-aware RAG ───────────────────────────────────────────────
        const STATE_TO_PHASE: Record<string, InterviewPhase> = {
            'idle': 'intro',
            'problem-intro': 'intro',
            'user-thinking': 'approach',
            'ai-clarifying': 'approach',
            'user-solving': 'coding',
            'ai-feedback': 'coding',
            'solution-review': 'wrap-up',
            'assessment': 'wrap-up',
            'completed': 'wrap-up',
        };

        let ragContext = '';
        if (!guestMode && interviewState && problemContext?.title) {
            // Server-side phase-aware RAG
            const phase = STATE_TO_PHASE[interviewState] ?? 'approach';
            try {
                const phaseRag = await getPhaseContext(
                    supabase,
                    clientSessionId || 'default',
                    phase,
                    problemContext.title,
                    problemContext.tags ?? []
                );
                if (phaseRag && phaseRag !== 'No relevant context found.') {
                    ragContext = phaseRag;
                    console.log(`📚 [RAG] Phase-aware context (${phase}): ${ragContext.length} chars`);
                }
            } catch (err) {
                console.warn('⚠️ [RAG] Phase-aware retrieval failed, falling back to static:', err);
            }
        }

        // Fallback to static pre-embedded context
        if (!ragContext && problemContext?.ragContext && problemContext.ragContext.length > 0) {
            ragContext = problemContext.ragContext;
            console.log(`📚 [RAG] Using pre-embedded context (${ragContext.length} chars) - fallback`);
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

        // Use the full model registry with proper fallback (same as assess/chat route)
        const result = await client.generateResponse(messages, {
            preferredModel: 'gemini' as any, // Start with fastest Gemini, fall to Groq automatically
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500,
            enableLLMPass: false, // BUG-AI-004 regex only — saves one Groq RPM per request
        });

        if (!result.success) {
            console.error('❌ [AI] Generation failed. All models exhausted:', result.error);
            throw new Error(result.error || 'Failed to generate response after exhausting all models');
        }

        console.log(`✨ [AI] Response generated using ${result.modelUsed} (${result.provider})`);

        // Track usage for authenticated users
        if (user && !guestMode) {
            incrementUserUsage(user.id, supabase).catch(err =>
                console.error('❌ [Chat API] Failed to track usage:', err)
            );
        }

        return NextResponse.json({
            response: result.response,
            modelUsed: result.modelUsed,
            provider: result.provider,
        });

    } catch (error: unknown) {
        console.error('❌ [Chat API] Error:', error);
        void logSystemEvent({
            type: 'model_error',
            errorMessage: error instanceof Error ? error.message : String(error)
        });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
