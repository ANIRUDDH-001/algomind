'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Briefcase, Clock, AlertCircle } from 'lucide-react';
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

export function CandidateInterview({ campaign }: { campaign: CampaignData }) {
    // 1. Setup Phase
    const [phase, setPhase] = useState<'setup' | 'interview' | 'complete'>('setup');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState('');

    // 2. Interview State
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [problem, setProblem] = useState<ProblemData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isAISpeaking, setIsAISpeaking] = useState(false);

    // Timer
    const [timeLeft, setTimeLeft] = useState(campaign.time_limit_mins * 60);
    const startTimeRef = useRef<number>(0);

    // Auto-scroll logic happens inside TextInterviewMode usually, but we manage the chat loop here.

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phase === 'interview' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (phase === 'interview' && timeLeft <= 0) {
            handleComplete();
        }
        return () => clearInterval(timer);
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
            setError(err.message);
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

            if (!res.ok) {
                throw new Error('Failed to get response');
            }

            const data = await res.json();
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.response
            }]);

        } catch (err) {
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
        setPhase('complete');

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

                // Redirect out to viral completion hook page
                const params = new URLSearchParams();
                if (campaign.show_score_to_candidate && data.overallScore) {
                    params.set('score', data.overallScore.toFixed(1));
                }

                window.location.href = `/assess/complete?${params.toString()}`;
            }
        } catch (err) {
            console.error('Failed to save assessment completion', err);
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
