/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Sparkles, ArrowRight, TrendingUp, TrendingDown, BookOpen, Clock } from 'lucide-react';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import type { CognitiveSkill } from '@/types/assessment';
import { AnalysisPendingBanner } from '@/components/assessment/AnalysisPendingBanner';

const DIMENSION_LIST = Object.keys(SKILL_DEFINITIONS) as CognitiveSkill[];

interface DimensionScore {
    skill: CognitiveSkill;
    score: number;
    name: string;
}

export function AssessmentCompleteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [score, setScore] = useState<number | null>(null);
    const [showScore, setShowScore] = useState(false);
    const [dimensionScores, setDimensionScores] = useState<DimensionScore[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [submissionId, setSubmissionId] = useState<string | null>(null);
    const [analysisAvailable, setAnalysisAvailable] = useState(true);

    useEffect(() => {
        const scoreParam = searchParams.get('score');
        const showScoreParam = searchParams.get('showScore');
        const dimensionsParam = searchParams.get('dimensions');

        if (scoreParam) {
            setScore(parseFloat(scoreParam));
        }

        setShowScore(showScoreParam === 'true');

        const submissionIdParam = searchParams.get('submissionId');
        if (submissionIdParam) setSubmissionId(submissionIdParam);

        const analysisAvailableParam = searchParams.get('analysisAvailable');
        // Default to true (old sync flow); set to false only for the new async flow
        setAnalysisAvailable(analysisAvailableParam !== 'false');

        if (dimensionsParam) {
            try {
                const parsed = JSON.parse(decodeURIComponent(dimensionsParam));
                const mapped: DimensionScore[] = DIMENSION_LIST
                    .filter(skill => parsed[skill] !== undefined)
                    .map(skill => ({
                        skill,
                        score: parsed[skill],
                        name: SKILL_DEFINITIONS[skill].name,
                    }));
                setDimensionScores(mapped);
            } catch { /* ignore */ }
        }
    }, [searchParams]);

    // Animate on mount
    useEffect(() => {
        const timer = setTimeout(() => setIsAnimating(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Identify strongest and weakest
    const sorted = [...dimensionScores].sort((a, b) => b.score - a.score);
    const strongest = sorted[0];
    const weakest = sorted.length >= 2 ? sorted[sorted.length - 1] : null;
    const secondWeakest = sorted.length >= 3 ? sorted[sorted.length - 2] : null;

    // Circle properties for gauge
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const scoreOffset = score ? circumference - (score / 10) * circumference : circumference;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <Card className={`max-w-md w-full p-8 bg-slate-900 border-slate-800 text-center transition-all duration-1000 transform ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

                {/* CSS Animated Checkmark */}
                <div className="mx-auto w-24 h-24 mb-8 relative">
                    <div className="absolute inset-0 bg-green-500/10 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-12 h-12 text-green-500 will-change-transform" strokeWidth={3} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-4" data-testid="thank-you-title">Interview Complete</h1>
                <p className="text-slate-400 mb-6 leading-relaxed" data-testid="employer-review-note">
                    Thank you for completing the assessment. Results will be reviewed by the employer. You&apos;ll hear from them directly regarding next steps.
                </p>

                {/* Analysis pending banner — shown when async edge function is processing */}
                {!analysisAvailable && submissionId && (
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-2 mb-1 text-slate-300 text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            Processing your results…
                        </div>
                        <AnalysisPendingBanner
                            submissionId={submissionId}
                            onComplete={() => router.refresh()}
                        />
                    </div>
                )}

                {/* Optional Score Gauge — only if show_score_to_candidate is true */}
                {showScore && score !== null && (
                    <div className={`mb-10 p-6 bg-slate-950/50 rounded-xl border border-slate-800 transition-all duration-1000 delay-500 ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                        data-testid="score-display"
                    >
                        <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Your Performance</h3>
                        <div className="relative w-32 h-32 mx-auto justify-center items-center flex">
                            <svg className="transform -rotate-90 w-32 h-32">
                                <circle
                                    cx="64" cy="64" r={radius}
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    className="text-slate-800"
                                />
                                <circle
                                    cx="64" cy="64" r={radius}
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={scoreOffset}
                                    strokeLinecap="round"
                                    className={`transition-all duration-1000 ease-out ${score >= 7 ? 'text-green-500' : score >= 4 ? 'text-amber-500' : 'text-red-500'}`}
                                    style={{ transitionDelay: '800ms' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-white">{score.toFixed(1)}</span>
                                <span className="text-xs text-slate-500">/ 10</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dimension Feedback — show when showScore is true and we have dimension data */}
                {showScore && dimensionScores.length > 0 && (
                    <div className={`mb-8 text-left space-y-3 transition-all duration-1000 delay-700 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                        data-testid="dimension-feedback"
                    >
                        {strongest && (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <TrendingUp className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="text-xs font-bold text-emerald-400" data-testid="strongest-area">Your strongest area: {strongest.name}</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        You showed strong capability in this dimension. Keep building on this strength.
                                    </p>
                                </div>
                            </div>
                        )}

                        {weakest && (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <TrendingDown className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="text-xs font-bold text-amber-400" data-testid="improvement-area">To improve: {weakest.name}</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Practice problems that focus on {weakest.name.toLowerCase()} to strengthen this area.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Always shown: What to work on next (based on weakest 2 dimensions) */}
                {dimensionScores.length >= 2 && (
                    <div className={`mb-8 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-left transition-all duration-1000 delay-900 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                        data-testid="work-on-next"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">What to work on next</h3>
                        </div>
                        <div className="space-y-2">
                            {weakest && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-500">1.</span>
                                    <span className="text-xs text-slate-300">
                                        Focus on <strong className="text-indigo-300">{weakest.name}</strong> — {SKILL_DEFINITIONS[weakest.skill].description.split('.')[0]}.
                                    </span>
                                </div>
                            )}
                            {secondWeakest && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-500">2.</span>
                                    <span className="text-xs text-slate-300">
                                        Strengthen <strong className="text-indigo-300">{secondWeakest.name}</strong> — {SKILL_DEFINITIONS[secondWeakest.skill].description.split('.')[0]}.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Viral CTA Loop */}
                <div className="border-t border-slate-800 pt-8 mt-4">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Want to improve for next time?</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        AlgoMind offers AI-powered technical interviews that adapt to your skill level. Practice standard DSA and behavioral questions instantly.
                    </p>

                    <Button
                        onClick={() => router.push('/')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-medium group"
                    >
                        Practice on AlgoMind
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
