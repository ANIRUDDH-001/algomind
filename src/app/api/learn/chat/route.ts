import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, UnifiedAIClient } from '@/lib/ai/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildLearnSystemPrompt, buildKaiMemoryUpdatePrompt } from '@/lib/learn/system-prompt';
import { getKaiMemory, updateKaiMemory } from '@/app/actions/learn';
import { getServiceClient } from '@/lib/supabase/service';

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

        const systemPrompt = buildLearnSystemPrompt({
            problemTitle: problem.title,
            problemDifficulty: problem.difficulty,
            problemDescription: problem.description,
            conceptTags: problem.tags || [],
            kaiMemory,
            userPreviousScore: lastSession?.overall_score || null
        });

        const client = getAIClient();

        // Needs Llama 3.3 70B
        const result = await client.generateResponse(messages, {
            preferredModel: 'groq',
            category: 'reasoning',
            maxTokens: 4096,
            systemPrompt: systemPrompt,
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

        return NextResponse.json({
            response: result.response,
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
