/**
 * @codesage
 * @file      src/app/api/cron/trigger/route.ts
 * @purpose   Secure trigger endpoint for dispatching nightly batch GitHub Actions workflows.
 * @tech      Next.js, Redis, TypeScript
 * @connects  @/lib/monitoring/events, @/lib/upstash/client
 * @apis      GitHub Actions (api.github.com/repos/.../dispatches)
 * @db        none
 * @state     Redis (idempotency checks)
 * @env       CRON_SECRET, GITHUB_TOKEN, GITHUB_REPO
 * @issues    Removed console logs.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { NextResponse } from 'next/server';
import { logSystemLifecycle } from '@/lib/monitoring/events';
import { redisGet, redisSet } from '@/lib/upstash/client';
import { getCorrelationIdFromRequest, withCorrelationId } from '@/lib/tracing/correlation';

export async function GET(request: Request) {
    const correlationId = getCorrelationIdFromRequest(request);
    const withCorrelationIdResponse = <T extends Response>(response: T): T => withCorrelationId(response, correlationId);

    try {
        const startedAt = Date.now();

        // 1. Verify Authorization header
        const authHeader = request.headers.get('authorization');
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return withCorrelationIdResponse(NextResponse.json(
                { triggered: false, error: 'Unauthorized' },
                { status: 401 }
            ));
        }

        const idempotencyKey = request.headers.get('x-idempotency-key');
        if (idempotencyKey) {
            const dedupeKey = `cron:idempotency:${idempotencyKey}`;
            const existing = await redisGet(dedupeKey);
            if (existing) {
                const duplicateResponse = NextResponse.json(
                    {
                        triggered: false,
                        duplicate: true,
                        error: 'Duplicate request',
                    },
                    { status: 409 }
                );
                return withCorrelationIdResponse(duplicateResponse);
            }

            await redisSet(dedupeKey, JSON.stringify({ ts: new Date().toISOString() }), 86400);
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO; // e.g., "ANIRUDDH-001/algomind"

        if (!githubToken || !githubRepo) {
            await logSystemLifecycle({
                type: 'cron.failed',
                jobName: 'vercel-cron-trigger',
                status: 'failure',
                startedAt: new Date(startedAt).toISOString(),
                endedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt,
                correlationId,
                metadata: {
                    failureReason: 'Missing environment variables: GITHUB_TOKEN or GITHUB_REPO',
                    extra: { idempotencyKey: idempotencyKey ?? null },
                }
            });
            return withCorrelationIdResponse(NextResponse.json(
                { triggered: false, error: 'Missing GitHub configuration' },
                { status: 500 }
            ));
        }

        // 2. Call GitHub Actions workflow dispatch API
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

            await logSystemLifecycle({
                type: 'cron.failed',
                jobName: 'vercel-cron-trigger',
                status: 'failure',
                startedAt: new Date(startedAt).toISOString(),
                endedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt,
                correlationId,
                metadata: {
                    failureReason: `GitHub API failed with status ${githubResponse.status}: ${errorText}`,
                    extra: { idempotencyKey: idempotencyKey ?? null },
                }
            });

            return withCorrelationIdResponse(NextResponse.json(
                { triggered: false, error: 'Failed to trigger workflow' },
                { status: 502 }
            ));
        }

        // 3. Return success and log it
        await logSystemLifecycle({
            type: 'cron.triggered',
            jobName: 'vercel-cron-trigger',
            status: 'success',
            startedAt: new Date(startedAt).toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            correlationId,
            metadata: {
                extra: {
                    message: 'Successfully triggered nightly batch workflow',
                    idempotencyKey: idempotencyKey ?? null,
                },
            },
        });

        const response = NextResponse.json({
            triggered: true,
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
        });
        return withCorrelationIdResponse(response);
    } catch (error) {
        // 4. Return formatted failure, never throw

        await logSystemLifecycle({
            type: 'cron.failed',
            jobName: 'vercel-cron-trigger',
            status: 'failure',
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: 0,
            correlationId,
            metadata: {
                failureReason: error instanceof Error ? error.message : String(error),
            },
        });

        return withCorrelationIdResponse(NextResponse.json(
            { triggered: false, error: 'Internal Server Error' },
            { status: 500 }
        ));
    }
}
