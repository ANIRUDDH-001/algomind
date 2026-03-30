'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { reportError } from '@/lib/telemetry/report-error';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        reportError(error, {
            severity: 'error',
            extra: {
                route: 'admin',
                digest: error.digest ?? '',
            },
        });
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-950/40 border border-yellow-500/25 mb-4">
                    <AlertTriangle size={24} className="text-yellow-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Admin panel failed to load</h2>
                <p className="text-sm text-zinc-400 mb-4">Try refreshing the page. If this persists, use the digest below for debugging.</p>
                {error.digest && (
                    <p className="text-xs text-zinc-500 mb-6 font-mono">Digest: {error.digest}</p>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={14} />
                        Try again
                    </button>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
