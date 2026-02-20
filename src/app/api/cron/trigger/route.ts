import { NextResponse } from 'next/server';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET(request: Request) {
    try {
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

        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO; // e.g., "ANIRUDDH-001/algomind"

        if (!githubToken || !githubRepo) {
            await logSystemEvent({
                type: 'cron_failed',
                errorMessage: 'Missing environment variables: GITHUB_TOKEN or GITHUB_REPO',
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
            });

            return NextResponse.json(
                { triggered: false, error: 'Failed to trigger workflow' },
                { status: 502 }
            );
        }

        // 3. Return success and log it
        await logSystemEvent({
            type: 'cron_completed',
            metadata: {
                message: 'Successfully triggered nightly batch workflow',
            },
        });

        return NextResponse.json({
            triggered: true,
            timestamp: new Date().toISOString(),
        });
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
