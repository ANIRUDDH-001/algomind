/**
 * AWS Bedrock AI Client
 *
 * Provides Claude 3.5 Sonnet (chat fallback) and Titan Embed v2 (embedding fallback).
 * Region: us-east-1 for Claude model availability.
 * Used as last-resort fallback when both Groq and Gemini are unavailable.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Message } from './client';

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
    if (!bedrockClient) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS Bedrock credentials not configured');
        }
        bedrockClient = new BedrockRuntimeClient({
            region: process.env.AWS_BEDROCK_REGION || 'us-east-1', // Claude is in us-east-1
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return bedrockClient;
}

/**
 * Call Claude 3.5 Sonnet via AWS Bedrock.
 * Used as fallback when Groq and Gemini are unavailable.
 */
export async function callBedrockClaude(
    messages: Message[],
    systemPrompt?: string,
    maxTokens = 4096
): Promise<string> {
    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
    };

    const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await getBedrockClient().send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
}

/**
 * Generate embeddings via AWS Bedrock Titan Embed v2.
 * Returns 1024-dimensional normalized vectors.
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
