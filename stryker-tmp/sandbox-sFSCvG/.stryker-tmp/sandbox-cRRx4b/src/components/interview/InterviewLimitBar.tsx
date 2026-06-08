/**
 * @codesage
 * @file      src/components/interview/InterviewLimitBar.tsx
 * @purpose   Displays the progress bar for interview time and rounds limits.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     useState, useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

//  -- automated unused local suppression
import React, { useState, useEffect } from 'react';
import { Timer, MessageSquare, ClockAlert } from 'lucide-react';

interface InterviewLimitBarProps {
    startTime: number;
    maxMs: number;
    roundCount: number;
    maxRounds: number;
    isLimitReached: boolean;
    limitReason: 'rounds' | 'time' | null;
    weeklyUsage?: {
        sessionsUsed: number;
        limit: number;
        allowed: boolean;
    };
    onUpgrade?: () => void;
}

function formatMs(ms: number): string {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function InterviewLimitBar({
    startTime,
    maxMs,
    roundCount,
    maxRounds,
    isLimitReached,
    limitReason,
    weeklyUsage,
    onUpgrade,
}: InterviewLimitBarProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const remainingMs = Math.max(0, maxMs - elapsed);
    const timePercent = Math.min(100, (elapsed / maxMs) * 100);
    const isWarning = remainingMs < 120_000 || roundCount >= maxRounds - 3;
    const weeklyPercent = weeklyUsage ? Math.min(100, (weeklyUsage.sessionsUsed / Math.max(weeklyUsage.limit, 1)) * 100) : 0;
    const weeklyRemaining = weeklyUsage ? Math.max(0, weeklyUsage.limit - weeklyUsage.sessionsUsed) : 0;

    if (isLimitReached) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg text-xs text-amber-400">
                <ClockAlert className="w-4 h-4" /> {limitReason === 'time' ? 'Time limit reached' : 'Round limit reached'} — wrapping up...
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 text-xs text-zinc-400">
            <div className="flex items-center gap-4">
                {/* Time: elapsed / total */}
                <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1.5 ${isWarning ? 'text-amber-400' : ''}`}>
                        <Timer className="w-3.5 h-3.5" /> {formatMs(elapsed)}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500">{formatMs(maxMs)}</span>
                    <div className="w-16 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${timePercent > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${timePercent}%` }}
                        />
                    </div>
                </div>
                {/* Rounds */}
                <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1.5 ${roundCount >= maxRounds - 3 ? 'text-amber-400' : ''}`}>
                        <MessageSquare className="w-3.5 h-3.5" /> {roundCount}/{maxRounds}
                    </span>
                </div>
            </div>

            {weeklyUsage && (
                <div className="flex items-center gap-2 bg-zinc-900/70 border border-zinc-800 rounded-md px-2 py-1">
                    <span className={weeklyRemaining <= 1 ? 'text-amber-400 font-semibold' : 'text-zinc-300'}>
                        Weekly: {weeklyUsage.sessionsUsed}/{weeklyUsage.limit}
                    </span>
                    <div className="w-20 h-1 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${weeklyPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${weeklyPercent}%` }}
                        />
                    </div>
                    {!weeklyUsage.allowed && onUpgrade && (
                        <button
                            type="button"
                            onClick={onUpgrade}
                            className="text-[10px] uppercase tracking-wide font-bold text-amber-300 hover:text-amber-200"
                        >
                            Upgrade
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
