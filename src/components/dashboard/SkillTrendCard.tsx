/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Area,
    AreaChart
} from 'recharts';
import { SessionHistory, CognitiveSkill } from '@/types/assessment';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillTrendCardProps {
    skill: CognitiveSkill;
    sessions: SessionHistory[];
    className?: string;
}

function SkillTrendCardBase({ skill, sessions, className }: SkillTrendCardProps) {
    const definition = SKILL_DEFINITIONS[skill];

    // Prep data - most recent last
    const chartData = sessions.slice().reverse().map((session, index) => ({
        session: index + 1,
        score: session.skills[skill] || 0,
        timestamp: session.timestamp,
    }));

    // Calculate trend
    const current = chartData[chartData.length - 1]?.score || 0;
    const previous = chartData[chartData.length - 2]?.score || current;
    const diff = current - previous;

    const trend =
        diff > 0.5 ? 'improving' :
            diff < -0.5 ? 'declining' :
                'stable';

    return (
        <div className={cn("flex flex-col gap-4 p-5 bg-slate-900/40 border border-slate-800/60 rounded-3xl h-full shadow-lg", className)}>
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{definition.name}</h4>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white">{current.toFixed(1)}</span>
                        <div className={cn(
                            "flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter",
                            trend === 'improving' ? "bg-emerald-500/10 text-emerald-400" :
                                trend === 'declining' ? "bg-red-500/10 text-red-400" :
                                    "bg-slate-500/10 text-slate-500"
                        )}>
                            {trend === 'improving' && <TrendingUp className="w-3 h-3" />}
                            {trend === 'declining' && <TrendingDown className="w-3 h-3" />}
                            {trend === 'stable' && <Minus className="w-3 h-3" />}
                            {trend}
                        </div>
                    </div>
                </div>
                <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center opacity-80 shadow-lg"
                    style={{ backgroundColor: `${definition.color}20`, border: `1px solid ${definition.color}40` }}
                >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: definition.color }} />
                </div>
            </div>

            <div className="h-28 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`gradient-${skill}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={definition.color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={definition.color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-edge)" opacity={0.5} />
                        <XAxis
                            dataKey="session"
                            hide
                        />
                        <YAxis
                            domain={[0, 10]}
                            hide
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--surface-2)',
                                border: '1px solid var(--surface-edge)',
                                borderRadius: '8px',
                                fontSize: '10px',
                                color: '#e4e4e7',
                                padding: '4px 8px'
                            }}
                            labelStyle={{ display: 'none' }}
                        />
                        <ReferenceLine y={5} stroke="var(--surface-edge)" strokeDasharray="3 3" />
                        <Area
                            type="monotone"
                            dataKey="score"
                            stroke={definition.color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#gradient-${skill})`}
                            isAnimationActive={true}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export const SkillTrendCard = React.memo(SkillTrendCardBase);
