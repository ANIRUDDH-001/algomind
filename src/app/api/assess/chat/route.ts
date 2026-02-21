import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
    try {
        interface ChatRequestBody {
            sessionToken: string;
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            systemPrompt?: string;
            problemContext?: {
                title?: string;
                content?: string;
            };
        }

        let body: ChatRequestBody;
        try {
            const text = await req.text();
            body = JSON.parse(text);
        } catch (_parseError) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { sessionToken, messages, systemPrompt, problemContext } = body;

        if (!sessionToken) {
            return NextResponse.json({ error: 'Missing session token' }, { status: 401 });
        }

        // 🔒 Validate candidate JWT securely
        let payload;
        try {
            const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY || 'development_secret');
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Chat API] Invalid session token', error);
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Apply a strict per-session limit without hitting the database on every chat via JWT
        // (For production scale, Redis or a lightweight DB count here is recommended. We'll rely on time-expiry)

        const client = getAIClient();

        let enhancedSystemPrompt = systemPrompt || '';

        // Add minimal instructions prioritizing standard assessment style
        enhancedSystemPrompt += '\n\n## CANDIDATE INTERVIEW GUIDELINES\nYou are conducting a technical interview. Keep your answers concise, ask probing questions about space/time complexity, and do not write the code for the candidate.';

        const result = await client.generateResponse(messages, {
            preferredModel: 'auto',
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500
        });

        if (!result.success) {
            throw new Error(result.error || "Failed to generate response");
        }

        return NextResponse.json({
            response: result.response,
            modelUsed: result.modelUsed,
            provider: result.provider
        });

    } catch (error: unknown) {
        console.error('❌ [Assess Chat API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
