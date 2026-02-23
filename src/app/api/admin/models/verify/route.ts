import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';
import { markModelDeprecated } from '@/lib/ai/model-registry';

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
            } else if (model.provider === 'deepseek') {
                // Guard: key must be present before we make the request
                const deepseekKey = process.env.DEEPSEEK_API_KEY;
                if (!deepseekKey) {
                    return NextResponse.json(
                        { error: 'DeepSeek API key not configured. Add DEEPSEEK_API_KEY to environment variables.' },
                        { status: 503 }
                    );
                }

                // Deepseek format
                const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${deepseekKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [{ role: 'user', content: 'ping' }],
                        max_tokens: 1
                    })
                });

                if (dsRes.ok) {
                    isSuccess = true;
                    status = 'verified';
                    message = 'DeepSeek ping successful';
                } else if (dsRes.status === 404) {
                    status = 'deprecated';
                    message = 'Model not found on DeepSeek (404)';
                    await markModelDeprecated(modelId, 'Failed live verification (404)');
                } else if (dsRes.status === 429) {
                    status = 'rate_limited';
                    message = 'DeepSeek Rate Limited (429)';
                    const { error: tsError } = await supabase
                        .from('model_registry')
                        .update({ last_verified: new Date().toISOString() })
                        .eq('model_id', modelId);
                    if (tsError) console.error('Failed to update 429 timestamp:', tsError);
                } else {
                    status = 'error';
                    message = `DeepSeek error: ${dsRes.statusText}`;
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
