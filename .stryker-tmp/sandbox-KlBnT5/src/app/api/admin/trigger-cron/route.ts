/**
 * @codesage
 * @file      src/app/api/admin/trigger-cron/route.ts
 * @purpose   Manually dispatches the nightly batch GitHub Actions workflow.
 * @tech      Next.js, Redis, TypeScript, GitHub API
 * @connects  @/lib/auth/requireAdminForApi, @/lib/monitoring/events, @/lib/upstash/client
 * @apis      GitHub Actions (api.github.com/repos/.../dispatches)
 * @db        none (Redis used for caching)
 * @state     none
 * @env       GITHUB_TOKEN, GITHUB_REPO
 * @issues    Removed console.error. Flagged empty catch block for Redis cache invalidation.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getRedis } from '@/lib/upstash/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/trigger-cron
 *
 * Admin-authenticated endpoint to manually dispatch the nightly batch
 * via GitHub Actions workflow_dispatch. Does NOT require CRON_SECRET —
 * admin session auth is the guard here.
 *
 * Note: This only *dispatches* the workflow. The actual batch runs on
 * GitHub-hosted runners (~10–20 min). Results appear in the Nightly Batch
 * Status table once the batch logs a cron_completed event.
 */
export async function POST() {
    try {
        const { user, errorResponse } = await requireAdminForApi();
        if (errorResponse || !user) {
            return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO;

        if (!githubToken || !githubRepo) {
            return NextResponse.json(
                { error: 'GitHub integration not configured (missing GITHUB_TOKEN or GITHUB_REPO env vars)' },
                { status: 500 }
            );
        }

        const githubResponse = await fetch(
            `https://api.github.com/repos/${githubRepo}/actions/workflows/nightly-batch.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ref: 'main' }),
            }
        );

        if (!githubResponse.ok) {
            const errorText = await githubResponse.text();

            await logSystemEvent({
                type: 'cron_failed',
                userId: user.id,
                errorMessage: `Admin trigger failed — GitHub API returned ${githubResponse.status}: ${errorText}`,
                metadata: { triggeredBy: user.email, source: 'admin_ui' },
            });

            return NextResponse.json(
                { error: `GitHub Actions dispatch failed (HTTP ${githubResponse.status})` },
                { status: 502 }
            );
        }

        // Log as triggered — NOT completed. The batch itself logs cron_completed when done.
        await logSystemEvent({
            type: 'cron_triggered',
            userId: user.id,
            metadata: {
                triggeredBy: user.email,
                source: 'admin_ui',
                message: 'Admin manually dispatched nightly batch via GitHub Actions workflow_dispatch',
            },
        });

        // Invalidate admin analytics cache so next dashboard load fetches fresh data
        try {
            const redis = getRedis();
            if (redis) {
                const keys = await redis.keys('admin:*');
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            }
        } catch {
            // Cache invalidation failure is non-critical
        }

        return NextResponse.json({
            dispatched: true,
            message: 'Nightly batch dispatched. Results will appear in ~10–20 minutes.',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
