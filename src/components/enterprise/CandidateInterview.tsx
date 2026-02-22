'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Briefcase, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { VoiceSettings } from '@/components/settings/VoiceSettings';

interface CampaignData {
    id: string;
    title: string;
    time_limit_mins: number;
    public_token: string;
    show_score_to_candidate: boolean;
}

interface ProblemData {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    examples?: any[];
}

export function CandidateInterview({ campaign }: { campaign: CampaignData }) {
    const { user } = useAuth();
    const [phase, setPhase] = useState<'setup' | 'interview' | 'submitting'>('setup');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState('');

    // Assessment State received from API
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [problem, setProblem] = useState<ProblemData | null>(null);
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [existingTranscript, setExistingTranscript] = useState<any[]>([]);
    const [timeLimitMins, setTimeLimitMins] = useState<number>(campaign.time_limit_mins);

    // Auto-fill from auth if available
    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
            setEmail(user.email || '');
        }
    }, [user]);

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
            setStartedAt(data.startedAt);
            setExistingTranscript(data.existingTranscript || []);
            if (data.timeLimitMins) setTimeLimitMins(data.timeLimitMins);

            setPhase('interview');
        } catch (err: any) {
            setError(err.message || 'Failed to start interview');
            setIsStarting(false);
        }
    };

    const handleComplete = async (durationSecs: number, transcript: { speaker: string, text: string }[]) => {
        if (!sessionToken) return;

        setPhase('submitting');

        try {
            const res = await fetch('/api/assess/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken,
                    transcript,
                    duration: durationSecs
                })
            });

            if (res.ok) {
                const data = await res.json();
                const params = new URLSearchParams();
                if (campaign.show_score_to_candidate && data.overallScore) {
                    params.set('score', data.overallScore.toFixed(1));
                }
                window.location.href = `/assess/complete?${params.toString()}`;
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to submit assessment.');
            }
        } catch (err: any) {
            console.error('Failed to save assessment completion', err);
            // On failure, alert user and return them to the interview screen so they can try again.
            alert(`Submission Error: ${err.message || 'Network error'}. Please try finishing again.`);
            setPhase('interview');
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

                <div className="max-w-md w-full space-y-4">
                    <p className="text-sm font-medium text-slate-400 text-center mt-4">Optional: Configure Voice Interviewer</p>
                    <VoiceSettings />
                </div>
            </div>
        );
    }

    if (phase === 'submitting') {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-slate-900 border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-white font-medium">Submitting your assessment...</p>
                    <p className="text-slate-400 text-sm">Please don't close this tab.</p>
                </Card>
            </div>
        );
    }

    // phase === 'interview'
    if (!problem || !sessionToken) return null;

    const offsetSeconds = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;

    return (
        <main className="h-screen w-full bg-slate-950 overflow-hidden flex flex-col">
            <InterviewSession
                problem={problem as any}
                initialTranscript={existingTranscript}
                isAssessment={true}
                assessmentSessionToken={sessionToken}
                assessmentApiEndpoint="/api/assess/chat"
                timeLimitMins={timeLimitMins}
                startTimeOffsetSeconds={offsetSeconds}
                onAssessmentComplete={handleComplete}
            />
        </main>
    );
}
