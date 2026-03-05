#!/usr/bin/env node
/**
 * AlgoMind — Direct AWS Benchmark (Polly TTS + Bedrock AI)
 *
 * Tests AWS services directly using SDK:
 *   1. AWS Polly Neural TTS (Kajal, ap-south-1)
 *   2. AWS Bedrock Claude Haiku 4.5 (cross-region via us-east-1)
 *
 * Loads credentials from .env.local (via dotenv). No secrets in this file.
 *
 * Usage:
 *   node scripts/benchmark-aws-direct.mjs [--iterations N]
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load .env.local (never committed — in .gitignore)
config({ path: resolve(ROOT, '.env.local') });

const ITERATIONS = parseInt(
    process.argv.includes('--iterations')
        ? process.argv[process.argv.indexOf('--iterations') + 1]
        : '10', 10
);

// ─── Utilities ──────────────────────────────────────────────────────────────

function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TTS test texts (~185 chars each, matching typical AI response) ─────────

const TTS_TEXTS = [
    "That's a great approach! Using a hash map gives you O(1) average lookup time. Can you think about what happens with edge cases like duplicate values?",
    "Good thinking! The two-pointer technique works well here. Walk me through the time complexity of your solution step by step.",
    "Interesting insight! How would you handle the case where the input array is already sorted? Does that change your algorithm choice?",
    "Nice work on identifying this pattern. Can you think of a way to optimize from O(n squared) to O(n log n) using a different data structure?",
    "That's correct about binary search! It gives us O(log n) time. Could you explain how you'd handle elements that appear multiple times?",
];

// ─── AI test prompts ────────────────────────────────────────────────────────

const AI_PROMPTS = [
    "What is the time complexity of accessing an array by index?",
    "Explain the two-pointer technique for the Two Sum problem.",
    "How does a hash map handle collisions?",
    "Describe BFS vs DFS traversal differences.",
    "How would you detect a cycle in a linked list?",
    "Explain dynamic programming for longest common subsequence.",
    "What are the rotation cases in AVL trees?",
    "How does Dijkstra's algorithm work? What about negative edges?",
    "Design an LRU cache with O(1) operations.",
    "Walk me through merge sort and its space complexity.",
];

// ─── AWS Polly Benchmark ────────────────────────────────────────────────────

async function benchmarkPolly() {
    console.log('\n▸ AWS Polly Neural TTS (Kajal, ap-south-1)');
    console.log(`  Iterations: ${ITERATIONS}`);

    // Dynamic import of AWS SDK
    const { PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('  ✗ AWS credentials not found in .env.local — skipping Polly test');
        return null;
    }

    const client = new PollyClient({
        region: process.env.AWS_REGION || 'ap-south-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    const latencies = [];
    const charCounts = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const text = pick(TTS_TEXTS);
        const command = new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: 'mp3',
            VoiceId: 'Kajal',
            Engine: 'neural',
            TextType: 'text',
            SampleRate: '22050',
        });

        const start = performance.now();
        try {
            const response = await client.send(command);
            // Drain the stream to ensure we measure full response
            if (response.AudioStream) {
                const chunks = [];
                const reader = response.AudioStream.transformToWebStream().getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
            }
            const latency = performance.now() - start;
            latencies.push(latency);
            charCounts.push(text.length);
            process.stdout.write(`  [${i + 1}/${ITERATIONS}] ${latency.toFixed(0)}ms (${text.length} chars)\r`);
        } catch (err) {
            console.log(`  [${i + 1}/${ITERATIONS}] ERROR: ${err.message}`);
        }
        await sleep(100); // Small gap between requests
    }

    console.log(); // clear line

    if (latencies.length > 0) {
        const stats = {
            p50: Math.round(percentile(latencies, 50)),
            p95: Math.round(percentile(latencies, 95)),
            avg: Math.round(avg(latencies)),
            min: Math.round(Math.min(...latencies)),
            max: Math.round(Math.max(...latencies)),
            total: ITERATIONS,
            success: latencies.length,
            avgChars: Math.round(avg(charCounts)),
        };
        console.log(`  ✓ ${stats.success}/${stats.total} successful`);
        console.log(`  p50: ${stats.p50} ms | p95: ${stats.p95} ms | avg: ${stats.avg} ms`);
        console.log(`  avg text length: ${stats.avgChars} chars`);
        return stats;
    }
    return null;
}

// ─── AWS Bedrock Benchmark (Claude Haiku 4.5 cross-region) ──────────────────

async function benchmarkBedrock() {
    console.log('\n▸ AWS Bedrock — Claude Haiku 4.5 (cross-region, us-east-1)');
    console.log(`  Iterations: ${ITERATIONS}`);

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('  ✗ AWS credentials not found — skipping Bedrock test');
        return null;
    }

    const client = new BedrockRuntimeClient({
        region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    const modelId = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'; // Cross-region inference profile
    const latencies = [];
    const ttfbs = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const prompt = pick(AI_PROMPTS);
        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 512,
            system: 'You are Kai, an AI interview coach. Keep responses concise (2-3 sentences).',
            messages: [{ role: 'user', content: prompt }],
        });

        const command = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body,
        });

        const start = performance.now();
        try {
            const response = await client.send(command);
            const latency = performance.now() - start;
            latencies.push(latency);

            // Parse response to verify it worked
            const result = JSON.parse(new TextDecoder().decode(response.body));
            const responseText = result.content?.[0]?.text || '';

            process.stdout.write(`  [${i + 1}/${ITERATIONS}] ${latency.toFixed(0)}ms (${responseText.length} chars)\r`);
        } catch (err) {
            console.log(`  [${i + 1}/${ITERATIONS}] ERROR: ${err.message}`);
        }
        await sleep(200); // Slightly longer gap to avoid throttling
    }

    console.log();

    if (latencies.length > 0) {
        const stats = {
            p50: Math.round(percentile(latencies, 50)),
            p95: Math.round(percentile(latencies, 95)),
            avg: Math.round(avg(latencies)),
            min: Math.round(Math.min(...latencies)),
            max: Math.round(Math.max(...latencies)),
            total: ITERATIONS,
            success: latencies.length,
        };
        console.log(`  ✓ ${stats.success}/${stats.total} successful`);
        console.log(`  p50: ${stats.p50} ms | p95: ${stats.p95} ms | avg: ${stats.avg} ms`);
        return stats;
    }
    return null;
}

// ─── Groq Whisper Direct Benchmark ──────────────────────────────────────────

async function benchmarkGroqWhisper() {
    console.log('\n▸ Groq Whisper STT (whisper-large-v3-turbo, direct API)');
    console.log(`  Iterations: ${ITERATIONS}`);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        console.log('  ✗ GROQ_API_KEY not found in .env.local — skipping');
        return null;
    }

    // Generate test WAV (2.5s, 16kHz mono sine wave)
    const sampleRate = 16000;
    const durationSec = 2.5;
    const numSamples = Math.floor(sampleRate * durationSec);
    const wavBuf = Buffer.alloc(44 + numSamples * 2);
    wavBuf.write('RIFF', 0);
    wavBuf.writeUInt32LE(36 + numSamples * 2, 4);
    wavBuf.write('WAVE', 8);
    wavBuf.write('fmt ', 12);
    wavBuf.writeUInt32LE(16, 16);
    wavBuf.writeUInt16LE(1, 20);
    wavBuf.writeUInt16LE(1, 22);
    wavBuf.writeUInt32LE(sampleRate, 24);
    wavBuf.writeUInt32LE(sampleRate * 2, 28);
    wavBuf.writeUInt16LE(2, 32);
    wavBuf.writeUInt16LE(16, 34);
    wavBuf.write('data', 36);
    wavBuf.writeUInt32LE(numSamples * 2, 40);
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = 0.3 * Math.sin(2 * Math.PI * 250 * t) + 0.2 * Math.sin(2 * Math.PI * 500 * t);
        wavBuf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(sample * 32767))), 44 + i * 2);
    }

    const latencies = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const blob = new Blob([wavBuf], { type: 'audio/wav' });
        const form = new FormData();
        form.append('file', blob, 'test-speech.wav');
        form.append('model', 'whisper-large-v3-turbo');
        form.append('language', 'en');
        form.append('response_format', 'verbose_json');

        const start = performance.now();
        try {
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqKey}` },
                body: form,
            });
            const latency = performance.now() - start;

            if (res.ok) {
                const data = await res.json();
                latencies.push(latency);
                process.stdout.write(`  [${i + 1}/${ITERATIONS}] ${latency.toFixed(0)}ms\r`);
            } else {
                const err = await res.text();
                console.log(`  [${i + 1}/${ITERATIONS}] HTTP ${res.status}: ${err.slice(0, 100)}`);
            }
        } catch (err) {
            console.log(`  [${i + 1}/${ITERATIONS}] ERROR: ${err.message}`);
        }
        await sleep(150);
    }

    console.log();

    if (latencies.length > 0) {
        const stats = {
            p50: Math.round(percentile(latencies, 50)),
            p95: Math.round(percentile(latencies, 95)),
            avg: Math.round(avg(latencies)),
            min: Math.round(Math.min(...latencies)),
            max: Math.round(Math.max(...latencies)),
            total: ITERATIONS,
            success: latencies.length,
        };
        console.log(`  ✓ ${stats.success}/${stats.total} successful`);
        console.log(`  p50: ${stats.p50} ms | p95: ${stats.p95} ms | avg: ${stats.avg} ms`);
        return stats;
    }
    return null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  AlgoMind — AWS Direct Benchmark');
    console.log(`  Iterations: ${ITERATIONS} per service`);
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log(`  Polly region: ${process.env.AWS_REGION || 'ap-south-1'}`);
    console.log(`  Bedrock region: ${process.env.AWS_BEDROCK_REGION || 'us-east-1'}`);
    console.log('═══════════════════════════════════════════════════════════');

    const results = {
        timestamp: new Date().toISOString(),
        iterations: ITERATIONS,
        pollyRegion: process.env.AWS_REGION || 'ap-south-1',
        bedrockRegion: process.env.AWS_BEDROCK_REGION || 'us-east-1',
    };

    // 1. Groq Whisper STT (direct)
    results.stt = await benchmarkGroqWhisper();

    // 2. AWS Polly TTS
    results.tts = await benchmarkPolly();

    // 3. AWS Bedrock Claude Haiku 4.5
    results.bedrockHaiku = await benchmarkBedrock();

    // ── Summary ─────────────────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const stages = [
        { key: 'stt', name: 'Groq Whisper STT' },
        { key: 'tts', name: 'AWS Polly TTS (Kajal Neural)' },
        { key: 'bedrockHaiku', name: 'Bedrock Claude Haiku 4.5' },
    ];

    for (const s of stages) {
        if (results[s.key]) {
            const d = results[s.key];
            console.log(`\n  ${s.name}:`);
            console.log(`    p50=${d.p50}ms  p95=${d.p95}ms  avg=${d.avg}ms  [${d.success}/${d.total} ok]`);
        } else {
            console.log(`\n  ${s.name}: SKIPPED`);
        }
    }

    // Compute E2E estimate
    if (results.stt && results.tts && results.bedrockHaiku) {
        const e2eAvg = results.stt.avg + results.bedrockHaiku.avg + results.tts.avg;
        const e2eP50 = results.stt.p50 + results.bedrockHaiku.p50 + results.tts.p50;
        const e2eP95 = results.stt.p95 + results.bedrockHaiku.p95 + results.tts.p95;
        results.e2e = {
            p50: e2eP50, p95: e2eP95, avg: e2eAvg,
            breakdown: { stt: results.stt.avg, ai: results.bedrockHaiku.avg, tts: results.tts.avg },
        };
        console.log(`\n  E2E (STT + AI + TTS additive):`);
        console.log(`    p50=${e2eP50}ms  p95=${e2eP95}ms  avg=${e2eAvg}ms`);
        console.log(`    Breakdown: STT ${results.stt.avg}ms + AI ${results.bedrockHaiku.avg}ms + TTS ${results.tts.avg}ms`);
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Merge with existing voice-pipeline results if they exist
    const voicePipelinePath = resolve(__dirname, 'benchmark-results.json');
    let merged = results;
    if (existsSync(voicePipelinePath)) {
        try {
            const existing = JSON.parse(readFileSync(voicePipelinePath, 'utf-8'));
            merged = { ...existing, aws: results };
        } catch { /* ignore */ }
    }

    const outPath = resolve(__dirname, 'benchmark-results.json');
    writeFileSync(outPath, JSON.stringify(merged, null, 2));
    console.log(`Results saved to: ${outPath}`);
}

main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
