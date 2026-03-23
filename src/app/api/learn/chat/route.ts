/**
 * @deprecated This route is deprecated in AlgoMind 2.0.
 * Use /api/learn/concept instead.
 * This file is kept for reference only and will be removed in a future cleanup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, UnifiedAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildLearnSystemPrompt, buildKaiMemoryUpdatePrompt } from '@/lib/learn/system-prompt';
import { getKaiMemory, updateKaiMemory } from '@/app/actions/learn';
import { getServiceClient } from '@/lib/supabase/service';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { detectSpokenLanguage } from '@/lib/voice/language-detector';
import { checkUserRateLimit, incrementUserUsage } from '@/lib/rate-limit/user-rate-limiter';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null);
        if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

        const { messages, problemId, exchangeCount } = body;

        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit: same quota as main chat
        const rateLimit = await checkUserRateLimit(user.id);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Rate limit exceeded. Take a break!' }, { status: 429 });
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Fetch problem details
        const { data: problem } = await supabase
            .from('problems')
            .select('title, difficulty, description, tags')
            .eq('id', problemId)
            .single();

        if (!problem) {
            return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
        }

        // Fetch user score
        const { data: lastSession } = await supabase
            .from('interview_sessions')
            .select('overall_score')
            .eq('user_id', user.id)
            .eq('problem_id', problemId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fetch Kai memory
        const kaiMemory = await getKaiMemory(user.id);

        // --- Hinglish for Learn mode (mirrors /api/chat logic) ---
        const hinglishEnabled = await getGlobalFeatureFlag('ENABLE_HINGLISH_SUPPORT');
        let userHinglishEnabled = false;
        if (hinglishEnabled) {
            const { data: userPref } = await supabase
                .from('user_preferences')
                .select('hinglish_enabled')
                .eq('user_id', user.id)
                .maybeSingle();
            userHinglishEnabled = userPref?.hinglish_enabled ?? false;
        }

        const lastUserMessage = [...(messages || [])].reverse().find((m: any) => m.role === 'user');
        const hinglishActive = hinglishEnabled && userHinglishEnabled;
        const spokenLanguage: 'english' | 'hinglish' =
            (hinglishActive && lastUserMessage)
                ? detectSpokenLanguage(lastUserMessage.content ?? '')
                : 'english';

        const hinglishBlock = (hinglishActive && spokenLanguage === 'hinglish')
            ? '\n\nSPOKEN LANGUAGE: Candidate is speaking Hinglish. Mirror naturally with Hindi fillers ' +
              '(yaar, matlab, toh, basically, dekho). Technical terms stay English. NO Devanagari script.'
            : '';

        const systemPrompt = buildLearnSystemPrompt({
            problemTitle: problem.title,
            problemDifficulty: problem.difficulty,
            problemDescription: problem.description,
            conceptTags: problem.tags || [],
            kaiMemory,
            userPreviousScore: lastSession?.overall_score || null,
            hinglishActive,
        });

        const client = getAIClient();

        // Needs Llama 3.3 70B
        const result = await client.generateResponse(messages, {
            preferredModel: 'groq',
            category: 'reasoning',
            maxTokens: 4096,
            systemPrompt: systemPrompt + hinglishBlock,
            estimatedTokens: 500,
            temperature: 0.8
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate response');
        }

        // Save memory after every 5 exchanges
        if (exchangeCount > 0 && exchangeCount % 5 === 0) {
            // fire and forget summarize
            Promise.resolve().then(async () => {
                const summarizePrompt = buildKaiMemoryUpdatePrompt();
                const textToSummarize = messages.slice(-10).map((m: any) => `${m.role}: ${m.content}`).join('\n');

                const summarizer = new UnifiedAIClient();
                const summaryResult = await summarizer.generateCompletion([
                    { role: 'user', content: `${textToSummarize}\n\n${summarizePrompt}` }
                ], { preferredProvider: 'groq', temperature: 0.2 });

                if (summaryResult.success && summaryResult.response) {
                    await updateKaiMemory(user.id, summaryResult.response);
                }
            }).catch(console.error);
        }

        // Log the chat 
        Promise.resolve().then(async () => {
            const adminSupabase = getServiceClient();
            await adminSupabase.from('system_events').insert({
                user_id: user.id,
                type: 'learn_chat',
                metadata: {
                    problemId,
                    exchangeCount
                }
            });
        }).catch(console.error);

        // Increment usage after successful response
        incrementUserUsage(user.id, supabase).catch(err =>
            console.error('[Learn API] Failed to track usage:', err)
        );

        // Sanitize response to remove reasoning tags and system prompt leaks
        const cleanResponse = (result.response || '')
          .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .trim();

        return NextResponse.json({
            response: cleanResponse,
            modelUsed: result.modelUsed,
            provider: result.provider
        });
    } catch (error: any) {
        console.error('❌ [Learn Chat API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
