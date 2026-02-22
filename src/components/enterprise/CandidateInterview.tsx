'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Briefcase, Clock, AlertCircle, MessageSquare, BookOpen, X } from 'lucide-react';
import { TextInterviewMode } from '@/components/interview/TextInterviewMode';

interface CampaignData {
    id: string;
    title: string;
    time_limit_mins: number;
    public_token: string;
    show_score_to_candidate: boolean;
}

interface ProblemData {
    title: string;
    description: string;
    difficulty: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

import { useAuth } from '@/components/auth/AuthProvider';

export function CandidateInterview({ campaign }: { campaign: CampaignData }) {
    const { user } = useAuth();
    // 1. Setup Phase
    const [phase, setPhase] = useState<'setup' | 'interview' | 'submitting' | 'complete'>('setup');
    const [isProblemDrawerOpen, setIsProblemDrawerOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState('');
    const [completionError, setCompletionError] = useState<string | null>(null);

    // 2. Interview State
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [problem, setProblem] = useState<ProblemData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [messagesUsed, setMessagesUsed] = useState(0);
    const MESSAGE = 30;

    // Timer
    const [timeLeft, setTimeLeft] = useState(campaign.time_limit_mins * 60);
    const startTimeRef = useRef<number>(0);

    // Auto-fill from auth if available
    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
            setEmail(user.email || '');
        }
    }, [user]);

    // Auto-scroll logic happens inside TextInterviewMode usually, but we manage the chat loop here.

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phase === 'interview' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (phase === 'interview' && timeLeft <= 0) {
            void handleComplete();
        }
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setIsStarting(true);
        try {
            const res = await fetch('/api/assess/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignToken: campaign.public_token,
                    candidateName: name.trim(),
                    candidateEmail: email.trim() || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start interview');
            }

            const data = await res.json();
            setSessionToken(data.sessionToken);
            setProblem(data.problem);
            startTimeRef.current = Date.now();

            // Add initial system intro if needed, or wait for candidate to say "Hi"
            setMessages([
                { id: '1', role: 'assistant', content: `Hello ${name}! Welcome to the interview for ${campaign.title}. I am your AI interviewer. When you're ready, please introduce yourself or ask for the problem statement.` }
            ]);

            setPhase('interview');
        } catch (err: any) {
            setError(err.message || 'Failed to start interview');
        } finally {
            setIsStarting(false);
        }
    };

    const handleSendMessage = async (content: string) => {
        if (!content.trim() || !sessionToken) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setIsAISpeaking(true);

        try {
            const res = await fetch('/api/assess/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken,
                    messages: newHistory.map(m => ({ role: m.role, content: m.content })),
                    problemContext: problem ? {
                        title: problem.title,
                        content: problem.description
                    } : undefined
                })
            });

            // Read usage counters from headers on every response
            const used = res.headers.get('X-Messages-Used');
            if (used) setMessagesUsed(Number(used));

            if (res.status === 429) {
                const data = await res.json();
                if (data.limitReached) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'system',
                        content: `⚠️ You've reached the ${MESSAGE}-message limit for this session. Please submit your assessment using the "Finish Early" button.`
                    }]);
                    return;
                }
            }

            if (!res.ok) {
                throw new Error('Failed to get response');
            }

            const data = await res.json();
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.response
            }]);

        } catch (_err) {
            // Add a temporary system message to indicate failure
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: 'Error: Failed to connect to the interviewer. Please try again.'
            }]);
        } finally {
            setIsAISpeaking(false);
        }
    };

    const handleComplete = async () => {
        if (!sessionToken) return;

        setPhase('submitting'); // Transitional — show spinner, keep candidate from retrying
        setCompletionError(null);

        try {
            const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);

            const res = await fetch('/api/assess/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken,
                    transcript: messages.map(m => ({ speaker: m.role === 'assistant' ? 'ai' : 'user', text: m.content })),
                    duration: durationSecs
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPhase('complete'); // Only advance on confirmed success

                const params = new URLSearchParams();
                if (campaign.show_score_to_candidate && data.overallScore) {
                    params.set('score', data.overallScore.toFixed(1));
                }
                window.location.href = `/assess/complete?${params.toString()}`;
            } else {
                const errorData = await res.json().catch(() => ({}));
                setCompletionError(
                    (errorData as { error?: string }).error ||
                    'Failed to submit assessment. Please try again.'
                );
                setPhase('interview'); // Revert so candidate can retry
            }
        } catch (err) {
            console.error('Failed to save assessment completion', err);
            setCompletionError('Network error. Please check your connection and try again.');
            setPhase('interview'); // Revert
        }
    };

    if (phase === 'setup') {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-slate-900 border-slate-800">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <Briefcase className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-center text-white mb-2">{campaign.title}</h1>
                    <div className="flex items-center justify-center gap-2 text-slate-400 mb-8">
                        <Clock className="w-4 h-4" />
                        <span>Estimated time: {campaign.time_limit_mins} minutes</span>
                    </div>

                    <form onSubmit={handleStart} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Jane Doe"
                                disabled={isStarting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Email (Optional)
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                placeholder="jane@example.com"
                                disabled={isStarting}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6"
                                disabled={isStarting}
                            >
                                {isStarting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Start Interview →"}
                            </Button>
                        </div>
                    </form>

                    <p className="text-xs text-slate-500 mt-6 text-center">
                        This interview will be recorded and reviewed by the hiring team.
                    </p>
                </Card>
            </div>
        );
    }

    if (phase === 'interview') {
        return (
            <div className="flex flex-col h-screen bg-slate-950">
                {/* Header */}
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-blue-500" />
                        <h2 className="font-semibold text-white truncate max-w-[200px] sm:max-w-md">{campaign.title}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Messages remaining warning — show when ≤ 5 left */}
                        {messagesUsed > 0 && (MESSAGE - messagesUsed) <= 5 && (MESSAGE - messagesUsed) >= 0 && (
                            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium bg-amber-400/10 px-2.5 py-1 rounded-full">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{MESSAGE - messagesUsed} message{MESSAGE - messagesUsed === 1 ? '' : 's'} remaining</span>
                            </div>
                        )}
                        <div className={`font-mono text-lg font-bold flex items-center gap-2 ${timeLeft < 300 ? 'text-red-400' : 'text-slate-300'}`}>
                            <Clock className="w-4 h-4" />
                            {formatTime(timeLeft)}
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleComplete}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        >
                            Finish Early
                        </Button>
                    </div>
                </header>

                {/* Submission error banner — shown when handleComplete fails */}
                {completionError && (
                    <div className="shrink-0 bg-red-900/30 border-b border-red-800 px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-red-300 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{completionError}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleComplete}
                            className="shrink-0 border-red-700 text-red-300 hover:bg-red-800/40 text-xs"
                        >
                            Retry Submission
                        </Button>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Problem Context */}
                    <div className="w-1/3 border-r border-slate-800 overflow-y-auto bg-slate-900/30 p-6 hidden md:block">
                        {problem && (
                            <div className="prose prose-invert max-w-none">
                                <h3 className="text-xl font-bold mb-4">{problem.title}</h3>
                                <div className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                                    {problem.description}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Chat Interface */}
                    <div className="flex-1 min-w-0">
                        <TextInterviewMode
                            // @ts-expect-error - TextInterviewMode interface mapping
                            messages={messages.map(m => ({ ...m, isError: false }))}
                            isProcessing={isAISpeaking}
                            isAISpeaking={isAISpeaking}
                            onSendMessage={handleSendMessage}
                        />
                    </div>
                </div>

                {/* Mobile: Floating problem button */}
                <div className="fixed bottom-20 right-4 z-40 md:hidden">
                    <button
                        onClick={() => setIsProblemDrawerOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg font-medium text-sm transition-colors"
                    >
                        <BookOpen className="w-4 h-4" />
                        View Problem
                    </button>
                </div>

                {/* Mobile Problem Drawer */}
                {isProblemDrawerOpen && (
                    <div className="fixed inset-0 z-50 md:hidden flex flex-col">
                        {/* Backdrop */}
                        <div
                            className="flex-1 bg-black/60"
                            onClick={() => setIsProblemDrawerOpen(false)}
                        />
                        {/* Drawer panel */}
                        <div className="bg-slate-900 border-t border-slate-700 h-3/4 overflow-y-auto rounded-t-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-900">
                                <h3 className="font-semibold text-white">Problem Statement</h3>
                                <button
                                    onClick={() => setIsProblemDrawerOpen(false)}
                                    className="text-slate-400 hover:text-white p-1"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                {problem && (
                                    <div className="prose prose-invert max-w-none">
                                        <h3 className="text-xl font-bold mb-4">{problem.title}</h3>
                                        <div className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                                            {problem.description}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Submitting state — API in-flight, prevent duplicate submissions
    if (phase === 'submitting') {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-slate-900 border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-white font-medium">Submitting your assessment...</p>
                    <p className="text-slate-400 text-sm">Please don&apos;t close this tab.</p>
                </Card>
            </div>
        );
    }

    // Complete State
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 bg-slate-900 border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-slate-400">Finalizing your assessment...</p>
            </Card>
        </div>
    );
}
