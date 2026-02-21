import 'dotenv/config';
import { syncModelRegistry } from './batch/sync-models';
import { runCleanup } from './batch/cleanup';
import { logSystemEvent } from '../src/lib/monitoring/events';
import { updateKaiMemory } from '../src/lib/ai/memory-generator';
import { computeInsightsForUser } from '../src/lib/recommendations/insight-engine';
import { updateNarrativeIfDue } from '../src/lib/assessment/narrative-generator';
import { createClient } from '@supabase/supabase-js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function updateAllKaiMemories() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users who completed a session in last 24h
    const { data: recentUsers } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 86400000).toISOString());

    const userIds = [...new Set(recentUsers?.map((r: any) => r.user_id) || [])];

    // Process 5 at a time
    for (let i = 0; i < userIds.length; i += 5) {
        const batch = userIds.slice(i, i + 5);
        await Promise.allSettled(batch.map((id: string) => updateKaiMemory(id)));
        if (i + 5 < userIds.length) await sleep(600);
    }
    console.log(`[kai-memory] Updated ${userIds.length} users`);
}

async function updateInsightSnapshots() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // All users who completed a session in last 7 days (not just 24h — insights are weekly)
    const { data } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const userIds = [...new Set(data?.map((r: any) => r.user_id) || [])];

    // Process 3 at a time (LLM calls inside)
    for (let i = 0; i < userIds.length; i += 3) {
        const batch = userIds.slice(i, i + 3);
        await Promise.allSettled(batch.map((id: string) => computeInsightsForUser(id)));
        if (i + 3 < userIds.length) await sleep(1000);
    }
    console.log(`[insights] Computed snapshots for ${userIds.length} users`);
}

async function updateNarratives() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users who completed a session in the last 24h
    // (This ensures we check if it was their 5th/10th session)
    const { data } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 86400000).toISOString());

    const userIds = [...new Set(data?.map((r: any) => r.user_id) || [])];
    let generatedCount = 0;

    // Process 2 at a time (Gemini calls, quality matters)
    for (let i = 0; i < userIds.length; i += 2) {
        const batch = userIds.slice(i, i + 2);
        const results = await Promise.allSettled(batch.map((id: string) => updateNarrativeIfDue(id)));

        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) generatedCount++;
        });

        if (i + 2 < userIds.length) await sleep(2000); // 2s delay between LLM batches
    }
    console.log(`[narratives] Generated coach profiles for ${generatedCount}/${userIds.length} active users`);
}

async function main() {
    const startTime = Date.now();
    const results: Record<string, 'ok' | 'skipped' | 'error'> = {};

    console.log('[Nightly Batch] Starting at', new Date().toISOString());

    // Step 1: Model registry sync (Phase 1)
    // Step 2: LeetCode profiles (Phase 2) — placeholder
    // Step 3: Learner profiles (Phase 3) — placeholder
    // Step 4: Insight snapshots (Phase 3) — placeholder
    // Step 5: Kai memory (Phase 3) — placeholder
    // Step 6: Spaced repetition (Phase 4) — placeholder
    // Step 7: Cognitive narratives (Phase 3) — placeholder
    // Step 8: Cleanup (Phase 1)

    const step = async (name: string, fn: () => Promise<void>) => {
        try {
            console.log(`[${name}] Starting...`);
            await fn();
            results[name] = 'ok';
            console.log(`[${name}] ✅ Done`);
        } catch (err) {
            results[name] = 'error';
            console.error(`[${name}] ❌ Failed:`, err);
            // Don't rethrow — continue to next step
        }
    };

    await step('model-sync', syncModelRegistry);
    await step('cleanup', runCleanup);
    await step('insights-snapshot', updateInsightSnapshots);
    await step('kai-memory', updateAllKaiMemories);
    await step('narratives', updateNarratives);

    const duration = Date.now() - startTime;
    console.log('[Nightly Batch] Complete in', duration, 'ms');
    console.log('[Nightly Batch] Results:', results);

    // Log completion to system_events
    await logSystemEvent({
        type: 'cron_completed',
        metadata: {
            duration_ms: duration,
            results
        }
    });
}

main().catch(console.error);
