/**
 * @codesage
 */
'use client';

// @ts-expect-error -- automated unused local suppression
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
import { COLORS } from '@/lib/design-tokens';
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
        <div className="w-full flex items-center justify-center p-4 bg-[var(--surface-1)] backdrop-blur-md rounded-3xl border border-[var(--surface-edge)]">
            <ResponsiveContainer width="100%" height={chartSize}>
                <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="var(--surface-edge)" />
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
                        tick={{ fill: '#52525b', fontSize: 10 }}
                        axisLine={false}
                    />

                    {showComparison && previousScores && (
                        <Radar
                            name="Previous Session"
                            dataKey="previous"
                            stroke={COLORS.chart[0]}
                            fill={COLORS.chart[0]}
                            fillOpacity={0.3}
                            strokeDasharray="4 4"
                            isAnimationActive={animated}
                        />
                    )}

                    {showAllTime && allTimeData && (
                        <Radar
                            name="All-time average"
                            dataKey="allTime"
                            stroke={COLORS.chart[1]}
                            fill={COLORS.chart[1]}
                            fillOpacity={0.3}
                            strokeDasharray="4 4"
                            isAnimationActive={animated}
                        />
                    )}

                    <Radar
                        name="This session"
                        dataKey="current"
                        stroke={COLORS.chart[2]}
                        fill={COLORS.chart[2]}
                        fillOpacity={0.5}
                        isAnimationActive={animated}
                        activeDot={{ r: 6, fill: COLORS.chart[2], stroke: "var(--surface-1)", strokeWidth: 2 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            const skillName = payload.skill;
                            const skillEntry = Object.entries(SKILL_DEFINITIONS).find(([, def]) => def.name === skillName);
                            const skillId = skillEntry ? skillEntry[0] : null;
                            const isSelected = skillId === selectedSkill;
                            const color = skillEntry && skillEntry[1].color ? skillEntry[1].color : COLORS.chart[2];
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
                                            <circle cx={cx} cy={cy} r={6} fill="var(--surface-1)" stroke={color} strokeWidth={2} />
                                        </>
                                    )}
                                </g>
                            );
                        }}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            borderRadius: '12px',
                            padding: '12px',
                            color: '#e4e4e7',
                        }}
                        itemStyle={{ fontSize: '12px' }}
                    />
                </RechartsRadarChart>
            </ResponsiveContainer>

            {allTimeData && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-4 text-[10px] text-zinc-400 font-medium">
                    <div className="flex items-center gap-1.5"><span className="text-[COLORS.chart[2]] text-xs" style={{ color: COLORS.chart[2] }}>●</span> This session</div>
                    <div className="flex items-center gap-1.5"><span className="text-zinc-500 text-xs shadow-none">○</span> All-time avg</div>
                </div>
            )}
        </div>
    );
}
