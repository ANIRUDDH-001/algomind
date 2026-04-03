import { NextResponse } from 'next/server';
import { logSystemEvent } from '@/lib/monitoring/events';
import { randomUUID } from 'crypto';
import { redisGet, redisSet } from '@/lib/upstash/client';

export async function GET(request: Request) {
    try {
        const startedAt = Date.now();
        const correlationId = request.headers.get('x-correlation-id') || randomUUID();

        // 1. Verify Authorization header
        const authHeader = request.headers.get('authorization');
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return NextResponse.json(
                { triggered: false, error: 'Unauthorized' },
                { status: 401 }
            );
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
                duplicateResponse.headers.set('x-correlation-id', correlationId);
                return duplicateResponse;
            }

            await redisSet(dedupeKey, JSON.stringify({ ts: new Date().toISOString() }), 86400);
        }

        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO; // e.g., "ANIRUDDH-001/algomind"

        if (!githubToken || !githubRepo) {
            await logSystemEvent({
                type: 'cron_failed',
                errorMessage: 'Missing environment variables: GITHUB_TOKEN or GITHUB_REPO',
                correlation_id: correlationId,
                metadata: { idempotencyKey: idempotencyKey ?? null },
            });
            return NextResponse.json(
                { triggered: false, error: 'Missing GitHub configuration' },
                { status: 500 }
            );
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
            console.error('GitHub Actions API failed:', githubResponse.status, errorText);

            await logSystemEvent({
                type: 'cron_failed',
                errorMessage: `GitHub API failed with status ${githubResponse.status}: ${errorText}`,
                correlation_id: correlationId,
                metadata: { idempotencyKey: idempotencyKey ?? null },
            });

            return NextResponse.json(
                { triggered: false, error: 'Failed to trigger workflow' },
                { status: 502 }
            );
        }

        // 3. Return success and log it
        await logSystemEvent({
            type: 'cron_triggered',
            correlation_id: correlationId,
            metadata: {
                message: 'Successfully triggered nightly batch workflow',
                idempotencyKey: idempotencyKey ?? null,
                duration_ms: Date.now() - startedAt,
            },
        });

        const response = NextResponse.json({
            triggered: true,
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
        });
        response.headers.set('x-correlation-id', correlationId);
        return response;
    } catch (error) {
        // 4. Return formatted failure, never throw
        console.error('Cron trigger error:', error);

        await logSystemEvent({
            type: 'cron_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { triggered: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
