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
    currentScores: Record<CognitiveSkill, number>;
    previousScores?: Record<CognitiveSkill, number>;
    showComparison?: boolean;
    animated?: boolean;
    size?: 'small' | 'medium' | 'large';
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
}: RadarChartProps) {
    // Map skills to chart data
    const chartData = Object.entries(SKILL_DEFINITIONS).map(([id, def]) => ({
        skill: def.name,
        current: currentScores[id as CognitiveSkill] || 0,
        previous: previousScores?.[id as CognitiveSkill] || 0,
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
                        tick={{ fill: '#94a3b8', fontSize: size === 'small' ? 10 : 12, fontWeight: 500 }}
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
                            stroke="#64748b"
                            fill="#64748b"
                            fillOpacity={0.1}
                            strokeDasharray="4 4"
                            isAnimationActive={animated}
                        />
                    )}

                    <Radar
                        name="Current Session"
                        dataKey="current"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.5}
                        isAnimationActive={animated}
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
        </div>
    );
}
