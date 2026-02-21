import React from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { notFound } from 'next/navigation';
import { Brain, ExternalLink, Play, ThumbsUp, Lightbulb, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Annotation {
    timestamp_seconds: number;
    text: string;
    type: 'good' | 'missed' | 'info';
}

interface ReplayPageProps {
    params: {
        token: string;
    }
}

// Ensure dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ReplayPage({ params }: ReplayPageProps) {
    const supabase = getSupabase();
    if (!supabase) return notFound();

    // 1. Fetch replay and associated session
    const { data: replay } = await supabase
        .from('session_replays')
        .select(`
            *,
            interview_sessions!inner (
                problem_title,
                problem_difficulty,
                duration_seconds,
                transcript,
                overall_score
            )
        `)
        .eq('public_token', params.token)
        .eq('is_public', true)
        .maybeSingle();

    if (!replay || !replay.interview_sessions) {
        return notFound();
    }

    // Fire and forget view count increment
    void supabase.rpc('increment_view_count', { p_token: params.token }).catch(() => {
        // Fallback if rpc doesn't exist yet
        void supabase.from('session_replays').update({ view_count: replay.view_count + 1 }).eq('public_token', params.token);
    });

    const session = replay.interview_sessions as any; // any to bypass strict typing for dynamic joined row
    const annotations: Annotation[] = replay.annotations || [];
    const transcript: any[] = session.transcript || [];
    const durationSec = session.duration_seconds || (transcript.length * 30);
    const durationMin = Math.floor(durationSec / 60);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* HEADER */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 shrink-0">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500 rounded-xl p-2 shrink-0">
                            <Brain className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white leading-tight flex items-center gap-2">
                                {session.problem_title || 'Session Replay'}
                                <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${session.problem_difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                                    session.problem_difficulty === 'medium' ? 'bg-blue-500/10 text-blue-400' :
                                        session.problem_difficulty === 'hard' ? 'bg-red-500/10 text-red-400' :
                                            'bg-slate-800 text-slate-400'
                                    }`}>
                                    {session.problem_difficulty || 'Unknown'}
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">{durationMin} min mock interview</p>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-sm font-bold transition-all text-white group"
                    >
                        Try AlgoMind
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
                    </Link>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-6 pb-24">
                <div className="max-w-4xl mx-auto px-4 w-full">

                    {/* ANNOTATIONS SCROLL-N-SNAP STRIP (Mobile) / TIMELINE (Desktop) */}
                    {annotations.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">AI Interviewer Notes</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {annotations.map((ann, idx) => (
                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex gap-4">
                                        <div className="shrink-0 mt-1">
                                            {ann.type === 'good' ? <ThumbsUp className="w-4 h-4 text-emerald-400" /> :
                                                ann.type === 'missed' ? <AlertCircle className="w-4 h-4 text-amber-400" /> :
                                                    <Lightbulb className="w-4 h-4 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-300 leading-relaxed font-medium">{ann.text}</p>
                                            <div className="mt-2 text-[10px] font-mono text-slate-500">
                                                {Math.floor(ann.timestamp_seconds / 60)}:{String(ann.timestamp_seconds % 60).padStart(2, '0')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TRANSCRIPT */}
                    <div className="space-y-6 mt-8">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Interview Transcript</h3>

                        {transcript.length > 0 ? (
                            transcript.map((msg, i) => {
                                const isUser = msg.role === 'user';
                                if (msg.role === 'system') return null;

                                return (
                                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-5 ${isUser
                                                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-tr-sm'
                                                : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm'
                                            }`}>
                                            <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50 flex items-center justify-between">
                                                <span>{isUser ? 'Candidate' : 'Interviewer'}</span>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
                                                {msg.content}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center border border-dashed border-slate-800 rounded-3xl text-slate-500 space-y-4">
                                <p>Transcript data is missing or corrupted for this session.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* MOBILE PERSISTENT CTA */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-50">
                <Link
                    href="/"
                    className="flex justify-center items-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold transition-colors shadow-lg shadow-blue-900/20"
                >
                    Practice with AlgoMind
                    <Play className="w-4 h-4 fill-current" />
                </Link>
            </div>
        </div>
    );
}
