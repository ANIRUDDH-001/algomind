import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';
import { markModelDeprecated } from '@/lib/ai/model-registry';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        const body = await request.json();
        const { modelId } = body;

        if (!modelId) {
            return NextResponse.json({ error: 'Missing modelId' }, { status: 400 });
        }

        // 1. Fetch model from registry
        const { data: model, error: fetchError } = await supabase
            .from('model_registry')
            .select('*')
            .eq('model_id', modelId)
            .single();

        if (fetchError || !model) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        let status = 'error';
        let message = 'Verification failed';
        let isSuccess = false;

        // Skip live ping for audio models (Whisper)
        if (modelId.includes('whisper')) {
            const { error: updateError } = await supabase
                .from('model_registry')
                .update({
                    last_verified: new Date().toISOString(),
                    is_verified: true,
                    is_active: true,
                    deprecated_at: null
                })
                .eq('model_id', modelId);

            if (updateError) {
                console.error(`Failed to update verification status for audio model ${modelId}:`, updateError);
                return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
            }

            void logSystemEvent({
                type: 'admin_action',
                metadata: { action: 'verify_model', modelId, status: 'verified', message: 'Audio model — marked verified (no ping required)' }
            });

            return NextResponse.json({
                modelId,
                status: 'verified',
                message: 'Audio model — marked verified (no ping required)'
            });
        }

        // 2. Ping the provider
        try {
            if (model.provider === 'groq') {
                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [{ role: 'user', content: 'ping' }],
                        max_tokens: 1
                    })
                });

                if (groqRes.ok) {
                    isSuccess = true;
                    status = 'verified';
                    message = 'Groq ping successful';
                } else if (groqRes.status === 404) {
                    status = 'deprecated';
                    message = 'Model not found on Groq (404)';
                    await markModelDeprecated(modelId, 'Failed live verification (404)');
                } else if (groqRes.status === 429) {
                    status = 'rate_limited';
                    message = 'Groq Rate Limited (429)';
                    // Mark verified since the model exists, just busy
                    const { error: tsError } = await supabase
                        .from('model_registry')
                        .update({ last_verified: new Date().toISOString() })
                        .eq('model_id', modelId);
                    if (tsError) console.error('Failed to update 429 timestamp:', tsError);
                } else {
                    status = 'error';
                    message = `Groq error: ${groqRes.statusText}`;
                }

            } else if (model.provider === 'gemini') {
                // Format: models/model-name
                // For Gemini we test using generateContent
                const cleanModelName = modelId.replace('models/', '');
                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "ping" }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    })
                });

                if (geminiRes.ok) {
                    isSuccess = true;
                    status = 'verified';
                    message = 'Gemini ping successful';
                } else if (geminiRes.status === 404) {
                    status = 'deprecated';
                    message = 'Model not found on Gemini (404)';
                    await markModelDeprecated(modelId, 'Failed live verification (404)');
                } else if (geminiRes.status === 429) {
                    status = 'rate_limited';
                    message = 'Gemini Rate Limited (429)';
                    const { error: tsError } = await supabase
                        .from('model_registry')
                        .update({ last_verified: new Date().toISOString() })
                        .eq('model_id', modelId);
                    if (tsError) console.error('Failed to update 429 timestamp:', tsError);
                } else {
                    status = 'error';
                    message = `Gemini error: ${geminiRes.statusText}`;
                }
            } else if (model.provider === 'bedrock') {
                const bedrock = new BedrockRuntimeClient({
                    region: process.env.AWS_REGION || 'us-east-1',
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                    }
                });
                
                try {
                    // Test payload for Claude 3 or generic anthropic models on Bedrock
                    const command = new InvokeModelCommand({
                        modelId: modelId,
                        contentType: 'application/json',
                        accept: 'application/json',
                        body: JSON.stringify({
                            anthropic_version: "bedrock-2023-05-31",
                            max_tokens: 1,
                            messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }]
                        })
                    });
                    
                    const bedrockRes = await bedrock.send(command);
                    if (bedrockRes.$metadata.httpStatusCode === 200) {
                        isSuccess = true;
                        status = 'verified';
                        message = 'Bedrock ping successful';
                    } else {
                        status = 'error';
                        message = `Bedrock error: ${bedrockRes.$metadata.httpStatusCode}`;
                    }
                } catch (bedrockError: any) {
                    if (bedrockError.name === 'ResourceNotFoundException' || bedrockError.name === 'ValidationException' && bedrockError.message.includes('model')) {
                        status = 'deprecated';
                        message = 'Model not found on Bedrock (404)';
                        await markModelDeprecated(modelId, 'Failed live verification (404)');
                    } else if (bedrockError.name === 'ThrottlingException') {
                        status = 'rate_limited';
                        message = 'Bedrock Rate Limited (429)';
                        const { error: tsError } = await supabase
                            .from('model_registry')
                            .update({ last_verified: new Date().toISOString() })
                            .eq('model_id', modelId);
                        if (tsError) console.error('Failed to update 429 timestamp:', tsError);
                    } else {
                        throw bedrockError;
                    }
                }
            } else {
                status = 'error';
                message = `Unknown provider: ${model.provider}`;
            }

        } catch (pingError) {
            console.error(`Ping failed for ${modelId}:`, pingError);
            status = 'error';
            message = pingError instanceof Error ? pingError.message : 'Network error during validation';
        }

        // 3. Update DB if successful
        if (isSuccess) {
            const { error: updateError } = await supabase
                .from('model_registry')
                .update({
                    last_verified: new Date().toISOString(),
                    is_verified: true,
                    // Auto-clear deprecation notice if it suddenly verifies
                    is_active: true,
                    deprecated_at: null
                })
                .eq('model_id', modelId);

            if (updateError) {
                console.error(`Failed to update verification status for ${modelId}:`, updateError);
            }
        }

        // 4. Log the attempt
        void logSystemEvent({
            type: 'admin_action',
            metadata: { action: 'verify_model', modelId, status, message }
        });

        return NextResponse.json({ modelId, status, message });

    } catch (error) {
        console.error('[Admin Model Verify API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
