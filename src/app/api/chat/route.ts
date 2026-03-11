import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { incrementUserUsage, checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { getPhaseContext, type InterviewPhase } from '@/lib/rag/phase-retriever';
import type { InterviewState } from '@/lib/interview/state-machine';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { detectSpokenLanguage } from '@/lib/voice/language-detector';

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
        const { messages, systemPrompt, problemContext, guestMode, companyPersona, interviewState, sessionId: clientSessionId } = body;

        // Read Hinglish feature flag once — used for language detection and prompt injection
        const hinglishEnabled = await getGlobalFeatureFlag('ENABLE_HINGLISH_SUPPORT');

        // 🔒 Auth Check
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch user's Hinglish preference (only relevant if global flag is ON)
        let userHinglishEnabled = false;
        if (user) {
            const { data: userPref } = await supabase
                .from('user_preferences')
                .select('hinglish_enabled')
                .eq('user_id', user.id)
                .maybeSingle();
            userHinglishEnabled = userPref?.hinglish_enabled ?? false;
        }

        // Detect spoken language from the most recent user turn
        const lastUserMessage = [...(messages || [])].reverse().find((m: { role: string }) => m.role === 'user');
        
        // Per-user preference: only activates if global flag is also ON
        const hinglishActive = hinglishEnabled && userHinglishEnabled;
        const spokenLanguage: 'english' | 'hinglish' =
            (hinglishActive && lastUserMessage)
                ? detectSpokenLanguage(lastUserMessage.content ?? '')
                : 'english';
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
            const ipRateLimit = await checkIpRateLimit(ip, { maxRequests: 100, windowSeconds: 86400 });
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
            enhancedSystemPrompt += `\n\n<company_persona>\n${companyPersona}\n</company_persona>`;
            console.log(`🏢 [AI] Applying Company Persona`);
        }

        // Only inject server RAG if it differs from what the client already sent
        if (ragContext && ragContext !== problemContext?.ragContext) {
            enhancedSystemPrompt += `\n\n<server_rag_context>\n${ragContext}\n</server_rag_context>`;
        }

        // Append Hinglish instruction block when candidate is detected as Hinglish speaker
        const hinglishBlock = (hinglishEnabled && spokenLanguage === 'hinglish')
            ? '\n\nSPOKEN LANGUAGE: Candidate is speaking Hinglish. Mirror naturally with Hindi fillers ' +
            '(yaar, matlab, toh, basically, dekho). Technical terms stay English. NO Devanagari script.'
            : '';
        enhancedSystemPrompt += hinglishBlock;

        // Use the full model registry with proper fallback (same as assess/chat route)
        const result = await client.generateResponse(messages, {
            preferredModel: 'gemini' as any, // Note: when ENABLE_AWS_BEDROCK=ON, Bedrock (Haiku 4.5) runs FIRST regardless of this field. This is the fallback priority if Bedrock is OFF.
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

        const cleanResponse = (result.response || '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .trim();

        return NextResponse.json({
            response: cleanResponse,
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
