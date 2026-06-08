/**
 * @codesage
 * @file      scripts/enforce-observability-retention.ts
 * @purpose   Purges old observability events from the database to maintain data retention policies
 * @tech      Supabase, Node.js, dotenv
 * @connects  Imports getServiceClient from src/lib/supabase/service and logs events via src/lib/monitoring/events
 * @apis      none
 * @db        Accesses system_events table
 * @state     none
 * @env       Loads env variables via dotenv
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import 'dotenv/config';
import { getServiceClient } from '../src/lib/supabase/service';
import { logSystemLifecycle } from '../src/lib/monitoring/events';

interface RetentionSnapshot {
    hot_0_30_days: number;
    warm_31_180_days: number;
    cold_181_730_days: number;
    purge_older_than_730_days: number;
    purged_count: number;
}

async function getCountSince(iso: string): Promise<number> {
    const supabase = getServiceClient();
    const { count, error } = await supabase
        .from('system_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', iso);

    if (error) throw error;
    return count ?? 0;
}

async function getCountBetween(startIso: string, endIso: string): Promise<number> {
    const supabase = getServiceClient();
    const { count, error } = await supabase
        .from('system_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startIso)
        .lt('created_at', endIso);

    if (error) throw error;
    return count ?? 0;
}

async function purgeOlderThan(iso: string): Promise<number> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
        .from('system_events')
        .delete()
        .lt('created_at', iso)
        .select('id');

    if (error) throw error;
    return data?.length ?? 0;
}

export async function runObservabilityRetention() {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const d180 = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();
    const d730 = new Date(now - 730 * 24 * 60 * 60 * 1000).toISOString();

    const snapshot: RetentionSnapshot = {
        hot_0_30_days: 0,
        warm_31_180_days: 0,
        cold_181_730_days: 0,
        purge_older_than_730_days: 0,
        purged_count: 0,
    };

    try {
        snapshot.hot_0_30_days = await getCountSince(d30);
        snapshot.warm_31_180_days = await getCountBetween(d180, d30);
        snapshot.cold_181_730_days = await getCountBetween(d730, d180);

        const supabase = getServiceClient();
        const { count: purgeCandidates, error: purgeCountError } = await supabase
            .from('system_events')
            .select('id', { count: 'exact', head: true })
            .lt('created_at', d730);

        if (purgeCountError) throw purgeCountError;
        snapshot.purge_older_than_730_days = purgeCandidates ?? 0;

        if (snapshot.purge_older_than_730_days > 0) {
            snapshot.purged_count = await purgeOlderThan(d730);
        }

        await logSystemLifecycle({
            type: 'batch.completed',
            jobName: 'observability-retention',
            status: 'success',
            startedAt,
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            metadata: {
                recordsProcessed: snapshot.hot_0_30_days + snapshot.warm_31_180_days + snapshot.cold_181_730_days + snapshot.purge_older_than_730_days,
                recordsSucceeded: snapshot.hot_0_30_days + snapshot.warm_31_180_days + snapshot.cold_181_730_days,
                recordsFailed: 0,
                extra: snapshot,
            },
        });

        console.log('[retention] snapshot', snapshot);
    } catch (error) {
        await logSystemLifecycle({
            type: 'batch.failed',
            jobName: 'observability-retention',
            status: 'failure',
            startedAt,
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            metadata: {
                failureReason: error instanceof Error ? error.message : String(error),
                extra: snapshot,
            },
        });

        throw error;
    }
}

if (require.main === module) {
    runObservabilityRetention().catch((error) => {
        console.error('[retention] failed', error);
        process.exit(1);
    });
}
