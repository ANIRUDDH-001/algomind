import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

const prompts = [
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

async function benchModel(client, modelId, label, iterations = 10) {
    console.log(`\n▸ ${label}`);
    console.log(`  Model: ${modelId} | Iterations: ${iterations}`);

    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
        const prompt = prompts[i % prompts.length];
        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 256,
            system: 'You are Kai, an AI interview coach. 2-3 sentences max.',
            messages: [{ role: 'user', content: prompt }],
        });

        const start = performance.now();
        try {
            const res = await client.send(new InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body,
            }));
            const lat = performance.now() - start;
            const result = JSON.parse(new TextDecoder().decode(res.body));
            const text = result.content?.[0]?.text || '';
            latencies.push(lat);
            console.log(`  [${i + 1}/${iterations}] ${Math.round(lat)}ms (${text.length} chars)`);
        } catch (err) {
            const msg = err.message || String(err);
            console.log(`  [${i + 1}/${iterations}] ERROR: ${msg.slice(0, 100)}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    if (latencies.length === 0) {
        console.log(`  ✗ All failed`);
        return null;
    }
    const stats = {
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        avg: Math.round(avg(latencies)),
        min: Math.round(Math.min(...latencies)),
        max: Math.round(Math.max(...latencies)),
        total: iterations,
        success: latencies.length,
    };
    console.log(`  ✓ ${stats.success}/${stats.total} | p50=${stats.p50}ms p95=${stats.p95}ms avg=${stats.avg}ms`);
    return stats;
}

async function benchGroq(iterations = 10) {
    const key = process.env.GROQ_API_KEY;
    if (!key) { console.log('No GROQ_API_KEY'); return null; }

    console.log('\n▸ Groq Llama 3.3 70B (direct API)');
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You are Kai, an AI interview coach. 2-3 sentences max.' },
                        { role: 'user', content: prompts[i % prompts.length] },
                    ],
                    max_tokens: 256,
                    temperature: 0.7,
                }),
            });
            const lat = performance.now() - start;
            if (res.ok) {
                const d = await res.json();
                latencies.push(lat);
                console.log(`  [${i + 1}/${iterations}] ${Math.round(lat)}ms`);
            } else {
                const e = await res.text();
                console.log(`  [${i + 1}/${iterations}] FAIL ${res.status}: ${e.slice(0, 80)}`);
            }
        } catch (err) {
            console.log(`  [${i + 1}/${iterations}] ERROR: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    if (latencies.length === 0) return null;
    const stats = {
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        avg: Math.round(avg(latencies)),
        min: Math.round(Math.min(...latencies)),
        max: Math.round(Math.max(...latencies)),
        total: iterations,
        success: latencies.length,
    };
    console.log(`  ✓ ${stats.success}/${iterations} | p50=${stats.p50}ms p95=${stats.p95}ms avg=${stats.avg}ms`);
    return stats;
}

async function main() {
    console.log('════════════════════════════════════════════════');
    console.log('  AlgoMind — AI Model Benchmark (all providers)');
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log('════════════════════════════════════════════════');

    const results = {};

    // 1. Groq Llama 3.3 70B
    results.groqLlama70b = await benchGroq(10);

    // 2. Bedrock models
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const region = process.env.AWS_BEDROCK_REGION || 'us-east-1';
        console.log(`\n  Bedrock region: ${region}`);
        const client = new BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        // Claude Haiku 4.5 (cross-region)
        results.bedrockHaiku = await benchModel(
            client,
            'us.anthropic.claude-haiku-4-5-20251001-v1:0',
            'Bedrock Claude Haiku 4.5 (cross-region)',
            10
        );

        // Claude Sonnet 4.5 (cross-region) — fewer iterations since it's expensive
        results.bedrockSonnet = await benchModel(
            client,
            'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            'Bedrock Claude Sonnet 4.5 (cross-region)',
            5
        );
    } else {
        console.log('\n  ✗ AWS credentials not found — skipping Bedrock tests');
    }

    // Save results
    const outPath = resolve(__dirname, 'benchmark-results.json');
    let existing = {};
    if (existsSync(outPath)) {
        try { existing = JSON.parse(readFileSync(outPath, 'utf-8')); } catch { }
    }

    const merged = {
        ...existing,
        groqLlama70b: results.groqLlama70b,
        bedrockHaiku: results.bedrockHaiku,
        bedrockSonnet: results.bedrockSonnet,
        aiTimestamp: new Date().toISOString(),
    };

    writeFileSync(outPath, JSON.stringify(merged, null, 2));

    console.log('\n════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════');
    for (const [k, v] of Object.entries(results)) {
        if (v) {
            console.log(`  ${k}: p50=${v.p50}ms  p95=${v.p95}ms  avg=${v.avg}ms  [${v.success}/${v.total}]`);
        } else {
            console.log(`  ${k}: FAILED/SKIPPED`);
        }
    }
    console.log(`\nResults saved to: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
