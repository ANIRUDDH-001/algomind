'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { reportError } from '@/lib/telemetry/report-error';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Assessment] Error:', error);
        reportError(error, { severity: 'error' });
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="text-center max-w-md space-y-4">
                <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500" />
                <h2 className="text-lg font-semibold">Assessment error</h2>
                <p className="text-sm text-muted-foreground">Something went wrong. Don't worry — your progress has been saved.</p>
                <div className="flex gap-3 justify-center pt-2">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                        <RefreshCcw className="h-4 w-4" /> Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
