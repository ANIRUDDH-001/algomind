/**
 * @codesage
 * @file      scripts/nightly-batch.ts
 * @purpose   Orchestrates scheduled background tasks like model sync, cleanup, and generating AI insights
 * @tech      Node.js, dotenv, Supabase
 * @connects  Imports various batch jobs and monitoring services
 * @apis      none
 * @db        Queries interview_sessions table
 * @state     none
 * @env       Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import 'dotenv/config';
import { syncModelRegistry } from './batch/sync-models';
import { runCleanup } from './batch/cleanup';
import { computeAllLearnerProfiles } from './batch/compute-learner-profiles';
import { logSystemLifecycle } from '../src/lib/monitoring/events';
import { updateKaiMemory } from '../src/lib/ai/memory-generator';
import { computeInsightsForUser } from '../src/lib/recommendations/insight-engine';
import { updateNarrativeIfDue } from '../src/lib/assessment/narrative-generator';
import { getServiceClient } from '../src/lib/supabase/service';
import { createCorrelationId } from '../src/lib/tracing/correlation';
import { runObservabilityRetention } from './enforce-observability-retention';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Timeout utility ────────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

// ── Shared helper: deduplicated user IDs from interview_sessions ───────────────
async function getRecentUserIds(windowMs: number): Promise<string[]> {
    const supabase = getServiceClient();
    const { data } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - windowMs).toISOString());

    return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
}

// ── Step: Kai memory ───────────────────────────────────────────────────────────
async function updateAllKaiMemories() {
    const userIds = await getRecentUserIds(86_400_000); // last 24 h

    let ok = 0;
    let failed = 0;

    // Sequential: one user at a time so a hung LLM call can't block all slots
    for (const userId of userIds) {
        try {
            await withTimeout(
                updateKaiMemory(userId),
                30_000,
                `updateKaiMemory for user ${userId}`
            );
            console.log(`✅ [kai-memory] Updated ${userId}`);
            ok++;
        } catch (err) {
            console.error(
                `❌ [kai-memory] FAILED for ${userId}:`,
                err instanceof Error ? err.message : err
            );
            failed++;
            // Continue to next user — don't rethrow
        }
        await sleep(200); // light throttle between users
    }

    console.log(`[kai-memory] Done — ${ok} ok, ${failed} failed / ${userIds.length} total`);
}

// ── Step: Insight snapshots ────────────────────────────────────────────────────
async function updateInsightSnapshots() {
    const userIds = await getRecentUserIds(7 * 86_400_000); // last 7 days

    let ok = 0;
    let failed = 0;

    for (const userId of userIds) {
        try {
            await withTimeout(
                computeInsightsForUser(userId),
                45_000,
                `computeInsightsForUser for user ${userId}`
            );
            console.log(`✅ [insights] Computed snapshot for ${userId}`);
            ok++;
        } catch (err) {
            console.error(
                `❌ [insights] FAILED for ${userId}:`,
                err instanceof Error ? err.message : err
            );
            failed++;
        }
        await sleep(300);
    }

    console.log(`[insights] Done — ${ok} ok, ${failed} failed / ${userIds.length} total`);
}

// ── Step: Cognitive narratives ─────────────────────────────────────────────────
async function updateNarratives() {
    const userIds = await getRecentUserIds(86_400_000); // last 24 h

    let generatedCount = 0;
    let failed = 0;

    for (const userId of userIds) {
        try {
            const generated = await withTimeout(
                updateNarrativeIfDue(userId),
                60_000,
                `generateCognitiveNarrative for user ${userId}`
            );
            if (generated) {
                console.log(`✅ [narratives] Generated for ${userId}`);
                generatedCount++;
            }
        } catch (err) {
            console.error(
                `❌ [narratives] FAILED for ${userId}:`,
                err instanceof Error ? err.message : err
            );
            failed++;
        }
        await sleep(500); // longer pause — Gemini quality calls
    }

    console.log(`[narratives] Done — ${generatedCount} generated, ${failed} failed / ${userIds.length} total`);
}

async function enforceObservabilityRetention() {
    await runObservabilityRetention();
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    // ── Watchdog: kill the process if the entire batch exceeds 60 minutes ──
    const BATCH_TIMEOUT_MS = 60 * 60 * 1000;
    const batchTimeout = setTimeout(() => {
        console.error('[batch] WATCHDOG: Total batch exceeded 60 minutes — forcing exit');
        process.exit(1);
    }, BATCH_TIMEOUT_MS);
    // Prevent the watchdog timer from keeping Node alive on its own
    batchTimeout.unref();

    const startTime = Date.now();
    const batchId = createCorrelationId();
    const batchStartedAt = new Date().toISOString();
    const results: Record<string, 'ok' | 'skipped' | 'error'> = {};

    console.log('[Nightly Batch] Starting at', batchStartedAt);
    console.log('[Nightly Batch] Batch ID:', batchId);

    try {
        // Log that we STARTED
        await logSystemLifecycle({
            type: 'batch.step_started',
            jobName: 'nightly-batch',
            status: 'started',
            startedAt: batchStartedAt,
        });

        const step = async (name: string, fn: () => Promise<void>) => {
            const stepStart = Date.now();
            const stepStartedAt = new Date(stepStart).toISOString();
            try {
                console.log(`[${name}] Starting...`);
                await fn();
                results[name] = 'ok';
                const duration = Date.now() - stepStart;
                console.log(`[${name}] ✅ Done in ${duration}ms`);
                
                // Log step completion
                await logSystemLifecycle({
                    type: 'batch.step_completed',
                    jobName: `nightly-batch:${name}`,
                    status: 'success',
                    startedAt: stepStartedAt,
                    endedAt: new Date().toISOString(),
                    durationMs: duration,
                });
            } catch (err) {
                results[name] = 'error';
                const errorMessage = err instanceof Error ? err.message : String(err);
                const duration = Date.now() - stepStart;
                console.error(`[${name}] ❌ Failed:`, err);
                
                // Log step failure
                await logSystemLifecycle({
                    type: 'batch.step_failed',
                    jobName: `nightly-batch:${name}`,
                    status: 'failure',
                    startedAt: stepStartedAt,
                    endedAt: new Date().toISOString(),
                    durationMs: duration,
                    metadata: {
                        failureReason: errorMessage,
                    }
                });
                // Don't rethrow — continue to next step
            }
        };

        await step('model-sync', syncModelRegistry);
        await step('cleanup', runCleanup);
        await step('learner-profiles', computeAllLearnerProfiles);
        await step('insights-snapshot', updateInsightSnapshots);
        await step('kai-memory', updateAllKaiMemories);
        await step('narratives', updateNarratives);
        await step('observability-retention', enforceObservabilityRetention);

        const duration = Date.now() - startTime;
        const batchEndedAt = new Date().toISOString();
        const successCount = Object.values(results).filter(r => r === 'ok').length;
        const failureCount = Object.values(results).filter(r => r === 'error').length;
        
        console.log('[Nightly Batch] Complete in', duration, 'ms');
        console.log('[Nightly Batch] Results:', results);

        // Determine overall status
        const overallStatus = failureCount === 0 ? 'success' : failureCount === successCount ? 'failure' : 'partial_success';

        // Log overall completion to system_events with structured telemetry
        try {
            await logSystemLifecycle({
                type: 'batch.completed',
                jobName: 'nightly-batch',
                status: overallStatus,
                startedAt: batchStartedAt,
                endedAt: batchEndedAt,
                durationMs: duration,
                metadata: {
                    recordsProcessed: Object.keys(results).length,
                    recordsSucceeded: successCount,
                    recordsFailed: failureCount,
                }
            });
        } catch (logErr) {
            // If this fails, at least log to stdout (visible in GitHub Actions logs)
            console.error('[CRITICAL] Failed to log batch completion to Supabase:', logErr);
            console.error('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
            console.error('Service role:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const duration = Date.now() - startTime;
        const batchEndedAt = new Date().toISOString();
        
        console.error('[BATCH FAILED]', errorMessage);
        try {
            await logSystemLifecycle({
                type: 'batch.failed',
                jobName: 'nightly-batch',
                status: 'failure',
                startedAt: batchStartedAt,
                endedAt: batchEndedAt,
                durationMs: duration,
                metadata: {
                    failureReason: errorMessage,
                }
            });
        } catch (logErr) {
            console.error('[ALSO FAILED TO LOG FAILURE]', logErr);
            console.error('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
            console.error('Service role:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');
        }
        process.exit(1);
    }

    // Disarm watchdog now that we've finished cleanly
    clearTimeout(batchTimeout);
}

main().catch(console.error);
