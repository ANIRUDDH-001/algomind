/**
 * @deprecated Replaced by /interview/analysis page (A5). Kept for backward-compat.
 * Users now auto-redirect to AnalysisClient after interview ends.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { SkillDetailCard } from './SkillDetailCard';
import { ProgressStore } from '@/lib/assessment/progress-store';
import { Trophy, Clock, Target, Calendar, ChevronRight, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportReportButton } from '../dashboard/ExportReportButton';
import { CognitiveSkill, UserProgress } from '@/types/assessment';

interface ReportCardProps {
    assessment: AssessmentResult;
    onClose: () => void;
}

export function ReportCard({ assessment, onClose }: ReportCardProps) {
    const router = useRouter();
    const store = new ProgressStore();

    // Extract primitive scores for weighted average calculation
    const skillValues: any = {};
    Object.entries(assessment.skills).forEach(([id, s]) => {
        skillValues[id] = s.score;
    });

    const overallScore = store.calculateWeightedScore(skillValues);

    return (
        <div className="fixed inset-0 top-[var(--navbar-h,64px)] overflow-y-auto z-50" style={{ background: 'var(--surface-base)' }}>
            <div className="max-w-5xl mx-auto py-12 px-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-10"
                >
                    {/* Header: Score Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 p-1 rounded-[2.5rem] shadow-2xl shadow-blue-500/20" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            <div className="rounded-[2.4rem] h-full p-10 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden" style={{ background: 'var(--surface-base)' }}>
                                {/* Decorative background aura */}
                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 blur-[80px]" />
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 blur-[80px]" />

                                <div className="relative z-10">
                                    <div className="relative w-28 h-28">
                                        {/* Glow ring */}
                                        <div className="absolute inset-0 rounded-full blur-xl opacity-30"
                                            style={{ background: overallScore >= 7.5 ? '#10b981' : overallScore >= 5.5 ? '#6366f1' : '#f59e0b' }} />
                                        {/* Main orb */}
                                        <div className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center"
                                            style={{
                                                background: `conic-gradient(
                                                    ${overallScore >= 7.5 ? '#10b981' : overallScore >= 5.5 ? '#6366f1' : '#f59e0b'} ${overallScore * 10}%,
                                                    rgba(255,255,255,0.05) ${overallScore * 10}%
                                                )`,
                                                padding: '3px',
                                            }}>
                                            <div className="w-full h-full rounded-full flex flex-col items-center justify-center"
                                                style={{ background: 'var(--surface-1)' }}>
                                                <span className="text-3xl font-black text-white">{overallScore}</span>
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase mt-1">score</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4 relative z-10">
                                    <div className="space-y-1">
                                        <h1 className="text-3xl font-black text-white leading-tight">Assessment Complete.</h1>
                                        <p className="text-slate-400 font-medium">Interview Performance: <span className="text-blue-400">Advanced Algorithmic Design</span></p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 pt-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-300 font-semibold" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                            <Calendar className="w-3.5 h-3.5 text-blue-500" /> {assessment.timestamp.toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-300 font-semibold" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                            <Target className="w-3.5 h-3.5 text-purple-500" /> {assessment.problem.difficulty}
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-300 font-semibold" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                            <Clock className="w-3.5 h-3.5 text-emerald-500" /> Confidence: {Math.round(Object.values(assessment.skills)[0].confidence * 100)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="backdrop-blur-md rounded-[2.5rem] p-10 flex flex-col justify-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                            <div className="p-3 bg-blue-500/10 rounded-2xl w-fit mb-6">
                                <Trophy className="w-8 h-8 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2">Next Steps</h3>
                            <ul className="space-y-3">
                                {assessment.nextSteps.map((step, i) => (
                                    <li key={i} className="text-sm text-zinc-400 flex gap-2">
                                        <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                        {step}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Qualitative Feedback Section */}
                    <div className="rounded-3xl p-8" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Overall Performance Analysis</h3>
                        <p className="text-xl font-medium text-zinc-200 leading-relaxed italic">
                            "{assessment.overallFeedback}"
                        </p>
                    </div>

                    {/* Skill Detail Grid */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Cognitive Dimensions Breakdown</h3>
                            <span className="text-[10px] text-zinc-600 font-bold uppercase">Evidence-Based Scoring</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(SKILL_DEFINITIONS).map(([id, definition], i) => (
                                <motion.div key={id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}>
                                    <SkillDetailCard
                                        skillId={id}
                                        definition={definition}
                                        score={assessment.skills[id as CognitiveSkill]}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                        {(() => {
                            const skillAverages: any = {};
                            Object.entries(assessment.skills).forEach(([id, s]) => {
                                skillAverages[id] = s.score;
                            });

                            const mockProgress: UserProgress = {
                                userId: 'demo-user',
                                totalSessions: 1,
                                averageScore: overallScore,
                                averageScores: skillAverages,
                                sessions: [{
                                    sessionId: assessment.sessionId,
                                    userId: 'demo-user',
                                    problemId: assessment.problem.title,
                                    problemDifficulty: assessment.problem.difficulty as "easy" | "medium" | "hard",
                                    timestamp: assessment.timestamp,
                                    duration: 0,
                                    skills: skillAverages,
                                    overallScore: overallScore
                                }],
                                trends: [],
                                lastUpdated: assessment.timestamp
                            };

                            return <ExportReportButton progress={mockProgress} />;
                        })()}

                        <Button
                            onClick={() => router.push('/dashboard')}
                            className="h-11 px-12 bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            Go to Dashboard
                        </Button>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
