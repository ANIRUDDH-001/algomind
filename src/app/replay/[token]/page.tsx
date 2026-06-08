/**
 * @codesage
 * @file      src/app/replay/[token]/page.tsx
 * @purpose   Displays a public interview session replay with transcript and AI annotations.
 * @tech      React, Next.js, Lucide React
 * @connects  /lib/supabase/server
 * @apis      None
 * @db        Reads session_replays, interview_sessions, executes increment_view_count RPC
 * @state     Server component
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Brain, ExternalLink, Play, ThumbsUp, Lightbulb, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Annotation {
    timestamp_seconds: number;
    text: string;
    type: 'good' | 'missed' | 'info';
}

interface ReplayPageProps {
    params: Promise<{
        token: string;
    }>
}

// Ensure dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ReplayPage({ params }: ReplayPageProps) {
    const { token } = await params;
    const supabase = await createServerSupabase();

    // 1. Fetch replay and associated session
    const { data: replay } = await supabase
        .from('session_replays')
        .select(`
            *,
            interview_sessions!inner (
                problem_title,
                problem_difficulty,
                duration,
                transcript,
                overall_score
            )
        `)
        .eq('public_token', token)
        .eq('is_public', true)
        .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())
        .maybeSingle();

    // B6: Fallback — if no replay row, try interview_sessions directly
    let isFallback = false;
    let session: any = replay?.interview_sessions;
    let annotations: Annotation[] = replay?.annotations || [];

    if (!replay || !session) {
        const { data: directSession } = await supabase
            .from('interview_sessions')
            .select('problem_title, problem_difficulty:problems(difficulty), duration, transcript, overall_score')
            .eq('id', token)
            .maybeSingle();

        if (!directSession) {
            // Try one more: maybe it's a UUID matching a session without join
            const { data: plainSession } = await supabase
                .from('interview_sessions')
                .select('problem_title, duration, transcript, overall_score')
                .eq('id', token)
                .maybeSingle();

            if (!plainSession) return notFound();
            session = plainSession;
        } else {
            session = {
                ...directSession,
                problem_difficulty: (directSession as any).problem_difficulty?.difficulty || 'medium',
            };
        }
        isFallback = true;
        annotations = [];
    }

    // Fire and forget view count increment (only for actual replays)
    if (replay) {
        void supabase.rpc('increment_view_count', { p_token: token }).then(({ error }) => {
            if (error) {
                // Fallback if rpc doesn't exist yet
                void supabase.from('session_replays').update({ view_count: (replay.view_count || 0) + 1 }).eq('public_token', token);
            }
        });
    }

    const transcript: any[] = session.transcript || [];
    const durationSec = session.duration || (transcript.length * 30);
    const durationMin = Math.floor(durationSec / 60);

    return (
        <div className="min-h-screen text-zinc-100 flex flex-col font-sans" style={{ background: 'var(--surface-base)' }}>
            {/* B6: Fallback banner when viewing without annotations */}
            {isFallback && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-center">
                    <p className="text-amber-300 text-sm font-bold">
                        Direct session link — no AI annotations.
                    </p>
                    <Link href={`/api/replay/generate?sessionId=${token}`} className="text-amber-400 text-xs underline hover:text-amber-300 mt-1 inline-block">
                        Generate AI Annotations →
                    </Link>
                </div>
            )}
            {/* HEADER */}
            <header className="sticky top-0 z-50 glass border-b border-white/8 p-4 shrink-0">
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
                                            'bg-white/5 text-zinc-400'
                                    }`}>
                                    {session.problem_difficulty || 'Unknown'}
                                </span>
                            </h1>
                            <p className="text-xs text-zinc-500">{durationMin} min mock interview</p>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-white group hover:brightness-110"
                        style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge-hi)', border: '1px solid var(--surface-edge-hi)' }}
                    >
                        Try AlgoMind
                        <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400" />
                    </Link>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-6 pb-24">
                <div className="max-w-4xl mx-auto px-4 w-full">

                    {/* ANNOTATIONS SCROLL-N-SNAP STRIP (Mobile) / TIMELINE (Desktop) */}
                    {annotations.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">AI Interviewer Notes</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {annotations.map((ann, idx) => (
                                    <div key={idx} className="surface-1 rounded-2xl p-4 flex gap-4">
                                        <div className="shrink-0 mt-1">
                                            {ann.type === 'good' ? <ThumbsUp className="w-4 h-4 text-emerald-400" /> :
                                                ann.type === 'missed' ? <AlertCircle className="w-4 h-4 text-amber-400" /> :
                                                    <Lightbulb className="w-4 h-4 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-300 leading-relaxed font-medium">{ann.text}</p>
                                            <div className="mt-2 text-[10px] font-mono text-zinc-500">
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
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6">Interview Transcript</h3>

                        {transcript.length > 0 ? (
                            transcript.map((msg, i) => {
                                const isUser = msg.role === 'user';
                                if (msg.role === 'system') return null;

                                return (
                                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-5 ${isUser
                                            ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-tr-sm'
                                            : 'text-zinc-300 rounded-tl-sm'
                                            }`}
                                            style={!isUser ? { background: 'var(--surface-1)', borderColor: 'var(--surface-edge)', border: '1px solid var(--surface-edge)' } : {}}>
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
                            <div className="p-12 text-center border border-dashed border-white/8 rounded-3xl text-zinc-500 space-y-4">
                                <p>Transcript data is missing or corrupted for this session.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* MOBILE PERSISTENT CTA */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 glass border-t border-white/8 z-50">
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
