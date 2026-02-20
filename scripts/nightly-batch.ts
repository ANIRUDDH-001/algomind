import 'dotenv/config';
import { syncModelRegistry } from './batch/sync-models';
import { runCleanup } from './batch/cleanup';
import { logSystemEvent } from '../src/lib/monitoring/events';

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
