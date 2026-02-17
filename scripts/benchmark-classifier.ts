/**
 * Performance Benchmark for IntentClassifier
 *
 * Measures regex-only and cached classification latency.
 * Run: npx tsx scripts/benchmark-classifier.ts
 */

// Inline implementation to avoid import issues with Next.js paths
// We import from relative path
import { IntentClassifier } from '../src/lib/ai/intent-classifier';

const SAMPLE_QUERIES = [
    // Simple
    'hi', 'hello', 'hey', 'good morning', 'thanks', 'thank you', 'bye',
    'yes', 'no', 'okay', 'sure', 'got it', 'I see', 'understood',
    "that's correct", 'yes, exactly', 'can you repeat', 'what do you mean',
    "I'm ready", "let's go", 'right', 'yeah', 'nope',

    // Medium
    'what is a hash table?', 'what are linked lists?',
    'give me an example of recursion', 'show me an example',
    'how does caching work?', 'explain polymorphism',
    'what is the difference between stack and queue?',

    // Complex
    'explain merge sort algorithm step by step',
    'review my code for the binary search implementation',
    'how would you design a URL shortener?',
    'compare arrays vs linked lists pros and cons',
    'tell me about a time when you had to debug a hard problem',
    'what is the time complexity of quicksort?',
    'optimize my solution to make it faster',
    'walk me through implementing a trie data structure',
    'how would you design a real-time chat system?',
    'describe a situation where you had to resolve a conflict',

    // Ambiguous / no match
    'hmm interesting',
    'can we move on',
    'that is a tricky one',
    'let me think about it',
    'I have a question about something else',
];

interface BenchmarkResult {
    query: string;
    latencyMs: number;
    complexity: string;
    model: string;
    source: string;
}

async function runBenchmark() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  IntentClassifier Performance Benchmark');
    console.log('═══════════════════════════════════════════════════════════\n');

    const classifier = new IntentClassifier({ enableLLMPass: false });
    const results: BenchmarkResult[] = [];

    // ── Cold run (no cache) ─────────────────────────────────────────
    console.log('▸ Cold run (regex-only, no cache)\n');

    for (const query of SAMPLE_QUERIES) {
        const start = performance.now();
        const result = await classifier.classify(query);
        const elapsed = performance.now() - start;

        results.push({
            query,
            latencyMs: elapsed,
            complexity: result.complexity,
            model: result.suggestedModel,
            source: result.reasoning || 'unknown',
        });
    }

    // ── Warm run (cache hits) ───────────────────────────────────────
    const cachedResults: number[] = [];

    console.log('▸ Warm run (cached)\n');

    for (const query of SAMPLE_QUERIES) {
        const start = performance.now();
        await classifier.classify(query);
        cachedResults.push(performance.now() - start);
    }

    // ── Results ─────────────────────────────────────────────────────
    const coldLatencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
    const warmLatencies = cachedResults.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) =>
        arr[Math.ceil(arr.length * p / 100) - 1];

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│          COLD (regex-only) LATENCY          │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Total queries: ${coldLatencies.length.toString().padStart(26)}  │`);
    console.log(`│  Min:      ${percentile(coldLatencies, 0).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p50:      ${percentile(coldLatencies, 50).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p95:      ${percentile(coldLatencies, 95).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p99:      ${percentile(coldLatencies, 99).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  Max:      ${percentile(coldLatencies, 100).toFixed(3).padStart(28)}ms  │`);
    console.log('└─────────────────────────────────────────────┘\n');

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│           WARM (cached) LATENCY             │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Total queries: ${warmLatencies.length.toString().padStart(26)}  │`);
    console.log(`│  Min:      ${percentile(warmLatencies, 0).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p50:      ${percentile(warmLatencies, 50).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p95:      ${percentile(warmLatencies, 95).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  p99:      ${percentile(warmLatencies, 99).toFixed(3).padStart(28)}ms  │`);
    console.log(`│  Max:      ${percentile(warmLatencies, 100).toFixed(3).padStart(28)}ms  │`);
    console.log('└─────────────────────────────────────────────┘\n');

    // ── Per-query breakdown ─────────────────────────────────────────
    console.log('▸ Per-query breakdown (cold):\n');
    console.log(
        'Query'.padEnd(55) +
        'Latency'.padStart(10) +
        'Complexity'.padStart(12) +
        'Model'.padStart(8) +
        'Source'.padStart(24)
    );
    console.log('─'.repeat(109));

    for (const r of results) {
        const truncated = r.query.length > 52 ? r.query.slice(0, 49) + '...' : r.query;
        console.log(
            truncated.padEnd(55) +
            `${r.latencyMs.toFixed(3)}ms`.padStart(10) +
            r.complexity.padStart(12) +
            r.model.padStart(8) +
            r.source.padStart(24)
        );
    }

    // ── Pass/Fail ───────────────────────────────────────────────────
    const maxCold = percentile(coldLatencies, 99);
    const maxWarm = percentile(warmLatencies, 99);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(
        `  Cold p99 < 5ms: ${maxCold < 5 ? '✅ PASS' : '❌ FAIL'} (${maxCold.toFixed(3)}ms)`
    );
    console.log(
        `  Warm p99 < 1ms: ${maxWarm < 1 ? '✅ PASS' : '❌ FAIL'} (${maxWarm.toFixed(3)}ms)`
    );
    console.log('═══════════════════════════════════════════════════════════\n');
}

runBenchmark().catch(console.error);
