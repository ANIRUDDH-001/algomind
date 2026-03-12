'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface AnalysisPendingBannerProps {
    submissionId: string;
    onComplete: () => void;
}

export function AnalysisPendingBanner({ submissionId, onComplete }: AnalysisPendingBannerProps) {
    const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
    const [attempts, setAttempts] = useState(0);
    const MAX_ATTEMPTS = 30; // 30 * 3s = 90 seconds max wait

    useEffect(() => {
        if (status !== 'pending' || attempts >= MAX_ATTEMPTS) return;

        const id = setTimeout(async () => {
            try {
                const res = await fetch(`/api/user/submissions/${submissionId}/report`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.scores !== null && data.scores !== undefined) {
                        setStatus('completed');
                        onComplete();
                        return;
                    }
                }
            } catch { /* retry */ }
            setAttempts(a => a + 1);
        }, 3000);

        return () => clearTimeout(id);
    }, [status, attempts, submissionId, onComplete]);

    if (status === 'completed') {
        return (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium" data-testid="analysis-complete">
                <CheckCircle2 className="w-4 h-4" />
                Analysis complete!
            </div>
        );
    }

    if (attempts >= MAX_ATTEMPTS) {
        return (
            <p className="text-amber-400 text-sm" data-testid="analysis-timeout">
                Analysis is taking longer than usual. Check back in a few minutes.
            </p>
        );
    }

    return (
        <div className="flex items-center gap-2 text-zinc-400 text-sm" data-testid="analysis-pending">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analysing your responses… (~{Math.max(0, 30 - attempts)}s)
        </div>
    );
}
