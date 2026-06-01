/**
 * @codesage
 * @file      scripts/batch/sync-models.ts
 * @purpose   Pings active models via their provider APIs to verify they are alive and marks them deprecated if not
 * @tech      Node.js, Supabase, Fetch
 * @connects  Imports markModelDeprecated from src/lib/ai/model-registry
 * @apis      Pings Groq API and Gemini API
 * @db        Reads and updates model_registry
 * @state     none
 * @env       Loads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, GEMINI_API_KEY
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { createClient } from '@supabase/supabase-js';
import { markModelDeprecated } from '../../src/lib/ai/model-registry';

export async function syncModelRegistry(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[model-sync] Fetching active models from registry...');
    const { data: models, error } = await supabase
        .from('model_registry')
        .select('model_id, provider')
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch models: ${error.message}`);
    }

    if (!models || models.length === 0) {
        console.log('[model-sync] No active models found.');
        return;
    }

    let verifiedCount = 0;
    let deprecatedCount = 0;

    await Promise.allSettled(
        models.map(async (model) => {
            let success = false;
            let errorMessage = '';

            try {
                if (model.provider === 'groq') {
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: model.model_id,
                            messages: [{ role: 'user', content: 'ping' }],
                            max_tokens: 1
                        })
                    });
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        errorMessage = errData.error?.message || `Status ${res.status}`;
                        // Deprecate if 404 or explicitly not found error
                        if (res.status === 404 || (res.status === 400 && errorMessage.toLowerCase().includes('does not exist'))) {
                            success = false;
                        } else {
                            // Assume model exists if it failed for another reason (e.g. 429)
                            success = true;
                        }
                    } else {
                        success = true;
                    }
                } else if (model.provider === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: 'ping' }] }],
                            generationConfig: { maxOutputTokens: 1 }
                        })
                    });
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        errorMessage = errData.error?.message || `Status ${res.status}`;
                        if (res.status === 404 || errorMessage.toLowerCase().includes('not found')) {
                            success = false;
                        } else {
                            success = true;
                        }
                    } else {
                        success = true;
                    }
                } else {
                    // For undefined providers, assume verified for now
                    success = true;
                }

                if (success) {
                    await supabase
                        .from('model_registry')
                        .update({ last_verified: new Date().toISOString() })
                        .eq('model_id', model.model_id);
                    verifiedCount++;
                } else {
                    console.log(`[model-sync] Deprecating ${model.model_id}: ${errorMessage}`);
                    await markModelDeprecated(model.model_id, `Failed nightly ping: ${errorMessage}`);
                    deprecatedCount++;
                }
            } catch (err) {
                console.error(`[model-sync] Error testing model ${model.model_id}:`, err);
            }
        })
    );

    console.log(`[model-sync] Summary: ${verifiedCount} verified, ${deprecatedCount} deprecated.`);
}
