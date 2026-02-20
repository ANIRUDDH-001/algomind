'use client';

import React from 'react';
import {
    Radar,
    RadarChart as RechartsRadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { CognitiveSkill } from '@/types/assessment';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';

interface RadarChartProps {
    currentScores?: Record<CognitiveSkill, number>;
    previousScores?: Record<CognitiveSkill, number>;
    showComparison?: boolean;
    animated?: boolean;
    size?: 'small' | 'medium' | 'large';
    onSkillClick?: (skill: string) => void;
    selectedSkill?: string | null;
    currentData?: Record<string, number>;
    allTimeData?: Record<string, number>;
    showAllTime?: boolean;
}

const SIZE_MAP = {
    small: 300,
    medium: 500,
    large: 700,
};

export function RadarChart({
    currentScores,
    previousScores,
    showComparison = false,
    animated = true,
    size = 'medium',
    onSkillClick,
    selectedSkill,
    currentData,
    allTimeData,
    showAllTime = true,
}: RadarChartProps) {
    // Resolve which current data object to use (prefer currentData, fallback to currentScores)
    // Support empty fallback to prevent crashes if nothing is passed
    const activeCurrentData = currentData || currentScores || ({} as Record<string, number>);

    // Map skills to chart data
    const chartData = Object.entries(SKILL_DEFINITIONS).map(([id, def]) => ({
        skill: def.name,
        current: activeCurrentData[id as CognitiveSkill] || 0,
        previous: previousScores?.[id as CognitiveSkill] || 0,
        allTime: allTimeData?.[id] || 0,
        fullMark: 10,
        color: def.color,
    }));

    const chartSize = SIZE_MAP[size];

    return (
        <div className="w-full flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md rounded-3xl border border-slate-800/50">
            <ResponsiveContainer width="100%" height={chartSize}>
                <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis
                        dataKey="skill"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tick={(props: any) => {
                            const { payload, x, y, cx, cy } = props;
                            const skillName = payload.value;
                            const skillEntry = Object.entries(SKILL_DEFINITIONS).find(([, def]) => def.name === skillName);
                            const skillId = skillEntry ? skillEntry[0] : null;
                            const isSelected = skillId === selectedSkill;
                            const color = isSelected ? (skillEntry ? skillEntry[1].color : '#fff') : '#94a3b8';

                            return (
                                <text
                                    x={x}
                                    y={y}
                                    className="cursor-pointer transition-all duration-200 hover:opacity-80"
                                    fill={color}
                                    fontSize={size === 'small' ? 10 : 12}
                                    fontWeight={isSelected ? 800 : 500}
                                    textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'}
                                    dy={y > cy ? 10 : -5}
                                    onClick={() => {
                                        if (skillId && onSkillClick) {
                                            onSkillClick(skillId);
                                        }
                                    }}
                                    style={{ pointerEvents: 'auto' }}
                                >
                                    {skillName}
                                    {isSelected && <tspan x={x} dy={14} fill={color} fontSize="10" textAnchor="middle">●</tspan>}
                                </text>
                            );
                        }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 10]}
                        tick={{ fill: '#475569', fontSize: 10 }}
                        axisLine={false}
                    />

                    {showComparison && previousScores && (
                        <Radar
                            name="Previous Session"
                            dataKey="previous"
                            stroke="#a855f7"
                            fill="#a855f7"
                            fillOpacity={0.1}
                            strokeDasharray="4 4"
                            isAnimationActive={animated}
                        />
                    )}

                    {showAllTime && allTimeData && (
                        <Radar
                            name="All-time average"
                            dataKey="allTime"
                            stroke="#64748b"
                            fill="#64748b"
                            fillOpacity={0.1}
                            strokeDasharray="4 4"
                            isAnimationActive={animated}
                        />
                    )}

                    <Radar
                        name="This session"
                        dataKey="current"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.5}
                        isAnimationActive={animated}
                        activeDot={{ r: 6, fill: "#3b82f6", stroke: "#0f172a", strokeWidth: 2 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            const skillName = payload.skill;
                            const skillEntry = Object.entries(SKILL_DEFINITIONS).find(([, def]) => def.name === skillName);
                            const skillId = skillEntry ? skillEntry[0] : null;
                            const isSelected = skillId === selectedSkill;
                            const color = skillEntry && skillEntry[1].color ? skillEntry[1].color : '#3b82f6';
                            return (
                                <g
                                    key={`dot-${skillName}`}
                                    className="cursor-pointer"
                                    onClick={() => skillId && onSkillClick?.(skillId)}
                                    style={{ pointerEvents: 'auto' }}
                                >
                                    <circle cx={cx} cy={cy} r={8} fill="transparent" stroke="transparent" />
                                    {isSelected && (
                                        <>
                                            <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.4} className="animate-pulse" />
                                            <circle cx={cx} cy={cy} r={6} fill="#0f172a" stroke={color} strokeWidth={2} />
                                        </>
                                    )}
                                </g>
                            );
                        }}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: '12px',
                            padding: '12px',
                            color: '#f8fafc',
                        }}
                        itemStyle={{ fontSize: '12px' }}
                    />
                </RechartsRadarChart>
            </ResponsiveContainer>

            {allTimeData && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-4 text-[10px] text-slate-400 font-medium">
                    <div className="flex items-center gap-1.5"><span className="text-blue-500 text-xs">●</span> This session</div>
                    <div className="flex items-center gap-1.5"><span className="text-slate-500 text-xs shadow-none">○</span> All-time avg</div>
                </div>
            )}
        </div>
    );
}
