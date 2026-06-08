/**
 * @codesage
 */
'use client';

// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { TrendingUp } from 'lucide-react';

// Map hire decisions to numeric values for trend chart
const HIRE_NUMERIC: Record<string, number> = {
    'STRONG_HIRE': 5,
    'HIRE': 4,
    'BORDERLINE': 3,
    'NO_HIRE': 2,
    'STRONG_NO_HIRE': 1,
};

const HIRE_LABELS: Record<number, string> = {
    5: 'Strong Hire',
    4: 'Hire',
    3: 'Borderline',
    2: 'No Hire',
    1: 'Strong No',
};

const HIRE_COLORS: Record<number, string> = {
    5: '#10b981',
    4: '#34d399',
    3: '#f59e0b',
    2: '#ef4444',
    1: '#dc2626',
};

interface TrendEntry {
    sessionId: string;
    hireDecision: string;
    score: number;
    completedAt: string;
    problemDifficulty?: string;
}

interface HireReadinessTrendProps {
    trend: TrendEntry[];
}

export function HireReadinessTrend({ trend }: HireReadinessTrendProps) {
    if (!trend || trend.length === 0) {
        return (
            <div className="bg-[var(--surface-1)]/40 border border-white/8/60 rounded-2xl p-4" data-testid="hire-readiness-empty">
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Hire Readiness</span>
                </div>
                <p className="text-xs text-zinc-500">Complete sessions to track hire readiness trend.</p>
            </div>
        );
    }

    // Show last 10 sessions
    const recentTrend = trend.slice(-10);
    const chartWidth = 280;
    const chartHeight = 80;
    const paddingX = 4;
    const paddingY = 8;
    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingY * 2;

    // Map to data points
    const points = recentTrend.map((entry, i) => {
        const value = HIRE_NUMERIC[entry.hireDecision] ?? 3;
        const x = paddingX + (recentTrend.length > 1 ? (i / (recentTrend.length - 1)) * usableWidth : usableWidth / 2);
        // y: 1 at bottom, 5 at top
        const y = paddingY + usableHeight - ((value - 1) / 4) * usableHeight;
        return { x, y, value, entry };
    });

    // Build SVG path
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Latest value for color
    const latestValue = points[points.length - 1]?.value ?? 3;
    const lineColor = HIRE_COLORS[latestValue] ?? '#6b7280';

    return (
        <div className="bg-[var(--surface-1)]/40 border border-white/8/60 rounded-2xl p-4" data-testid="hire-readiness-trend">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Hire Readiness</span>
                </div>
                <span
                    className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={{
                        color: lineColor,
                        background: lineColor + '20',
                    }}
                >
                    {HIRE_LABELS[latestValue] || 'Unknown'}
                </span>
            </div>

            {/* Mini SVG chart */}
            <svg width={chartWidth} height={chartHeight} className="w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Y-axis reference lines */}
                {[1, 2, 3, 4, 5].map(v => {
                    const y = paddingY + usableHeight - ((v - 1) / 4) * usableHeight;
                    return (
                        <g key={v}>
                            <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        </g>
                    );
                })}

                {/* Gradient area under line */}
                <defs>
                    <linearGradient id="hireGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {points.length > 1 && (
                    <path
                        d={`${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`}
                        fill="url(#hireGrad)"
                    />
                )}

                {/* Line */}
                <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill={HIRE_COLORS[p.value] ?? '#6b7280'}
                        stroke="rgba(0,0,0,0.5)"
                        strokeWidth="1"
                    />
                ))}
            </svg>

            {/* Y-axis labels */}
            <div className="flex justify-between text-[8px] text-zinc-600 font-bold mt-1 px-1">
                <span>Strong No</span>
                <span>Borderline</span>
                <span>Strong Hire</span>
            </div>

            <p className="text-[9px] text-zinc-600 mt-2 italic leading-tight" data-testid="hire-readiness-tooltip">
                Hire Readiness reflects AI evaluation of interview performance at this difficulty level. It is one signal, not a prediction.
            </p>
        </div>
    );
}
