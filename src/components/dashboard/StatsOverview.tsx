/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { UserProgress } from '@/types/assessment';
import { TrendingUp, TrendingDown, Target, Clock, Code2, Sparkles } from 'lucide-react';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { CognitiveSkill } from '@/types/assessment';
import { getSupabase } from '@/lib/supabase/client';

interface StatsOverviewProps {
    progress: UserProgress | null;
}

export function StatsOverview({ progress }: StatsOverviewProps) {
    if (!progress) return null;

    const totalMinutes = Math.floor((progress.sessions.reduce((acc: number, s: any) => acc + (s.duration || 0), 0)) / 60);
    const PROBLEMS_SOLVED = progress.totalSessions;
    const AVG_SCORE = progress.averageScore;

    const [streakData, setStreakData] = useState<{ current: number; longest: number } | null>(null);

    useEffect(() => {
        let mounted = true;
        async function fetchStreak() {
            if (!progress?.userId) return;
            const supabase = getSupabase();
            if (!supabase) return;

            const { data } = await supabase
                .from('learner_profiles')
                .select('current_streak, longest_streak')
                .eq('user_id', progress.userId)
                .maybeSingle();

            if (mounted && data) {
                setStreakData({ current: data.current_streak || 0, longest: data.longest_streak || 0 });
            }
        }
        fetchStreak();
        return () => { mounted = false; };
    }, [progress?.userId]);

    // Calculate improvement (comparing last 2 sessions if available)
    const currentAvg = progress.sessions[0]?.overallScore || 0;
    const prevAvg = progress.sessions[1]?.overallScore || currentAvg;
    const improvement = prevAvg === 0 ? 0 : ((currentAvg - prevAvg) / prevAvg) * 100;

    // Identify strengths and weaknesses
    const skillAverages = Object.keys(SKILL_DEFINITIONS).map(skillId => {
        const sId = skillId as CognitiveSkill;
        const total = progress.sessions.reduce((acc: number, s: any) => acc + (s.skills[sId] || 0), 0);
        return {
            id: sId,
            name: SKILL_DEFINITIONS[sId].name,
            avg: total / progress.totalSessions,
            color: SKILL_DEFINITIONS[sId].color
        };
    });

    const topSkills = [...skillAverages].sort((a, b) => b.avg - a.avg).slice(0, 3);
    const needsWork = [...skillAverages].sort((a, b) => a.avg - b.avg).slice(0, 3);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4" data-tour="performance-insights">
                {streakData && streakData.current > 0 && (
                    <div className="col-span-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-2 text-amber-500 font-bold">
                            <span className="text-xl">🔥</span>
                            <span>{streakData.current} Session Streak</span>
                        </div>
                        {streakData.current > Math.max(0, streakData.longest - 2) && (
                            <span className="text-[10px] uppercase tracking-widest text-amber-500/80 font-black px-2 py-0.5 bg-amber-500/10 rounded-full">
                                Personal best incoming!
                            </span>
                        )}
                    </div>
                )}
                <StatItem
                    icon={<Clock className="w-4 h-4 text-emerald-400" />}
                    label="Practice Time"
                    value={`${totalMinutes}m`}
                />
                <StatItem
                    icon={<Code2 className="w-4 h-4 text-blue-400" />}
                    label="Problems Solved"
                    value={PROBLEMS_SOLVED.toString()}
                />
                <StatItem
                    icon={<Target className="w-4 h-4 text-purple-400" />}
                    label="Avg Score"
                    value={AVG_SCORE.toFixed(1)}
                />
                <StatItem
                    icon={improvement >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                    label="Improvement"
                    value={`${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`}
                    color={improvement >= 0 ? 'text-emerald-400' : 'text-red-400'}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2" data-tour="cognitive-radar">
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Top Strengths
                    </h4>
                    <div className="space-y-2">
                        {topSkills.map(skill => (
                            <SkillBar key={skill.id} name={skill.name} score={skill.avg} color={skill.color} />
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1 flex items-center gap-1.5">
                        <TrendingDown className="w-3 h-3 text-red-400" /> Areas for Growth
                    </h4>
                    <div className="space-y-2">
                        {needsWork.map(skill => (
                            <SkillBar key={skill.id} name={skill.name} score={skill.avg} color={skill.color} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatItem({ icon, label, value, color = "text-white" }: { icon: React.ReactNode, label: string, value: string, color?: string }) {
    return (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3 flex flex-col gap-1 shadow-inner">
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-xl font-black ${color}`}>{value}</span>
        </div>
    );
}

function SkillBar({ name, score, color }: { name: string, score: number, color: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center px-0.5">
                <span className="text-[10px] font-bold text-slate-300 truncate mr-2">{name}</span>
                <span className="text-[10px] font-black text-slate-500">{score.toFixed(1)}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden border border-slate-800/30">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}
