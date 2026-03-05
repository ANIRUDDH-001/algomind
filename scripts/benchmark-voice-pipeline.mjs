#!/usr/bin/env node
/**
 * AlgoMind Voice Pipeline Benchmark
 * 
 * Tests all 3 pipeline stages + end-to-end against the live deployment.
 * Measures p50, p95, avg for each stage under sustained load.
 *
 * Usage:
 *   node scripts/benchmark-voice-pipeline.mjs [--base-url URL] [--iterations N] [--concurrency N]
 *
 * Requires: Node 18+ (for native fetch)
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : 'https://algomind-drab.vercel.app';

const ITERATIONS = parseInt(
    process.argv.includes('--iterations')
        ? process.argv[process.argv.indexOf('--iterations') + 1]
        : '10', 10
);

const CONCURRENCY = parseInt(
    process.argv.includes('--concurrency')
        ? process.argv[process.argv.indexOf('--concurrency') + 1]
        : '3', 10
);

// ─── Generate test WAV (sine wave, ~2.5s, 16kHz mono) ──────────────────────

function generateTestWAV() {
    const sampleRate = 16000;
    const durationSec = 2.5;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);       // PCM format chunk size
    buffer.writeUInt16LE(1, 20);        // PCM format
    buffer.writeUInt16LE(1, 22);        // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
    buffer.writeUInt16LE(2, 32);        // block align
    buffer.writeUInt16LE(16, 34);       // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Generate sine wave (440Hz) to simulate speech-like audio
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Mix of frequencies to simulate speech-like spectrum
        const sample = 0.3 * Math.sin(2 * Math.PI * 250 * t)
            + 0.2 * Math.sin(2 * Math.PI * 500 * t)
            + 0.1 * Math.sin(2 * Math.PI * 1000 * t)
            + 0.05 * Math.sin(2 * Math.PI * 2000 * t);
        const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
        buffer.writeInt16LE(int16, 44 + i * 2);
    }

    return buffer;
}

// ─── Test prompts (3 complexity levels) ─────────────────────────────────────

const PROMPTS = {
    simple: [
        "What is the time complexity of accessing an element in an array by index?",
        "Explain what a stack data structure is.",
        "What is the difference between a queue and a stack?",
        "What does Big O notation mean?",
    ],
    medium: [
        "How would you approach the Two Sum problem? Walk me through your thought process.",
        "Explain the difference between BFS and DFS. When would you use each?",
        "How does a hash map handle collisions? What are the common strategies?",
        "Describe how you would detect a cycle in a linked list.",
    ],
    complex: [
        "Design an algorithm to find the shortest path in a weighted graph with negative edges. What are the trade-offs between Bellman-Ford and Dijkstra?",
        "Explain how dynamic programming can solve the longest common subsequence problem. Walk through the state transition and space optimization.",
        "How would you design a cache with O(1) get and put operations that evicts the least recently used item? Discuss the data structure choices.",
        "Describe the process of balancing an AVL tree after insertion. What are the four rotation cases and when does each apply?",
    ],
};

const TTS_TEXTS = [
    "That's a great approach! Using a hash map gives you O(1) average lookup time. Now, can you think about what happens with edge cases?",
    "Good thinking! The two-pointer technique works well here. Let me ask you about the time complexity of your solution.",
    "Interesting! You've identified the key insight. How would you handle the case where the input array is already sorted?",
    "Nice work on the brute force approach. Can you think of a way to optimize this from O(n squared) to O(n log n)?",
    "That's correct! Binary search gives us O(log n) time. Walk me through how you'd implement this iteratively.",
];

// ─── Utility functions ──────────────────────────────────────────────────────

function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Benchmark runners ──────────────────────────────────────────────────────

async function benchmarkSTT(wavBuffer) {
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const form = new FormData();
    form.append('audio', blob, 'test-speech.wav');

    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/voice/transcribe`, {
        method: 'POST',
        body: form,
    });
    const latency = performance.now() - start;
    const status = res.status;

    let data = null;
    try { data = await res.json(); } catch { /* binary or error */ }

    return { latency, status, success: status === 200, data };
}

async function benchmarkAIChat(prompt, complexity) {
    const messages = [
        { role: 'user', content: prompt }
    ];

    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages,
            guestMode: true,
            systemPrompt: 'You are Kai, an AI technical interview coach. Keep responses concise (2-3 sentences max).',
        }),
    });
    const latency = performance.now() - start;
    const status = res.status;

    let data = null;
    let ttfb = null;

    if (status === 200) {
        try {
            data = await res.json();
        } catch { /* */ }
    } else {
        try { await res.text(); } catch { /* drain */ }
    }

    return {
        latency, status, success: status === 200, data, complexity,
        modelUsed: data?.modelUsed, provider: data?.provider,
    };
}

async function benchmarkTTS(text) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/voice/synthesize-polly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'Kajal' }),
    });
    const latency = performance.now() - start;
    const status = res.status;

    // Drain body
    try { await res.arrayBuffer(); } catch { /* */ }

    return { latency, status, success: status === 200, textLength: text.length };
}

async function benchmarkE2E(wavBuffer, prompt, ttsText) {
    const timings = {};
    const overallStart = performance.now();

    // Stage 1: STT
    const sttStart = performance.now();
    const sttResult = await benchmarkSTT(wavBuffer);
    timings.stt = performance.now() - sttStart;

    // Stage 2: AI Chat
    const aiStart = performance.now();
    const aiResult = await benchmarkAIChat(prompt, 'medium');
    timings.ai = performance.now() - aiStart;

    // Stage 3: TTS (use provided text or AI response)
    const ttsInput = aiResult.data?.response || ttsText;
    const ttsStart = performance.now();
    const ttsResult = await benchmarkTTS(ttsInput.slice(0, 300));
    timings.tts = performance.now() - ttsStart;

    timings.total = performance.now() - overallStart;

    return {
        timings,
        sttSuccess: sttResult.success,
        aiSuccess: aiResult.success,
        ttsSuccess: ttsResult.success,
        modelUsed: aiResult.modelUsed,
        provider: aiResult.provider,
    };
}

// ─── Concurrent runner ──────────────────────────────────────────────────────

async function runConcurrent(fn, iterations, concurrency) {
    const results = [];
    let idx = 0;

    async function worker() {
        while (idx < iterations) {
            const myIdx = idx++;
            try {
                const result = await fn(myIdx);
                results.push(result);
            } catch (err) {
                results.push({ error: err.message, latency: 0, success: false });
            }
            // Small jitter between requests (50-150ms)
            await sleep(50 + Math.random() * 100);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, iterations) }, () => worker());
    await Promise.all(workers);
    return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  AlgoMind — Voice Pipeline Benchmark');
    console.log(`  Target: ${BASE_URL}`);
    console.log(`  Iterations: ${ITERATIONS} per stage | Concurrency: ${CONCURRENCY} VUs`);
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    const wavBuffer = generateTestWAV();
    console.log(`Generated test WAV: ${wavBuffer.byteLength} bytes (2.5s, 16kHz mono)\n`);

    const allResults = {};

    // ── Stage 1: STT Benchmark ──────────────────────────────────────────

    console.log('▸ [1/4] Speech-to-Text (Groq Whisper) ...');
    const sttResults = await runConcurrent(
        () => benchmarkSTT(wavBuffer),
        ITERATIONS,
        CONCURRENCY
    );
    const sttSuccess = sttResults.filter(r => r.success);
    const sttLatencies = sttSuccess.map(r => r.latency);

    if (sttLatencies.length > 0) {
        console.log(`  ✓ ${sttSuccess.length}/${sttResults.length} successful`);
        console.log(`  p50: ${percentile(sttLatencies, 50).toFixed(0)} ms`);
        console.log(`  p95: ${percentile(sttLatencies, 95).toFixed(0)} ms`);
        console.log(`  avg: ${avg(sttLatencies).toFixed(0)} ms\n`);
    } else {
        console.log(`  ✗ All ${sttResults.length} requests failed\n`);
        // Log first error
        const firstErr = sttResults[0];
        console.log(`  Error: status=${firstErr.status}, data=${JSON.stringify(firstErr.data)}\n`);
    }
    allResults.stt = { latencies: sttLatencies, total: sttResults.length, success: sttSuccess.length };

    // ── Stage 2: AI Chat Benchmark ──────────────────────────────────────

    console.log('▸ [2/4] AI Chat Response (UnifiedAIClient) ...');
    const allPrompts = [
        ...PROMPTS.simple.map(p => ({ prompt: p, complexity: 'simple' })),
        ...PROMPTS.medium.map(p => ({ prompt: p, complexity: 'medium' })),
        ...PROMPTS.complex.map(p => ({ prompt: p, complexity: 'complex' })),
    ];

    const aiResults = await runConcurrent(
        (i) => {
            const entry = allPrompts[i % allPrompts.length];
            return benchmarkAIChat(entry.prompt, entry.complexity);
        },
        ITERATIONS,
        CONCURRENCY
    );

    const aiSuccess = aiResults.filter(r => r.success);
    const aiLatencies = aiSuccess.map(r => r.latency);

    // Track model distribution
    const modelDist = {};
    for (const r of aiSuccess) {
        const key = `${r.modelUsed} (${r.provider})`;
        modelDist[key] = (modelDist[key] || 0) + 1;
    }

    if (aiLatencies.length > 0) {
        console.log(`  ✓ ${aiSuccess.length}/${aiResults.length} successful`);
        console.log(`  p50: ${percentile(aiLatencies, 50).toFixed(0)} ms`);
        console.log(`  p95: ${percentile(aiLatencies, 95).toFixed(0)} ms`);
        console.log(`  avg: ${avg(aiLatencies).toFixed(0)} ms`);
        console.log(`  Model distribution:`);
        for (const [model, count] of Object.entries(modelDist).sort((a, b) => b[1] - a[1])) {
            console.log(`    ${model}: ${count} hits`);
        }
        console.log();
    } else {
        console.log(`  ✗ All ${aiResults.length} requests failed\n`);
        const firstErr = aiResults[0];
        console.log(`  Error: status=${firstErr.status}, data=${JSON.stringify(firstErr.data)}\n`);
    }
    allResults.ai = { latencies: aiLatencies, total: aiResults.length, success: aiSuccess.length, modelDist };

    // ── Stage 3: TTS Benchmark ──────────────────────────────────────────

    console.log('▸ [3/4] Text-to-Speech (AWS Polly Kajal Neural) ...');
    const ttsResults = await runConcurrent(
        (i) => benchmarkTTS(TTS_TEXTS[i % TTS_TEXTS.length]),
        ITERATIONS,
        CONCURRENCY
    );

    const ttsSuccess = ttsResults.filter(r => r.success);
    const ttsLatencies = ttsSuccess.map(r => r.latency);

    if (ttsLatencies.length > 0) {
        console.log(`  ✓ ${ttsSuccess.length}/${ttsResults.length} successful`);
        console.log(`  p50: ${percentile(ttsLatencies, 50).toFixed(0)} ms`);
        console.log(`  p95: ${percentile(ttsLatencies, 95).toFixed(0)} ms`);
        console.log(`  avg: ${avg(ttsLatencies).toFixed(0)} ms\n`);
    } else {
        console.log(`  ✗ All ${ttsResults.length} requests failed\n`);
        const firstErr = ttsResults[0];
        console.log(`  Error: status=${firstErr.status}, data=${JSON.stringify(firstErr.data)}\n`);
    }
    allResults.tts = { latencies: ttsLatencies, total: ttsResults.length, success: ttsSuccess.length };

    // ── Stage 4: End-to-End Pipeline ────────────────────────────────────

    console.log('▸ [4/4] End-to-End Pipeline (STT → AI → TTS) ...');
    const e2eIterations = Math.min(ITERATIONS, 5); // Fewer E2E since it's 3 sequential calls
    const e2eResults = await runConcurrent(
        (i) => benchmarkE2E(
            wavBuffer,
            pick(PROMPTS.medium),
            pick(TTS_TEXTS)
        ),
        e2eIterations,
        Math.min(CONCURRENCY, 2) // Lower concurrency for E2E
    );

    const e2eSuccess = e2eResults.filter(r => !r.error);
    if (e2eSuccess.length > 0) {
        const e2eTotals = e2eSuccess.map(r => r.timings.total);
        const e2eSTT = e2eSuccess.map(r => r.timings.stt);
        const e2eAI = e2eSuccess.map(r => r.timings.ai);
        const e2eTTS = e2eSuccess.map(r => r.timings.tts);

        console.log(`  ✓ ${e2eSuccess.length}/${e2eResults.length} successful`);
        console.log(`  Total p50: ${percentile(e2eTotals, 50).toFixed(0)} ms`);
        console.log(`  Total p95: ${percentile(e2eTotals, 95).toFixed(0)} ms`);
        console.log(`  Total avg: ${avg(e2eTotals).toFixed(0)} ms`);
        console.log(`  Breakdown (avg): STT ${avg(e2eSTT).toFixed(0)} ms + AI ${avg(e2eAI).toFixed(0)} ms + TTS ${avg(e2eTTS).toFixed(0)} ms\n`);

        allResults.e2e = {
            totals: e2eTotals, stt: e2eSTT, ai: e2eAI, tts: e2eTTS,
            total: e2eResults.length, success: e2eSuccess.length,
        };
    } else {
        console.log(`  ✗ All E2E runs failed\n`);
        allResults.e2e = { totals: [], stt: [], ai: [], tts: [], total: e2eResults.length, success: 0 };
    }

    // ── Summary & JSON export ───────────────────────────────────────────

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const summary = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        iterations: ITERATIONS,
        concurrency: CONCURRENCY,
        stages: {},
    };

    const stages = [
        { key: 'stt', name: 'Speech-to-Text', model: 'Groq whisper-large-v3-turbo' },
        { key: 'ai', name: 'AI Response', model: 'UnifiedAIClient (auto-routed)' },
        { key: 'tts', name: 'Text-to-Speech', model: 'AWS Polly Kajal Neural' },
    ];

    for (const stage of stages) {
        const data = allResults[stage.key];
        if (data.latencies.length > 0) {
            const stats = {
                p50: Math.round(percentile(data.latencies, 50)),
                p95: Math.round(percentile(data.latencies, 95)),
                avg: Math.round(avg(data.latencies)),
                min: Math.round(Math.min(...data.latencies)),
                max: Math.round(Math.max(...data.latencies)),
                total: data.total,
                success: data.success,
            };
            if (data.modelDist) stats.modelDistribution = data.modelDist;
            summary.stages[stage.key] = stats;
            console.log(`\n  ${stage.name} (${stage.model}):`);
            console.log(`    p50=${stats.p50}ms  p95=${stats.p95}ms  avg=${stats.avg}ms  [${stats.success}/${stats.total} ok]`);
        }
    }

    if (allResults.e2e && allResults.e2e.totals.length > 0) {
        const e2e = allResults.e2e;
        summary.stages.e2e = {
            p50: Math.round(percentile(e2e.totals, 50)),
            p95: Math.round(percentile(e2e.totals, 95)),
            avg: Math.round(avg(e2e.totals)),
            breakdown: {
                stt_avg: Math.round(avg(e2e.stt)),
                ai_avg: Math.round(avg(e2e.ai)),
                tts_avg: Math.round(avg(e2e.tts)),
            },
            total: e2e.total,
            success: e2e.success,
        };
        console.log(`\n  End-to-End (STT + AI + TTS):`);
        console.log(`    p50=${summary.stages.e2e.p50}ms  p95=${summary.stages.e2e.p95}ms  avg=${summary.stages.e2e.avg}ms`);
        console.log(`    Breakdown: STT ${summary.stages.e2e.breakdown.stt_avg}ms + AI ${summary.stages.e2e.breakdown.ai_avg}ms + TTS ${summary.stages.e2e.breakdown.tts_avg}ms`);
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Save JSON results
    const outPath = resolve(__dirname, 'benchmark-results.json');
    writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`Results saved to: ${outPath}`);
}

main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
