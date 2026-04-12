'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Briefcase, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
// Remove InterviewSession import
import { CampaignInterviewSession, type QuestionState, type ProblemWithTiming } from '@/components/enterprise/CampaignInterviewSession';
import { InterviewErrorBoundary } from '@/components/error/InterviewErrorBoundary';
import { VoiceSettings } from '@/components/settings/VoiceSettings';
import { formatEntryCode } from '@/lib/campaign/entry-code';
import { AssessmentAdapter } from '@/lib/api/adapters/assessment-adapter';

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
    const [phase, setPhase] = useState<'entry_code' | 'setup' | 'interview' | 'submitting'>('entry_code');

    // Entry Code Phase State
    const [entryCode, setEntryCode] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutTimer, setLockoutTimer] = useState(0);

    // Setup & Interview Phase State
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState('');

    // Assessment State received from API
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [submissionId, setSubmissionId] = useState<string>('');
    const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
    const [showScore, setShowScore] = useState<boolean>(false);

    // New Multi-Question State
    const [campaignQuestions, setCampaignQuestions] = useState<any[]>([]);
    const [totalTimeLimitMins, setTotalTimeLimitMins] = useState<number>(0);

    // Auto-fill from auth if available
    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
            setEmail(user.email || '');
        }
    }, [user]);

    // Handle Lockout countdown
    useEffect(() => {
        if (lockoutTimer > 0) {
            const timer = setTimeout(() => setLockoutTimer(v => v - 1), 1000);
            return () => clearTimeout(timer);
        } else if (failedAttempts >= 3 && lockoutTimer === 0) {
            // Reset after lockout expires
            setFailedAttempts(0);
            setVerifyError('');
        }
    }, [lockoutTimer, failedAttempts]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (lockoutTimer > 0) return;

        setVerifyError('');

        if (!name.trim()) {
            setVerifyError('Name is required');
            return;
        }

        if (!email.trim() || !email.includes('@')) {
            setVerifyError('A valid email address is required');
            return;
        }

        if (!entryCode.trim() || entryCode.length < 11) { // A L G - 4 8 2 - X K T is 11 chars
            setVerifyError('Please enter a complete 9-character entry code');
            return;
        }

        setIsVerifying(true);
        try {
            const data = await AssessmentAdapter.verifyCode({
                publicToken: campaign.public_token,
                entryCode,
                candidateName: name.trim(),
                candidateEmail: email.trim(),
            });

            if (!data.valid) {
                throw new Error(data.reason || 'Invalid entry code. Check for typos.');
            }

            // Success! Store multi-question data if available
            setCampaignQuestions(data.questions || []);
            setTotalTimeLimitMins(data.campaign?.time_limit_mins || campaign.time_limit_mins);

            setPhase('setup');
        } catch (err: any) {
            const msg = err.message || 'Verification failed';
            setVerifyError(msg);

            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);
            if (newAttempts >= 3) {
                setLockoutTimer(300); // 5 minutes = 300 seconds
            }
        } finally {
            setIsVerifying(false);
        }
    };

    const handleStart = async () => {
        setStartError('');
        setIsStarting(true);
        try {
            const data = await AssessmentAdapter.start({
                campaignToken: campaign.public_token,
                candidateName: name.trim(),
                candidateEmail: email.trim() || undefined,
                entryCode: entryCode.trim().toUpperCase(),
            });
            setSessionToken(data.sessionToken);
            setCampaignQuestions(data.questions || []);
            setQuestionStates(Array.isArray(data.questionStates) ? (data.questionStates as QuestionState[]) : []);
            setStartedAt(data.startedAt);
            setSubmissionId(data.submissionId);
            setShowScore(data.showScoreToCandidate);

            setPhase('interview');
        } catch (err: any) {
            setStartError(err.message || 'Failed to start interview');
        } finally {
            setIsStarting(false);
        }
    };

    const handleComplete = async (finalQuestionStates: QuestionState[], totalDurationSecs: number) => {
        if (!sessionToken) return;

        setPhase('submitting');

        try {
            const data = await AssessmentAdapter.complete({
                sessionToken,
                questionStates: finalQuestionStates,
                totalDuration: totalDurationSecs,
            });
            const params = new URLSearchParams();
            if (campaign.show_score_to_candidate && data.overallScore) {
                params.set('score', data.overallScore.toFixed(1));
                params.set('showScore', 'true');
            }
            window.location.href = `/assess/complete?${params.toString()}`;
        } catch (err: any) {
            console.error('Failed to save assessment completion', err);
            // On failure, alert user and return them to the interview screen so they can try again.
            alert(`Submission Error: ${err.message || 'Network error'}. Please try finishing again.`);
            setPhase('interview');
        }
    };

    if (phase === 'entry_code') {
        const isLocked = lockoutTimer > 0;
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-[var(--surface-1)] border-white/8">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <Briefcase className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-center text-white mb-2">{campaign.title}</h1>
                    <p className="text-zinc-400 text-sm text-center mb-8">
                        To access this assessment, enter the entry code provided by your employer.
                    </p>

                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-[var(--surface-base)] border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                    placeholder="Jane Doe"
                                    disabled={isVerifying || isLocked || !!user}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-[var(--surface-base)] border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                    placeholder="jane@example.com"
                                    disabled={isVerifying || isLocked || !!user}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="block text-sm font-medium text-zinc-300 mb-2 text-center">
                                Entry Code
                            </label>
                            <input
                                type="text"
                                required
                                value={entryCode}
                                onChange={e => {
                                    const formatted = formatEntryCode(e.target.value);
                                    if (formatted.length <= 11) { // 9 chars + 2 dashes
                                        setEntryCode(formatted);
                                    }
                                }}
                                className="w-full bg-[var(--surface-base)] border-2 border-white/10 focus:border-indigo-500 rounded-lg px-4 py-3 text-white text-center font-mono text-xl tracking-[0.2em] transition-colors uppercase disabled:opacity-50"
                                placeholder="XXX-XXX-XXX"
                                disabled={isVerifying || isLocked}
                            />
                        </div>

                        {verifyError && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg justify-center mt-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{verifyError}</span>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button
                                type="submit"
                                className={`w-full py-6 font-semibold shadow-lg ${isLocked ? 'bg-[var(--surface-2)] text-zinc-500' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                disabled={isVerifying || isLocked || !entryCode || !name || !email}
                            >
                                {isVerifying ? <div className="w-5 h-5 mx-auto rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> :
                                    isLocked ? `Try again in ${Math.ceil(lockoutTimer / 60)}m ${lockoutTimer % 60}s` :
                                        "Verify & Continue"}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-200/80">
                                <p className="font-medium text-amber-500 mb-1">Before you start:</p>
                                <p>Once you click Verify & Continue, you will see a summary of the assessment before the timer begins. Make sure you're in a quiet place.</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (phase === 'setup') {
        const difficultyColors: Record<string, string> = {
            easy: 'text-green-400',
            medium: 'text-amber-400',
            hard: 'text-red-400'
        };

        const difficultyLabels: Record<string, string> = {
            easy: '🟢',
            medium: '🟡',
            hard: '🔴'
        };

        // If it's an old campaign without campaign_questions populated yet or dynamic pool:
        const hasQuestions = campaignQuestions && campaignQuestions.length > 0;
        const displayQuestions = hasQuestions ? campaignQuestions : [{ title: "Coding Challenge", time_limit_mins: totalTimeLimitMins, difficulty: 'medium' }];

        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex flex-col items-center justify-center p-4 py-12 overflow-y-auto">
                <Card className="max-w-lg w-full p-8 bg-[var(--surface-1)] border-white/8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/8 pb-6">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                            <Briefcase className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">Assessment Overview</h2>
                            <p className="text-zinc-400 text-sm mt-0.5">{campaign.title}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <p className="text-zinc-300 font-medium mb-3">You will complete {displayQuestions.length} coding question{displayQuestions.length > 1 ? 's' : ''}:</p>

                            <div className="bg-[var(--surface-base)] border border-white/8 rounded-xl overflow-hidden divide-y divide-slate-800/50">
                                {displayQuestions.map((q: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-2)]/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-zinc-500 font-mono text-xs w-5 font-bold">#{idx + 1}</span>
                                            <span className="font-medium text-zinc-200">{q.title}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm font-mono">
                                            <span className={difficultyColors[q.difficulty || 'medium']} title={q.difficulty}>
                                                {difficultyLabels[q.difficulty || 'medium']}
                                            </span>
                                            <span className="text-zinc-400 flex items-center gap-1.5 min-w-[60px] justify-end">
                                                <Clock className="w-3.5 h-3.5" />
                                                {q.time_limit_mins}m
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div className="p-3 bg-[var(--surface-base)]/80 border-t border-white/8 flex justify-between items-center text-sm font-semibold">
                                    <span className="text-zinc-400 uppercase tracking-wider text-xs ml-2">Total Time</span>
                                    <span className="text-blue-400 mr-2">{totalTimeLimitMins} mins</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--surface-2)]/30 rounded-xl p-5 border border-white/15">
                            <h3 className="text-zinc-200 font-bold mb-3 flex items-center gap-2">
                                <span className="bg-blue-500 text-xs px-2 py-0.5 rounded text-white font-mono">RULES</span>
                            </h3>
                            <ul className="text-sm text-zinc-400 space-y-2.5">
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Timer starts when you click "<strong className="text-zinc-300">Begin Assessment</strong>"</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>You can choose question order</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Each question has its own timer</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>When a question timer ends, it saves automatically and you move to the next</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>You may exit early — answers so far will be submitted</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>Scores shown after completion: <strong className="text-zinc-300">{campaign.show_score_to_candidate ? 'Yes' : 'No'}</strong></span>
                                </li>
                            </ul>
                        </div>

                        {startError && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg justify-center mt-4">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{startError}</span>
                            </div>
                        )}

                        <div className="pt-2">
                            <Button
                                onClick={handleStart}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 shadow-xl shadow-blue-500/10 text-lg font-semibold tracking-wide"
                                disabled={isStarting}
                            >
                                {isStarting ? <div className="w-5 h-5 mx-auto rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : "Begin Assessment"}
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="max-w-lg w-full mt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 text-center mb-4">Optional Voice Settings</p>
                    <VoiceSettings inline />
                </div>
            </div>
        );
    }

    if (phase === 'submitting') {
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-[var(--surface-1)] border-white/8 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    <p className="text-white font-medium">Submitting your assessment...</p>
                    <p className="text-zinc-400 text-sm">Please don't close this tab.</p>
                </Card>
            </div>
        );
    }

    // phase === 'interview'
    if (!campaignQuestions.length || !sessionToken || !startedAt) return null;

    return (
        <InterviewErrorBoundary>
            <CampaignInterviewSession
                sessionToken={sessionToken}
                submissionId={submissionId}
                questions={campaignQuestions as ProblemWithTiming[]}
                initialQuestionStates={questionStates}
                startedAt={startedAt}
                showScoreToCandidate={showScore}
                onComplete={handleComplete}
            />
        </InterviewErrorBoundary>
    );
}
