'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface AnalysisPendingBannerProps {
    submissionId: string;
    onComplete: () => void;
}

export function AnalysisPendingBanner({ submissionId, onComplete }: AnalysisPendingBannerProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const MAX_POLLS = 18; // 3 minutes max (18 × 10s)

    const checkStatus = async () => {
        setIsChecking(true);
        try {
            const res = await fetch(`/api/user/submissions/${submissionId}/report`);
            if (res.ok) {
                const data = await res.json();
                if (data.scores !== null && data.scores !== undefined) {
                    onComplete();
                    return true;
                }
            }
        } catch {
            // Ignore polling network failures and keep retrying.
        } finally {
            setIsChecking(false);
        }
        return false;
    };

    useEffect(() => {
        if (pollCount >= MAX_POLLS) return;

        let cancelled = false;

        const runCheck = async () => {
            const isComplete = await checkStatus();
            if (!cancelled && !isComplete) {
                setPollCount((c) => c + 1);
            }
        };

        const intervalId = window.setInterval(() => {
            void runCheck();
        }, 10000);

        void runCheck();

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [pollCount, submissionId, onComplete]);

    return (
        <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'var(--surface-1)', border: '1px solid rgba(99,102,241,0.2)' }}
            data-testid="analysis-pending"
        >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Loader2 className={`w-5 h-5 text-indigo-400 ${isChecking ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1">
                <p className="text-sm font-bold text-white mb-0.5">Analysis in progress</p>
                <p className="text-xs text-zinc-400" data-testid={pollCount >= MAX_POLLS ? 'analysis-timeout' : undefined}>
                    {pollCount < MAX_POLLS
                        ? 'Your cognitive profile is being computed. This page will update automatically.'
                        : 'Taking longer than expected.'}
                </p>
            </div>
            <button
                onClick={() => {
                    void checkStatus();
                }}
                disabled={isChecking}
                className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ background: 'var(--surface-2)' }}
                aria-label="Manually check analysis status"
                title="Check now"
            >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
        </div>
    );
}
