import React, { useState, useEffect } from 'react';

interface InterviewLimitBarProps {
    startTime: number;
    maxMs: number;
    roundCount: number;
    maxRounds: number;
    isLimitReached: boolean;
    limitReason: 'rounds' | 'time' | null;
}

export function InterviewLimitBar({ startTime, maxMs, roundCount, maxRounds, isLimitReached, limitReason }: InterviewLimitBarProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const remainingMs = Math.max(0, maxMs - elapsed);
    const remainingMins = Math.floor(remainingMs / 60000);
    const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
    const timePercent = Math.min(100, (elapsed / maxMs) * 100);
    const roundPercent = Math.min(100, (roundCount / maxRounds) * 100);
    const isWarning = remainingMs < 120_000 || roundCount >= maxRounds - 3; // Last 2 mins or 3 rounds

    if (isLimitReached) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg text-xs text-amber-400">
                ⏰ {limitReason === 'time' ? 'Time limit reached' : 'Round limit reached'} — wrapping up...
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4 text-xs text-slate-400">
            {/* Time */}
            <div className="flex items-center gap-1.5">
                <span className={isWarning ? 'text-amber-400' : ''}>
                    ⏱ {remainingMins}:{remainingSecs.toString().padStart(2, '0')}
                </span>
                <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${timePercent > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${timePercent}%` }}
                    />
                </div>
            </div>
            {/* Rounds */}
            <div className="flex items-center gap-1.5">
                <span className={roundCount >= maxRounds - 3 ? 'text-amber-400' : ''}>
                    💬 {roundCount}/{maxRounds}
                </span>
            </div>
        </div>
    );
}
