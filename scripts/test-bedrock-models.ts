import * as dotenv from 'dotenv';
import path from 'path';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MODELS = [
    // Cross-region inference profile IDs
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
];

async function main() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env.local');
        process.exit(1);
    }

    const region = process.env.AWS_BEDROCK_REGION || 'us-east-1';
    const client = new BedrockRuntimeClient({
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    console.log(`Region: ${region}\n`);

    for (const modelId of MODELS) {
        try {
            const payload = JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say OK' }],
            });

            const res = await client.send(new InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: payload,
            }));

            const body = JSON.parse(new TextDecoder().decode(res.body));
            const text = body.content?.[0]?.text || JSON.stringify(body).slice(0, 60);
            console.log(`✅ ${modelId} — "${text.trim().slice(0, 50)}"`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`❌ ${modelId} — ${msg}`);
        }
    }
}

main();
