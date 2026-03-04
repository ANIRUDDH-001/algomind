#!/usr/bin/env npx tsx
/**
 * AWS & Services Connection Verification Script
 *
 * Tests connectivity to every service + pings each Bedrock model individually.
 * Prints a detailed results table at the end.
 *
 * Usage: npx tsx scripts/verify-aws-connections.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local (Next.js convention) from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Also load .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ─── Color helpers ──────────────────────────────────────────────────────────
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface TestResult {
    name: string;
    category: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    detail: string;
    latencyMs?: number;
}

const results: TestResult[] = [];

async function runTest(category: string, name: string, fn: () => Promise<string>): Promise<void> {
    const start = Date.now();
    try {
        const detail = await fn();
        const latencyMs = Date.now() - start;
        results.push({ name, category, status: 'PASS', detail, latencyMs });
        console.log(`  ${green('✓')} ${name} ${dim(`${latencyMs}ms`)}`);
    } catch (err: unknown) {
        const latencyMs = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('SKIP:')) {
            results.push({ name, category, status: 'SKIP', detail: msg.replace('SKIP:', '').trim() });
            console.log(`  ${yellow('○')} ${name} — ${yellow('skipped')}`);
        } else {
            results.push({ name, category, status: 'FAIL', detail: msg.slice(0, 120), latencyMs });
            console.log(`  ${red('✗')} ${name} ${dim(`${latencyMs}ms`)} — ${red(msg.slice(0, 80))}`);
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireAwsCreds() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error('SKIP: AWS credentials not set');
    }
    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    };
}

// ─── Service Tests ──────────────────────────────────────────────────────────

async function testSTS(): Promise<string> {
    const creds = requireAwsCreds();
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const sts = new STSClient({ region: process.env.AWS_REGION || 'ap-south-1', credentials: creds });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    return `Account ${id.Account}, User: ${id.Arn?.split('/').pop()}`;
}

async function testS3(): Promise<string> {
    const creds = requireAwsCreds();
    if (!process.env.AWS_S3_BUCKET) throw new Error('SKIP: AWS_S3_BUCKET not set');
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1', credentials: creds });
    await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET }));
    return `Bucket "${process.env.AWS_S3_BUCKET}" accessible`;
}

async function testPolly(): Promise<string> {
    const creds = requireAwsCreds();
    const { PollyClient, DescribeVoicesCommand } = await import('@aws-sdk/client-polly');
    const polly = new PollyClient({ region: process.env.AWS_REGION || 'ap-south-1', credentials: creds });
    const res = await polly.send(new DescribeVoicesCommand({ Engine: 'neural', LanguageCode: 'en-IN' }));
    const kajal = res.Voices?.find(v => v.Id === 'Kajal');
    return kajal ? `Kajal Neural voice found` : `Kajal NOT found (${res.Voices?.length} voices)`;
}

async function testPollySynthesize(): Promise<string> {
    const creds = requireAwsCreds();
    const { PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
    const polly = new PollyClient({ region: process.env.AWS_REGION || 'ap-south-1', credentials: creds });
    const res = await polly.send(new SynthesizeSpeechCommand({
        Text: 'Hello',
        OutputFormat: 'mp3',
        VoiceId: 'Kajal',
        Engine: 'neural',
    }));
    const bytes = await res.AudioStream?.transformToByteArray();
    return `Synthesized ${bytes?.length ?? 0} bytes of audio`;
}

async function testTranscribe(): Promise<string> {
    const creds = requireAwsCreds();
    const { TranscribeClient, ListTranscriptionJobsCommand } = await import('@aws-sdk/client-transcribe');
    const t = new TranscribeClient({ region: process.env.AWS_REGION || 'ap-south-1', credentials: creds });
    const res = await t.send(new ListTranscriptionJobsCommand({ MaxResults: 1 }));
    return `Transcribe API accessible (${res.TranscriptionJobSummaries?.length ?? 0} jobs)`;
}

async function testSupabase(): Promise<string> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SKIP: Supabase env vars not set');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb.from('global_feature_flags').select('key').limit(5);
    if (error) throw new Error(`Query failed: ${error.message}`);
    return `Connected, ${data?.length ?? 0} feature flags`;
}

async function testSupabaseModelRegistry(): Promise<string> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SKIP: Supabase env vars not set');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb.from('model_registry').select('model_id, provider, is_active').eq('provider', 'bedrock');
    if (error) throw new Error(`Query failed: ${error.message}`);
    const active = data?.filter(r => r.is_active) ?? [];
    if (active.length === 0) throw new Error('No Bedrock models in model_registry! Run INSERT SQL.');
    return `${active.length} Bedrock models registered: ${active.map(r => r.model_id.split('.')[1]?.split('-')[0] || r.model_id).join(', ')}`;
}

async function testSupabaseModelRouting(): Promise<string> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SKIP: Supabase env vars not set');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb.from('model_routing').select('model_id, use_case, priority, provider').eq('provider', 'bedrock').eq('is_active', true).order('priority');
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('No Bedrock routes in model_routing! Run INSERT SQL.');
    const chat = data.filter(r => r.use_case === 'chat');
    const analysis = data.filter(r => r.use_case === 'analysis');
    return `${chat.length} chat routes, ${analysis.length} analysis routes (${data.length} total)`;
}

async function testRedis(): Promise<string> {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('SKIP: Upstash Redis env vars not set');
    }
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const body = await res.json() as { result?: string };
    if (body.result === 'PONG') return 'PONG received';
    throw new Error(`Unexpected: ${JSON.stringify(body)}`);
}

// ─── Bedrock Model Ping Tests ───────────────────────────────────────────────

const BEDROCK_MODELS_TO_TEST = [
    {
        id: 'amazon.titan-embed-text-v2:0',
        label: 'Titan Embed v2',
        type: 'embedding' as const,
    },
    {
        id: 'openai.gpt-oss-120b-1:0',
        label: 'gpt-oss-120b (analysis)',
        type: 'chat' as const,
    },
    {
        id: 'openai.gpt-oss-20b-1:0',
        label: 'gpt-oss-20b (chat)',
        type: 'chat' as const,
    },
];

function makeBedrockModelTest(model: typeof BEDROCK_MODELS_TO_TEST[0]) {
    return async (): Promise<string> => {
        const creds = requireAwsCreds();
        const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
        const region = process.env.AWS_BEDROCK_REGION || 'us-east-1';
        const client = new BedrockRuntimeClient({ region, credentials: creds });

        if (model.type === 'embedding') {
            const res = await client.send(new InvokeModelCommand({
                modelId: model.id,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({ inputText: 'ping', dimensions: 256, normalize: true }),
            }));
            const body = JSON.parse(new TextDecoder().decode(res.body));
            return `OK — ${body.embedding?.length || 0}-dim embedding`;
        }

        // Chat model — send minimal prompt
        let payload: string;
        if (model.id.startsWith('anthropic.')) {
            payload = JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say OK' }],
            });
        } else {
            // OpenAI format (gpt-oss)
            payload = JSON.stringify({
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say OK' }],
            });
        }

        const res = await client.send(new InvokeModelCommand({
            modelId: model.id,
            contentType: 'application/json',
            accept: 'application/json',
            body: payload,
        }));
        const body = JSON.parse(new TextDecoder().decode(res.body));

        // Extract response text
        let text = '';
        if (body.content?.[0]?.text) text = body.content[0].text;
        else if (body.choices?.[0]?.message?.content) text = body.choices[0].message.content;
        else text = JSON.stringify(body).slice(0, 50);

        return `OK — "${text.trim().slice(0, 40)}"`;
    };
}

// ─── Summary Table ──────────────────────────────────────────────────────────

function printSummaryTable() {
    console.log('\n' + bold('┌─────────────────────────────────────────────────────────────────────────────────────────────┐'));
    console.log(bold('│                          ALGOMIND SERVICE VERIFICATION REPORT                               │'));
    console.log(bold('├────┬──────────────┬──────────────────────────────────┬────────┬───────┬──────────────────────┤'));
    console.log(bold('│ #  │ Category     │ Test                             │ Status │ ms    │ Detail               │'));
    console.log(bold('├────┼──────────────┼──────────────────────────────────┼────────┼───────┼──────────────────────┤'));

    results.forEach((r, i) => {
        const num = String(i + 1).padStart(2);
        const cat = r.category.padEnd(12).slice(0, 12);
        const name = r.name.padEnd(32).slice(0, 32);
        const statusStr = r.status === 'PASS' ? green('PASS  ')
            : r.status === 'FAIL' ? red('FAIL  ')
            : yellow('SKIP  ');
        const ms = r.latencyMs !== undefined ? String(r.latencyMs).padStart(5) : '    -';
        const detail = r.detail.slice(0, 20).padEnd(20);
        console.log(`│ ${num} │ ${cat} │ ${name} │ ${statusStr} │ ${ms} │ ${detail} │`);
    });

    console.log(bold('└────┴──────────────┴──────────────────────────────────┴────────┴───────┴──────────────────────┘'));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log(`\n  ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : `0 failed`}  ${yellow(`${skipped} skipped`)}  out of ${results.length} tests`);
    const totalMs = results.reduce((s, r) => s + (r.latencyMs ?? 0), 0);
    console.log(`  Total latency: ${cyan(`${totalMs}ms`)}\n`);

    if (failed > 0) {
        console.log(red(bold('  FAILED TESTS:')));
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(red(`    ✗ [${r.category}] ${r.name}`));
            console.log(red(`      ${r.detail}`));
        });
        console.log('');
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n' + bold('══════════════════════════════════════════════'));
    console.log(bold('  AlgoMind — Full Service Verification'));
    console.log(bold('══════════════════════════════════════════════') + '\n');

    console.log(cyan('Environment:'));
    console.log(`  AWS_REGION:          ${process.env.AWS_REGION || '(not set)'}`);
    console.log(`  AWS_BEDROCK_REGION:  ${process.env.AWS_BEDROCK_REGION || '(not set)'}`);
    console.log(`  AWS_S3_BUCKET:       ${process.env.AWS_S3_BUCKET || '(not set)'}`);
    console.log(`  AWS_ACCESS_KEY_ID:   ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.slice(0, 8) + '...' : '(not set)'}`);
    console.log(`  SUPABASE:            ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : '(not set)'}`);
    console.log(`  REDIS:               ${process.env.UPSTASH_REDIS_REST_URL ? 'configured' : '(not set)'}`);
    console.log('');

    // ── AWS Core ──
    console.log(bold('  AWS Core Services'));
    await runTest('AWS', 'STS GetCallerIdentity', testSTS);
    await runTest('AWS', 'S3 HeadBucket', testS3);
    await runTest('AWS', 'Polly DescribeVoices', testPolly);
    await runTest('AWS', 'Polly SynthesizeSpeech (Kajal)', testPollySynthesize);
    await runTest('AWS', 'Transcribe ListJobs', testTranscribe);

    // ── Bedrock Models ──
    console.log('\n' + bold('  Bedrock Model Pings') + dim(` (region: ${process.env.AWS_BEDROCK_REGION || 'us-east-1'})`));
    for (const model of BEDROCK_MODELS_TO_TEST) {
        await runTest('Bedrock', `${model.label} (${model.id})`, makeBedrockModelTest(model));
    }

    // ── Database & Cache ──
    console.log('\n' + bold('  Database & Cache'));
    await runTest('Supabase', 'Feature Flags query', testSupabase);
    await runTest('Supabase', 'model_registry (Bedrock rows)', testSupabaseModelRegistry);
    await runTest('Supabase', 'model_routing (Bedrock routes)', testSupabaseModelRouting);
    await runTest('Redis', 'Upstash PING', testRedis);

    // ── Print Table ──
    printSummaryTable();

    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(red(`\nFatal error: ${err}`));
    process.exit(1);
});
