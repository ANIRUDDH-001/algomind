import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── Config ─────────────────────────────────────────────────────────────────

const ITERATIONS = 10;

const MODELS = [
    {
        id: process.env.BEDROCK_BENCH_MODEL_A || 'openai.gpt-oss-120b-1:0',
        label: 'Model A',
        key: 'bedrockHaiku',
    },
    {
        id: process.env.BEDROCK_BENCH_MODEL_B || 'openai.gpt-oss-20b-1:0',
        label: 'Model B',
        key: 'bedrockSonnet',
        iterations: 5, // fewer — expensive model
    },
];

const PROMPTS = [
    'What is Big O notation?',
    'Explain two-pointer technique for Two Sum.',
    'How does BFS differ from DFS?',
    'Describe hash map collision strategies.',
    'How to detect a cycle in a linked list?',
    'Walk through merge sort step by step.',
    'Explain dynamic programming approach to LCS.',
    'What are AVL tree rotation cases?',
    'Design an LRU cache with O(1) ops.',
    'What is Dijkstra algorithm and its limitations?',
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
function avg(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

function detectModelFamily(modelId: string): 'openai' | 'anthropic' {
    if (modelId.startsWith('openai.')) return 'openai';
    return 'anthropic';
}

function buildPayloadForModel(modelId: string, prompt: string): string {
    const family = detectModelFamily(modelId);

    if (family === 'openai') {
        return JSON.stringify({
            messages: [
                { role: 'system', content: 'You are Kai, an AI interview coach. 2-3 sentences max.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 256,
        });
    }

    return JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 256,
        system: 'You are Kai, an AI interview coach. 2-3 sentences max.',
        messages: [{ role: 'user', content: prompt }],
    });
}

function extractTextFromResponse(modelId: string, body: Record<string, any>): string {
    const family = detectModelFamily(modelId);
    if (family === 'openai') {
        return body.choices?.[0]?.message?.content || '';
    }
    return body.content?.[0]?.text || '';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('Missing AWS credentials in .env.local');
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

    console.log('════════════════════════════════════════════════');
    console.log('  AlgoMind — Bedrock Latency Benchmark');
    console.log(`  Region: ${region}`);
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log('════════════════════════════════════════════════');

    const results: Record<string, any> = {};

    for (const model of MODELS) {
        const iters = model.iterations ?? ITERATIONS;
        console.log(`\n▸ ${model.label}`);
        console.log(`  Model: ${model.id} | Iterations: ${iters}`);

        const latencies: number[] = [];

        for (let i = 0; i < iters; i++) {
            const prompt = PROMPTS[i % PROMPTS.length];
            const payload = buildPayloadForModel(model.id, prompt);

            const start = performance.now();
            try {
                const res = await client.send(new InvokeModelCommand({
                    modelId: model.id,
                    contentType: 'application/json',
                    accept: 'application/json',
                    body: payload,
                }));
                const lat = performance.now() - start;

                const body = JSON.parse(new TextDecoder().decode(res.body));
                const text = extractTextFromResponse(model.id, body);
                latencies.push(lat);
                console.log(`  [${i + 1}/${iters}] ${Math.round(lat)}ms (${text.length} chars)`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.log(`  [${i + 1}/${iters}] ERROR: ${msg.slice(0, 120)}`);
            }
            await sleep(500);
        }

        if (latencies.length > 0) {
            const stats = {
                p50: Math.round(percentile(latencies, 50)),
                p95: Math.round(percentile(latencies, 95)),
                avg: Math.round(avg(latencies)),
                min: Math.round(Math.min(...latencies)),
                max: Math.round(Math.max(...latencies)),
                total: iters,
                success: latencies.length,
            };
            console.log(`  ✓ ${stats.success}/${stats.total} | p50=${stats.p50}ms p95=${stats.p95}ms avg=${stats.avg}ms`);
            results[model.key] = stats;
        } else {
            console.log(`  ✗ All ${iters} failed`);
            results[model.key] = null;
        }
    }

    // Merge into existing benchmark-results.json
    const outPath = path.resolve(__dirname, 'benchmark-results.json');
    let existing: Record<string, any> = {};
    if (fs.existsSync(outPath)) {
        try { existing = JSON.parse(fs.readFileSync(outPath, 'utf-8')); } catch { /* */ }
    }
    const merged = { ...existing, ...results, bedrockTimestamp: new Date().toISOString() };
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));

    console.log('\n════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════');
    for (const model of MODELS) {
        const r = results[model.key];
        if (r) {
            console.log(`  ${model.label}: p50=${r.p50}ms  p95=${r.p95}ms  avg=${r.avg}ms  [${r.success}/${r.total}]`);
        } else {
            console.log(`  ${model.label}: FAILED`);
        }
    }
    console.log(`\nResults saved to: ${outPath}`);
}

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
main();
