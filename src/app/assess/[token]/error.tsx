'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '@/lib/telemetry/report-error';

export default function AssessmentError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        reportError(error, {
            severity: 'error',
            extra: { route: 'assess-token' },
        });
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-950/40 border border-yellow-500/25 mb-4">
                    <AlertTriangle size={24} className="text-yellow-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Assessment issue detected</h2>
                <p className="text-sm text-zinc-400 mb-6">
                    There was a problem with your assessment. Do not worry, your progress has been saved.
                </p>
                <div className="flex justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={14} />
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}
