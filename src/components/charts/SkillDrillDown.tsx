// @codesage
'use client';

import React from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { X } from 'lucide-react';
import type { SessionHistory, CognitiveSkill } from '@/types/assessment';
import { toast } from 'sonner';

interface SkillDrillDownProps {
    skill: string;
    sessions: SessionHistory[];
    onClose: () => void;
}

export function SkillDrillDown({ skill, sessions, onClose }: SkillDrillDownProps) {
    const def = SKILL_DEFINITIONS[skill as CognitiveSkill];
    if (!def) return null;

    // Last 5 sessions, oldest first for the trend line
    const recentSessions = [...sessions].slice(0, 5).reverse();

    const chartData = recentSessions.map((s, i) => ({
        name: `S${i + 1}`,
        score: s.skills[skill as CognitiveSkill] || 0
    }));

    const currentScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 0;
    const previousScore = chartData.length > 1 ? chartData[chartData.length - 2].score : null;

    let trend = 0;
    if (previousScore !== null) {
        trend = currentScore - previousScore;
    }

    return (
        <div className="bg-[var(--surface-1)]/80 border border-white/10 rounded-2xl p-4 shadow-2xl relative w-full mt-6 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-300 backdrop-blur-md">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-[var(--surface-2)]"
            >
                <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 pr-6 truncate" style={{ color: def.color }}>
                {def.name}
            </h3>

            <p className="text-xs text-zinc-400 mb-4 line-clamp-2">
                {def.description}
            </p>

            <div className="flex items-end gap-3 mb-4">
                <div className="text-3xl font-black text-white">
                    {currentScore.toFixed(1)} <span className="text-lg text-zinc-500 font-normal">/ 10</span>
                </div>
                {previousScore !== null && (
                    <div className={`text-xs font-bold mb-1.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend >= 0 ? '↑' : '↓'} {trend > 0 ? '+' : ''}{trend.toFixed(1)} from last session
                    </div>
                )}
            </div>

            {chartData.length > 1 && (
                <div className="h-20 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <YAxis domain={[0, 10]} hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-edge)', borderRadius: '8px', fontSize: '10px', color: '#e4e4e7' }}
                                itemStyle={{ color: def.color }}
                                labelStyle={{ display: 'none' }}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(value: any) => [`${Number(value).toFixed(1)} / 10`, def.name]}
                            />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke={def.color}
                                strokeWidth={3}
                                dot={{ fill: 'var(--surface-1)', stroke: def.color, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: def.color }}
                                isAnimationActive={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <button
                onClick={() => toast('Coming in insights update', { icon: '🚧' })}
                className="w-full py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-white text-xs font-bold rounded-lg transition-colors border border-white/10 hover:border-white/15 flex items-center justify-center gap-1"
            >
                Practice this skill &rarr;
            </button>
        </div>
    );
}
