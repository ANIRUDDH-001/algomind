'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, RotateCcw, BookOpen, ChevronRight, ChevronDown, AlertTriangle, Mic, Lightbulb, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { COLORS, ANIM, TRANSITIONS } from '@/lib/design-tokens';
import type { CognitiveSkill } from '@/types/assessment';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionData {
    id: string;
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    transcript: TranscriptTurn[];
    duration: number;
    overallScore: number;
    completedAt: string;
    difficultyMode?: string;
}

interface TranscriptTurn {
    speaker: string;
    text: string;
    timestamp?: number;
}

interface AIKeyMoment {
    timestampIndex: number;
    momentType: string;
    quote: string;
    significance: string;
    dimension: string | null;
    sentiment: 'positive' | 'negative' | 'neutral';
}

interface ImprovementExample {
    skill: CognitiveSkill;
    subCriterionLabel: string;
    score: number;
    whatWasSaid: string;
    level6Response: string;
    level9Response: string;
}

interface AssessmentData {
    overallScore: number;
    adjustedScore?: number;
    skills: Record<CognitiveSkill, number>;
    subCriteria?: Record<string, Record<string, number>>;
    codeQuality?: {
        score: number | null;
        correctness: string;
        clarity: string;
        consistency: string;
        issues: string[];
    } | null;
    overallFeedback: string;
    nextSteps: string[];
    skillEvidence: Record<string, unknown>;
    hireDecision?: string | null;
    keyMoments?: AIKeyMoment[];
    improvementExamples?: ImprovementExample[];
}

interface SM2Data {
    intervalDays: number;
    nextReview: string;
    repetitions: number;
    easeFactor: number;
}

interface PreviousAttempt {
    id: string;
    score: number;
    completedAt: string;
    duration: number;
}

interface AnalysisClientProps {
    session: SessionData;
    assessment: AssessmentData | null;
    sm2: SM2Data | null;
    previousAttempts: PreviousAttempt[];
    flags: {
        enableComparative: boolean;
        enableLearnMode: boolean;
    };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MOMENT_ICONS: Record<string, string> = {
    approach_identified: '💡',
    optimization_transition: '⚡',
    self_correction: '🔄',
    complexity_explained: '📊',
    impressive_statement: '⭐',
    missed_opportunity: '⚠️',
    stuck_point: '⏸',
};

const MOMENT_TYPE_LABELS: Record<string, string> = {
    approach_identified: 'Approach Identified',
    optimization_transition: 'Optimization Transition',
    self_correction: 'Self Correction',
    complexity_explained: 'Complexity Explained',
    impressive_statement: 'Impressive Statement',
    missed_opportunity: 'Missed Opportunity',
    stuck_point: 'Stuck Point',
};

const MOMENT_COLORS: Record<string, string> = {
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#6b7280',
};

const HIRE_STYLES: Record<string, string> = {
    STRONG_HIRE: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    HIRE: 'bg-green-500/10 border-green-500/30 text-green-400',
    BORDERLINE: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    NO_HIRE: 'bg-red-500/10 border-red-500/30 text-red-400',
    STRONG_NO_HIRE: 'bg-red-600/10 border-red-600/30 text-red-500',
};

const HIRE_LABELS: Record<string, string> = {
    STRONG_HIRE: '✅ Strong Hire',
    HIRE: '👍 Hire',
    BORDERLINE: '⚖️ Borderline',
    NO_HIRE: '👎 No Hire',
    STRONG_NO_HIRE: '❌ Strong No Hire',
};

// ─── Animated Score Circle ──────────────────────────────────────────────────

function AnimatedScore({ score, max = 10 }: { score: number; max?: number }) {
    const spring = useSpring(0, { stiffness: 60, damping: 20 });
    const display = useTransform(spring, (v) => v.toFixed(1));
    const pct = (score / max) * 100;
    const color = score < 5 ? '#ef4444' : score < 7 ? '#f59e0b' : '#10b981';

    useEffect(() => {
        spring.set(score);
    }, [spring, score]);

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const strokeDash = (pct / 100) * circumference;

    return (
        <div className="relative w-36 h-36 mx-auto">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <motion.circle
                    cx="60" cy="60" r={radius} fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    initial={{ strokeDasharray: `0 ${circumference}` }}
                    animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="text-3xl font-black" style={{ color }}>
                    {display}
                </motion.span>
                <span className="text-xs text-zinc-500 font-bold">/ {max}</span>
            </div>
        </div>
    );
}

// ─── Skill Bar ──────────────────────────────────────────────────────────────

function SkillBar({ skill, score, subCriteria }: { skill: CognitiveSkill; score: number; subCriteria?: Record<string, number> }) {
    const [expanded, setExpanded] = useState(false);
    const def = SKILL_DEFINITIONS[skill];
    const pct = Math.min((score / 10) * 100, 100);

    return (
        <div className="group">
            <div
                className="flex justify-between items-center mb-1 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">{def.name}</span>
                    {subCriteria && Object.keys(subCriteria).length > 0 && (
                        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    )}
                </div>
                <span className="text-[10px] font-black tabular-nums" style={{ color: def.color }}>
                    {score.toFixed(1)}
                </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: def.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
            </div>

            {/* sub-criteria breakdown */}
            <AnimatePresence>
                {expanded && subCriteria && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pl-2 space-y-1.5 mt-2 mb-3 border-l-2" style={{ borderColor: def.color + '40' }}>
                            {def.subCriteria?.map(sc => (
                                <div key={sc.id} className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400">{sc.label}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${((subCriteria[sc.id] || 0) / 10) * 100}%`,
                                                    background: def.color
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-zinc-500 w-4 text-right tabular-nums">
                                            {subCriteria[sc.id] != null ? subCriteria[sc.id].toFixed(0) : '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Utility functions ──────────────────────────────────────────────────────

function extractWeakSubCriteria(
    subCriteriaDict?: Record<string, Record<string, number>>
) {
    if (!subCriteriaDict) return [];

    const weaks: { skill: CognitiveSkill; scId: string; label: string; description: string; score: number; color: string }[] = [];
    (Object.keys(subCriteriaDict) as CognitiveSkill[]).forEach(skill => {
        const sub = subCriteriaDict[skill];
        const def = SKILL_DEFINITIONS[skill];
        if (sub && def && def.subCriteria) {
            def.subCriteria.forEach(sc => {
                const score = sub[sc.id];
                if (score !== undefined && score <= 4) {
                    weaks.push({
                        skill,
                        scId: sc.id,
                        label: sc.label,
                        description: sc.description,
                        score,
                        color: def.color
                    });
                }
            });
        }
    });
    return weaks.sort((a, b) => a.score - b.score);
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    return m < 1 ? 'less than a minute' : `${m} minute${m !== 1 ? 's' : ''}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AnalysisClient({
    session,
    assessment,
    sm2,
    previousAttempts,
    flags,
}: AnalysisClientProps) {
    const skills = assessment?.skills;
    const weakSubCriteria = extractWeakSubCriteria(assessment?.subCriteria);
    const hasTranscript = session.transcript && session.transcript.length > 0;
    const aiMoments = assessment?.keyMoments || [];
    const improvementExamples = assessment?.improvementExamples || [];
    const [showImprovements, setShowImprovements] = useState(false);
    const isWarmUp = session.difficultyMode === 'warm-up';

    // Extract first actionable sentence from feedback
    const oneThingFeedback = (() => {
        if (!assessment?.overallFeedback) return null;
        const sentences = assessment.overallFeedback
            .split(/[.!]\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 20);
        return sentences[0] ? sentences[0] + '.' : null;
    })();

    const difficultyColors: Record<string, string> = {
        easy: 'bg-emerald-500/10 text-emerald-400',
        medium: 'bg-amber-500/10 text-amber-400',
        hard: 'bg-red-500/10 text-red-400',
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: 'var(--surface-base)' }}>
            {/* Header */}
            <motion.div
                className="max-w-7xl mx-auto mb-6"
                {...ANIM.fadeUp}
                transition={TRANSITIONS.page}
            >
                <Link href="/practice" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-indigo-400 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Practice
                </Link>
                <h1 className="text-2xl font-black text-white tracking-tight">
                    Interview Analysis
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                    {session.problemTitle} · Completed {session.completedAt ? new Date(session.completedAt).toLocaleDateString() : ''}
                </p>
            </motion.div>

            {/* 3-Panel Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── PANEL 1: Your Performance ────────────────────────── */}
                <motion.div
                    className="rounded-2xl p-6 space-y-6"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}
                    {...ANIM.fadeUp}
                    transition={{ ...TRANSITIONS.page, delay: 0.1 }}
                >
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Your Performance
                    </h2>

                    <div className="flex flex-col items-center">
                        <AnimatedScore score={assessment?.adjustedScore || assessment?.overallScore || session.overallScore || 0} />
                        {assessment?.adjustedScore && Math.abs(assessment.adjustedScore - assessment.overallScore) > 0.01 && (
                            <span
                                className="text-[10px] font-bold text-zinc-400 mt-3 flex items-center gap-1 cursor-help"
                                title={`Raw Score: ${assessment.overallScore.toFixed(1)} / 10.0\nDifficulty Multiplier Applied`}
                            >
                                <AlertTriangle className="w-3 h-3" />
                                DIFFICULTY-ADJUSTED
                            </span>
                        )}
                    </div>

                    {/* Hire Decision Badge */}
                    {assessment?.hireDecision && !isWarmUp && (
                        <div className={`px-4 py-2 rounded-xl border text-sm font-bold text-center ${HIRE_STYLES[assessment.hireDecision] || ''}`}
                            data-testid="hire-decision-badge"
                        >
                            {HIRE_LABELS[assessment.hireDecision] || assessment.hireDecision}
                            <span className="text-xs font-normal opacity-60 ml-2">
                                Based on this session
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-3">
                        <span className="text-sm font-bold text-white">{session.problemTitle}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${difficultyColors[session.problemDifficulty] || 'bg-zinc-700 text-zinc-400'}`}>
                            {session.problemDifficulty}
                        </span>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3.5 h-3.5" />
                        Completed in {formatDuration(session.duration)}
                    </div>

                    {/* 8 Skill Bars */}
                    {skills && (
                        <div className="space-y-3 pt-2">
                            {(Object.keys(SKILL_DEFINITIONS) as CognitiveSkill[]).map((skill) => (
                                <SkillBar
                                    key={skill}
                                    skill={skill}
                                    score={skills[skill] || 0}
                                    subCriteria={assessment?.subCriteria?.[skill]}
                                />
                            ))}
                        </div>
                    )}

                    {/* Weak sub-criteria */}
                    {weakSubCriteria.length > 0 && (
                        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--surface-edge)' }}>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-500" /> Improvement Areas
                            </h3>
                            {weakSubCriteria.slice(0, 3).map((w, idx) => (
                                <div key={idx} className="bg-white/[0.02] border rounded-lg p-3" style={{ borderColor: 'var(--surface-edge)' }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-zinc-300">{w.label}</span>
                                        <span className="text-[10px] font-black" style={{ color: w.color }}>{w.score}/10</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500">
                                        You scored low on this aspect: <span className="text-zinc-400">&quot;{w.description}&quot;</span>.
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* "What You Should Have Said" Section */}
                    {improvementExamples.length > 0 && (
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                            <button
                                className="w-full flex items-center justify-between text-left"
                                onClick={() => setShowImprovements(!showImprovements)}
                                data-testid="show-improvements-toggle"
                            >
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                                    <Lightbulb className="w-3 h-3 text-amber-400" /> What You Should Have Said
                                </h3>
                                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${showImprovements ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showImprovements && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-4 mt-3">
                                            {improvementExamples.map((ex, idx) => (
                                                <div key={idx} className="bg-white/[0.02] border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--surface-edge)' }}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-zinc-300">{ex.subCriterionLabel}</span>
                                                        <span className="text-[10px] font-black text-red-400">{ex.score}/10</span>
                                                    </div>

                                                    {ex.whatWasSaid && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">What was said:</span>
                                                            <p className="text-xs text-zinc-400 font-mono bg-zinc-900/50 rounded px-2 py-1 mt-1 italic">
                                                                &ldquo;{ex.whatWasSaid}&rdquo;
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider">Good answer (6/10):</span>
                                                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{ex.level6Response}</p>
                                                    </div>

                                                    <div>
                                                        <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-wider">Great answer (9/10):</span>
                                                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{ex.level9Response}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Narrative / Feedback */}
                    {assessment?.overallFeedback && (
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                            <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">
                                {assessment.overallFeedback.slice(0, 300)}
                                {assessment.overallFeedback.length > 300 && '...'}
                            </p>
                        </div>
                    )}
                </motion.div>

                {/* ── PANEL 2: Key Moments ──────────────────────────────── */}
                <motion.div
                    className="rounded-2xl p-6 space-y-5"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}
                    {...ANIM.fadeUp}
                    transition={{ ...TRANSITIONS.page, delay: 0.2 }}
                >
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Key Moments
                    </h2>

                    {!hasTranscript ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                                <Mic className="w-5 h-5 text-zinc-600" />
                            </div>
                            <p className="text-sm text-zinc-500 font-medium" data-testid="no-transcript">
                                Voice data not available for this session
                            </p>
                        </div>
                    ) : aiMoments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-zinc-600" />
                            </div>
                            <p className="text-sm text-zinc-500 font-medium">
                                No significant moments detected
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1 relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-3 top-2 bottom-2 w-px bg-zinc-800" />

                            {aiMoments.map((moment, idx) => (
                                <motion.div
                                    key={idx}
                                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors relative"
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                >
                                    {/* Timeline dot */}
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs z-10"
                                        style={{
                                            background: MOMENT_COLORS[moment.sentiment] + '20',
                                            border: `2px solid ${MOMENT_COLORS[moment.sentiment]}`,
                                        }}
                                    >
                                        {MOMENT_ICONS[moment.momentType] || '📌'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{ color: MOMENT_COLORS[moment.sentiment] }}
                                            >
                                                {MOMENT_TYPE_LABELS[moment.momentType] || moment.momentType}
                                            </span>
                                            {moment.dimension && (
                                                <span className="text-[8px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                    {SKILL_DEFINITIONS[moment.dimension as CognitiveSkill]?.name || moment.dimension}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-zinc-200 font-mono bg-zinc-900/50 rounded px-2 py-1 mb-1 break-words">
                                            &ldquo;{moment.quote}&rdquo;
                                        </p>

                                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                                            {moment.significance}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Timeline bar */}
                    {hasTranscript && (
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                            <div className="flex justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">
                                <span>Start</span>
                                <span>{formatDuration(session.duration)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500/60 to-indigo-500 w-full" />
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* ── PANEL 3: What's Next ──────────────────────────────── */}
                <motion.div
                    className="rounded-2xl p-6 space-y-5"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}
                    {...ANIM.fadeUp}
                    transition={{ ...TRANSITIONS.page, delay: 0.3 }}
                >
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        What&apos;s Next
                    </h2>

                    {/* THE ONE THING */}
                    {oneThingFeedback && (
                        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}>
                            <p className="text-sm font-semibold text-indigo-300 leading-relaxed">
                                &ldquo;{oneThingFeedback}&rdquo;
                            </p>
                        </div>
                    )}

                    {/* SM2 Next Review */}
                    {sm2 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                            <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-zinc-300">
                                    Next review: {new Date(sm2.nextReview).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                    Target: {Math.min((assessment?.overallScore || 0) + 2, 10).toFixed(0)}/10 · Rep #{sm2.repetitions}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Next Steps list */}
                    {assessment?.nextSteps && assessment.nextSteps.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Action Items</h3>
                            {assessment.nextSteps.slice(0, 3).map((step, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                    <span className="text-[10px] font-black text-indigo-500 mt-0.5">{idx + 1}.</span>
                                    <p className="text-xs text-zinc-400">{step}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA Buttons */}
                    <div className="space-y-3 pt-2">
                        <Link href={`/interview?problemId=${session.problemId}`} className="block">
                            <Button className="w-full btn-primary" data-testid="retry-button">
                                <RotateCcw className="w-4 h-4 mr-2" /> Retry This Problem
                            </Button>
                        </Link>

                        {flags.enableLearnMode && (
                            <Link href={`/learn?problemId=${session.problemId}`} className="block">
                                <Button variant="outline" className="w-full text-zinc-300 hover:text-white"
                                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                    data-testid="learn-button"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" /> Learn This Concept
                                </Button>
                            </Link>
                        )}

                        <Link href="/practice" className="block">
                            <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Practice
                            </Button>
                        </Link>
                    </div>

                    {/* Comparison Preview */}
                    {flags.enableComparative && previousAttempts.length > 0 && (
                        <div
                            className="p-4 rounded-xl flex items-center justify-between"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                            data-testid="comparison-preview"
                        >
                            <div>
                                <p className="text-xs font-bold text-zinc-300">
                                    Previous attempt: {previousAttempts[0].score.toFixed(1)}/10
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                    {new Date(previousAttempts[0].completedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <Link href={`/interview/analysis?sessionId=${previousAttempts[0].id}`}>
                                <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300 text-xs">
                                    Compare <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
