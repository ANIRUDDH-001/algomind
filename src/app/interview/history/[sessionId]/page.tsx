import React from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Brain, ArrowLeft, Clock, MessageSquare, Code, BarChart2, ExternalLink, RotateCcw } from 'lucide-react';

interface HistoryPageProps {
    params: Promise<{ sessionId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SessionHistoryPage({ params }: HistoryPageProps) {
    const { sessionId } = await params;
    const supabase = await createServerSupabase();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Fetch session + assessment
    const { data: session } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!session) return notFound();

    // Fetch assessment
    const { data: assessment } = await supabase
        .from('assessments')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

    // Fetch problem details
    const { data: problem } = await supabase
        .from('problems')
        .select('title, description, difficulty')
        .eq('id', session.problem_id)
        .maybeSingle();

    const transcript: Array<{ role: string; content: string }> = session.transcript || [];
    const durationMin = session.duration ? Math.floor(session.duration / 60) : 0;
    const userTurns = transcript.filter(t => t.role === 'user').length;
    const overallScore = session.overall_score ?? assessment?.overall_score ?? 0;
    const difficulty = problem?.difficulty || 'medium';
    const completedAt = session.completed_at ? new Date(session.completed_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    }) : '';

    // Extract code blocks from transcript
    const codeBlocks = transcript
        .filter(t => t.role === 'user' && t.content.includes('```'))
        .map(t => {
            const match = t.content.match(/```(\w+)?\n([\s\S]*?)```/);
            return match ? { language: match[1] || 'text', code: match[2].trim() } : null;
        })
        .filter(Boolean) as Array<{ language: string; code: string }>;

    // Skill scores — read from dedicated assessment columns, not skill_evidence
    const skillEntries = assessment ? [
        { name: 'Problem Decomposition', key: 'problem-decomposition', score: assessment.problem_decomposition ?? 0 },
        { name: 'Pattern Recognition', key: 'pattern-recognition', score: assessment.pattern_recognition ?? 0 },
        { name: 'Algorithmic Thinking', key: 'algorithmic-thinking', score: assessment.algorithmic_thinking ?? 0 },
        { name: 'Complexity Analysis', key: 'complexity-analysis', score: assessment.complexity_analysis ?? 0 },
        { name: 'Communication Clarity', key: 'communication-clarity', score: assessment.communication_clarity ?? 0 },
        { name: 'Edge Case Awareness', key: 'edge-case-awareness', score: assessment.edge_case_awareness ?? 0 },
        { name: 'Optimization Mindset', key: 'optimization-mindset', score: assessment.optimization_mindset ?? 0 },
        { name: 'Debugging Approach', key: 'debugging-approach', score: assessment.debugging_approach ?? 0 },
    ] : [];

    const difficultyColors: Record<string, string> = {
        easy: 'bg-emerald-500/10 text-emerald-400',
        medium: 'bg-blue-500/10 text-blue-400',
        hard: 'bg-red-500/10 text-red-400',
    };

    return (
        <div className="min-h-screen bg-[var(--surface-base)] text-zinc-100 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--surface-base)]/80 backdrop-blur-md border-b border-white/8 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard?tab=history" className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                            <ArrowLeft className="w-4 h-4 text-zinc-400" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-indigo-400" />
                            <div>
                                <h1 className="font-bold text-white text-sm leading-tight flex items-center gap-2">
                                    {session.problem_title || problem?.title || 'Session'}
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${difficultyColors[difficulty] || 'bg-[var(--surface-2)] text-zinc-400'}`}>
                                        {difficulty}
                                    </span>
                                </h1>
                                <p className="text-[10px] text-zinc-500">{completedAt}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
                {/* Summary Stats Bar */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl p-4 text-center">
                        <div className="text-2xl font-black text-white">{overallScore.toFixed(1)}<span className="text-sm text-zinc-500">/10</span></div>
                        <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Score</div>
                    </div>
                    <div className="bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                            <Clock className="w-4 h-4 text-zinc-400" />
                            <span className="text-2xl font-black text-white">{durationMin}</span>
                            <span className="text-sm text-zinc-500">min</span>
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Duration</div>
                    </div>
                    <div className="bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                            <MessageSquare className="w-4 h-4 text-zinc-400" />
                            <span className="text-2xl font-black text-white">{userTurns}</span>
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mt-1">Turns</div>
                    </div>
                </div>

                {/* Problem Description */}
                {problem?.description && (
                    <section>
                        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Problem Description</h2>
                        <div className="bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl p-5">
                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{problem.description}</p>
                        </div>
                    </section>
                )}

                {/* Transcript */}
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Interview Transcript</h2>
                    <div className="space-y-4">
                        {transcript.length > 0 ? (
                            transcript.filter(t => t.role !== 'system').map((msg, i) => {
                                const isUser = msg.role === 'user';
                                return (
                                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 ${isUser
                                            ? 'bg-indigo-600/15 border border-indigo-500/25 text-indigo-50 rounded-tr-sm'
                                            : 'bg-[var(--surface-1)] border border-white/8 text-zinc-300 rounded-tl-sm'
                                            }`}>
                                            <div className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50">
                                                {isUser ? 'You' : 'Kai'}
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center border border-dashed border-white/8 rounded-2xl text-zinc-500">
                                <p>No transcript available for this session.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Code Snapshots */}
                {codeBlocks.length > 0 && (
                    <section>
                        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                            <Code className="w-3.5 h-3.5" /> Code Submitted
                        </h2>
                        <div className="space-y-3">
                            {codeBlocks.map((block, i) => (
                                <div key={i} className="bg-[var(--surface-1)]/70 border border-white/8 rounded-2xl overflow-hidden">
                                    <div className="px-4 py-2 border-b border-white/8 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {block.language}
                                    </div>
                                    <pre className="p-4 overflow-x-auto text-sm text-zinc-300 font-mono leading-relaxed">
                                        <code>{block.code}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Assessment Scores */}
                {skillEntries.length > 0 && (
                    <section>
                        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                            <BarChart2 className="w-3.5 h-3.5" /> Assessment Scores
                        </h2>
                        <div className="bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl p-5 space-y-3">
                            {skillEntries.map(({ name, score }) => (
                                <div key={name} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-zinc-300">{name}</span>
                                        <span className="text-xs font-mono text-zinc-500">{score.toFixed(1)}/10</span>
                                    </div>
                                    <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(score * 10, 100)}%`,
                                                background: score >= 7 ? '#10b981' : score >= 4 ? '#3b82f6' : '#f59e0b',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Action Links */}
                <div className="flex flex-wrap gap-3 pb-8">
                    <Link
                        href={`/interview/analysis?sessionId=${sessionId}`}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-xl text-sm font-bold text-indigo-300 transition-all"
                    >
                        <ExternalLink className="w-4 h-4" /> View Full Analysis
                    </Link>
                    <Link
                        href={`/interview?problemId=${session.problem_id}`}
                        className="flex items-center gap-2 px-5 py-3 bg-[var(--surface-1)] border border-white/10 hover:bg-[var(--surface-2)] rounded-xl text-sm font-bold text-zinc-300 transition-all"
                    >
                        <RotateCcw className="w-4 h-4" /> Retry This Problem
                    </Link>
                </div>
            </main>
        </div>
    );
}
