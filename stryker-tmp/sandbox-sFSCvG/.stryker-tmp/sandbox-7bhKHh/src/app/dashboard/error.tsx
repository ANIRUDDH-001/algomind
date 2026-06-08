/**
 * @codesage
 * @file      src/app/dashboard/error.tsx
 * @purpose   Error boundary for dashboard
 * @tech      Next.js client component, React, Lucide React
 * @connects  @/lib/telemetry/report-error, next/link
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';
import { reportError } from '@/lib/telemetry/report-error';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {

        reportError(error, { severity: 'error' });
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="text-center max-w-md space-y-4">
                <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500" />
                <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
                <p className="text-sm text-muted-foreground">We couldn't load your data. This is usually temporary.</p>
                <div className="flex gap-3 justify-center pt-2">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                        <RefreshCcw className="h-4 w-4" /> Try Again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
                    >
                        <Home className="h-4 w-4" /> Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
