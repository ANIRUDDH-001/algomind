/**
 * AWS Bedrock AI Client — DB-Driven Model Selection
 *
 * Models are NOT hardcoded — they come from the `model_routing` table
 * where provider='bedrock'. The owner can add/remove/reprioritize models
 * from the Owner Dashboard without code changes.
 *
 * Gated by ENABLE_AWS_BEDROCK feature flag — costs $0 when OFF.
 *
 * Supported model families:
 *   - Anthropic: uses Messages API format
 *   - OpenAI (gpt-oss):   uses OpenAI-compatible format
 *   - Amazon (Titan):      uses native Titan format
 *
 * Region: AWS_BEDROCK_REGION env var (default: us-east-1)
 */
// @ts-nocheck

// 


import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Message } from './client';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
    if (!bedrockClient) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS Bedrock credentials not configured');
        }
        bedrockClient = new BedrockRuntimeClient({
            region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return bedrockClient;
}

// ─── Model Family Detection ────────────────────────────────────────────────

type ModelFamily = 'anthropic' | 'openai' | 'amazon' | 'unknown';

function detectModelFamily(modelId: string): ModelFamily {
    if (modelId.startsWith('anthropic.')) return 'anthropic';
    if (modelId.startsWith('openai.')) return 'openai';
    if (modelId.startsWith('amazon.')) return 'amazon';
    return 'unknown';
}

// ─── Format payload per model family ───────────────────────────────────────

function buildPayload(
    modelId: string,
    messages: Message[],
    systemPrompt?: string,
    maxTokens = 4096
): string {
    const family = detectModelFamily(modelId);

    if (family === 'anthropic') {
        return JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })),
        });
    }

    if (family === 'openai') {
        const allMessages = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
            : messages.filter(m => m.role !== 'system');
        return JSON.stringify({
            messages: allMessages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            max_tokens: maxTokens,
        });
    }

    // Fallback: try Anthropic format for unknown models
    return JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
    });
}

// ─── Parse response per model family ───────────────────────────────────────

function parseResponse(modelId: string, responseBody: Record<string, unknown>): string {
    const family = detectModelFamily(modelId);

    if (family === 'anthropic') {
        const content = responseBody.content as Array<{ text: string }>;
        return content[0].text;
    }

    if (family === 'openai') {
        const choices = responseBody.choices as Array<{ message: { content: string } }>;
        return choices[0].message.content;
    }

    // Fallback: try common response shapes
    if (responseBody.content && Array.isArray(responseBody.content)) {
        return (responseBody.content as Array<{ text: string }>)[0].text;
    }
    if (responseBody.choices && Array.isArray(responseBody.choices)) {
        return (responseBody.choices as Array<{ message: { content: string } }>)[0].message.content;
    }

    throw new Error(`[Bedrock] Unknown response format from model ${modelId}`);
}

// ─── Main call function (DB-driven model) ──────────────────────────────────

/**
 * Call a specific Bedrock model by modelId.
 * The caller (UnifiedAIClient) picks the model from the model_routing DB table.
 * This function just formats and sends the request.
 */
export async function callBedrockModel(
    modelId: string,
    messages: Message[],
    systemPrompt?: string,
    maxTokens = 4096,
    signal?: AbortSignal
): Promise<string> {
    // Gate behind feature flag
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_BEDROCK');
    if (!enabled) {
        throw new Error('AWS Bedrock is disabled via ENABLE_AWS_BEDROCK feature flag');
    }

    // Early abort — skip the network call entirely if already aborted
    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    const body = buildPayload(modelId, messages, systemPrompt, maxTokens);

    const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body,
    });

    // Race the Bedrock request against abort so user interruptions cancel in-flight calls.
    const sendPromise = getBedrockClient().send(command);

    let response;
    if (signal) {
        response = await Promise.race([
            sendPromise,
            new Promise<never>((_, reject) => {
                signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('Aborted', 'AbortError')),
                    { once: true }
                );
            }),
        ]);
    } else {
        response = await sendPromise;
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return parseResponse(modelId, responseBody);
}

/**
 * Stream a Bedrock model using InvokeModelWithResponseStreamCommand.
 */
export async function* streamBedrockModel(
    modelId: string,
    messages: Message[],
    systemPrompt?: string,
    maxTokens = 4096,
    signal?: AbortSignal
): AsyncGenerator<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_BEDROCK');
    if (!enabled) throw new Error('AWS Bedrock is disabled');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const body = buildPayload(modelId, messages, systemPrompt, maxTokens);
    const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body,
    });

    const response = await getBedrockClient().send(command);
    if (!response.body) throw new Error('Empty response body from Bedrock');

    const decoder = new TextDecoder();
    for await (const event of response.body) {
        if (signal?.aborted) break;
        if (event.chunk && event.chunk.bytes) {
            const chunkText = decoder.decode(event.chunk.bytes, { stream: true });
            // AWS can send multiple JSON objects in one chunk separated by newlines sometimes, though typically event.chunk is one JSON.
            const lines = chunkText.split('\n').filter(l => l.trim() !== '');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    const family = detectModelFamily(modelId);
                    
                    let text = '';
                    if (family === 'anthropic') {
                        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            text = parsed.delta.text;
                        } else if (parsed.completion) {
                            text = parsed.completion;
                        }
                    } else if (family === 'openai') {
                        if (parsed.choices?.[0]?.delta?.content) {
                            text = parsed.choices[0].delta.content;
                        }
                    } else if (parsed.content && Array.isArray(parsed.content)) {
                        text = parsed.content[0]?.text || '';
                    } else if (parsed.choices && Array.isArray(parsed.choices)) {
                        text = parsed.choices[0]?.delta?.content || '';
                    }

                    if (text) yield text;
                } catch (e) {
                    console.warn('[Bedrock Stream] Parse error:', e);
                }
            }
        }
    }
}

/**
 * Legacy wrapper — calls gpt-oss-120b as default Bedrock model.
 * Kept for backward compatibility with existing callModel() in client.ts.
 * Still gated by ENABLE_AWS_BEDROCK flag.
 */
export async function callBedrockDefaultModel(
    messages: Message[],
    systemPrompt?: string,
    maxTokens = 4096
): Promise<string> {
    return callBedrockModel(
        'openai.gpt-oss-120b-1:0',
        messages,
        systemPrompt,
        maxTokens
    );
}

/**
 * Generate embeddings via AWS Bedrock Titan Embed v2.
 * Returns 1024-dimensional normalized vectors.
 * NOT gated by ENABLE_AWS_BEDROCK — embeddings are a separate concern.
 */
export async function generateBedrockEmbedding(text: string): Promise<number[]> {
    const command = new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            inputText: text,
            dimensions: 1024,
            normalize: true,
        }),
    });

    const response = await getBedrockClient().send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
}

export function resetBedrockClient(): void { bedrockClient = null; }
