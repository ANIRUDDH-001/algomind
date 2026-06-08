/**
 * @codesage
 * @file      src/components/enterprise/CampaignInterviewSession.tsx
 * @purpose   Manages the state and UI for an active campaign interview session.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/components/ui/card, @/components/interview/InterviewSession, @/lib/api/adapters/assessment-adapter
 * @apis      /api/assess/save-progress, /api/assess/chat
 * @db        None
 * @state     useState, useCallback, useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/* eslint-disable react-hooks/set-state-in-effect */
'use client';

//  -- automated unused local suppression
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
//  -- automated unused local suppression
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, AlertTriangle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
//  -- automated unused local suppression
import { useInterview, type Message } from '@/hooks/useInterview';
//  -- automated unused local suppression
import { ConversationView } from '@/components/interview/ConversationView';
//  -- automated unused local suppression
import { CodeEditor } from '@/components/interview/CodeEditor';
//  -- automated unused local suppression
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
//  -- automated unused local suppression
import { MicPulse } from '@/components/voice/MicPulse';
import { isMobileDevice } from '@/lib/utils/device-detection';
import { toast } from 'sonner';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { AssessmentAdapter } from '@/lib/api/adapters/assessment-adapter';

export interface ProblemWithTiming {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    examples?: any[];
    time_limit_mins: number;
    order: number;
}

export interface QuestionState {
    problem_id: string;
    order: number;
    time_limit_mins: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'expired';
    started_at: string | null;
    completed_at: string | null;
    elapsed_secs: number;
    transcript: { speaker: string; text: string }[];
    final_code?: string;
}

export interface CampaignInterviewSessionProps {
    sessionToken: string;
    submissionId: string;
    questions: ProblemWithTiming[];
    initialQuestionStates: QuestionState[];
    startedAt: string;
    showScoreToCandidate: boolean;
    onComplete: (questionStates: QuestionState[], totalDuration: number) => Promise<void>;
}

export function CampaignInterviewSession({
    sessionToken,
    //  -- automated unused local suppression
    submissionId,
    questions,
    initialQuestionStates,
    //  -- automated unused local suppression
    startedAt,
    //  -- automated unused local suppression
    showScoreToCandidate,
    onComplete
}: CampaignInterviewSessionProps) {
    const [questionStates, setQuestionStates] = useState<QuestionState[]>(initialQuestionStates);
    const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
    const [showExitModal, setShowExitModal] = useState(false);

    const [showNextQuestionBanner, setShowNextQuestionBanner] = useState(false);
    const [nextQuestionCountdown, setNextQuestionCountdown] = useState(10);
    const [isSaving, setIsSaving] = useState(false);
    //  -- automated unused local suppression
    const [activeTabMobile, setActiveTabMobile] = useState<'questions' | 'interview' | 'code'>('questions');

    const saveProgress = useCallback(async (states: QuestionState[], currentIdx: number | null) => {
        try {
            await AssessmentAdapter.saveProgress({
                sessionToken,
                questionStates: states,
                currentProblemId: currentIdx !== null ? questions[currentIdx].id : null,
            });
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    }, [sessionToken, questions]);

    useEffect(() => {
        const handleUnload = () => {
            if (activeQuestionIdx !== null) {
                // Fire-and-forget save on tab close
                navigator.sendBeacon('/api/assess/save-progress', JSON.stringify({
                    sessionToken,
                    questionStates,
                    currentProblemId: questions[activeQuestionIdx]?.id ?? null
                }));
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [questionStates, activeQuestionIdx, sessionToken, questions]);

    const handleSelectQuestion = (idx: number) => {
        if (questionStates[idx].status === 'completed' || questionStates[idx].status === 'expired') {
            return; // Can't select completed questions
        }

        setQuestionStates(prev => {
            const next = [...prev];
            if (next[idx].status === 'not_started') {
                next[idx] = {
                    ...next[idx],
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                };
            }
            saveProgress(next, idx);
            return next;
        });

        setActiveQuestionIdx(idx);
        if (isMobileDevice()) setActiveTabMobile('interview');
    };

    const handleQuestionSubmit = async (idx: number, finalTranscript: any[], finalCode: string, elapsedSecs: number) => {
        const nextStates = [...questionStates];
        nextStates[idx] = {
            ...nextStates[idx],
            status: 'completed',
            completed_at: new Date().toISOString(),
            elapsed_secs: elapsedSecs,
            transcript: finalTranscript,
            final_code: finalCode
        };
        setQuestionStates(nextStates);
        await saveProgress(nextStates, null);
        setActiveQuestionIdx(null);
        if (isMobileDevice()) setActiveTabMobile('questions');
    };

    //  -- automated unused local suppression
    const handleQuestionExpire = async (idx: number, finalTranscript: any[], finalCode: string, elapsedSecs: number) => {
        const nextStates = [...questionStates];
        nextStates[idx] = {
            ...nextStates[idx],
            status: 'expired',
            completed_at: new Date().toISOString(),
            elapsed_secs: elapsedSecs,
            transcript: finalTranscript,
            final_code: finalCode
        };
        setQuestionStates(nextStates);
        await saveProgress(nextStates, null);

        setShowNextQuestionBanner(true);
        setNextQuestionCountdown(10);
    };

    useEffect(() => {
        if (showNextQuestionBanner && nextQuestionCountdown > 0) {
            const timer = setTimeout(() => setNextQuestionCountdown(v => v - 1), 1000);
            return () => clearTimeout(timer);
        } else if (showNextQuestionBanner && nextQuestionCountdown === 0) {
            setShowNextQuestionBanner(false);
            setActiveQuestionIdx(null);
            if (isMobileDevice()) setActiveTabMobile('questions');
        }
    }, [showNextQuestionBanner, nextQuestionCountdown]);

    const handleExitComplete = async () => {
        setIsSaving(true);
        try {
            // Calculate total duration (sum of all elapsed)
            const totalDuration = questionStates.reduce((acc, q) => acc + q.elapsed_secs, 0);

            // Mark any in_progress ones as completed
            const finalStates = questionStates.map(q => {
                if (q.status === 'in_progress') {
                    return { ...q, status: 'completed' as const, completed_at: new Date().toISOString() };
                }
                return q;
            });

            await onComplete(finalStates, totalDuration);
        } catch (e) {
            console.error(e);
            toast.error("Failed to submit assessment.");
            setIsSaving(false);
        }
    };

    // Render Question Selector
    if (activeQuestionIdx === null) {
        return (
            <div className="min-h-screen bg-[var(--surface-base)] flex flex-col items-center py-10 px-4">
                <div className="max-w-3xl w-full">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Assessment Questions</h1>
                            <p className="text-zinc-400 text-sm mt-1">Select a question to begin. You can complete them in any order.</p>
                        </div>
                        <Button
                            variant="destructive"
                            className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                            onClick={() => setShowExitModal(true)}
                        >
                            <LogOut className="w-4 h-4 mr-2" /> Exit Assessment
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, idx) => {
                            const state = questionStates[idx];
                            const isDone = state.status === 'completed' || state.status === 'expired';
                            const isStarted = state.status === 'in_progress';

                            return (
                                <Card
                                    key={q.id}
                                    className={cn(
                                        "bg-[var(--surface-1)] border-white/8 transition-all cursor-pointer hover:border-blue-500/50",
                                        isDone && "opacity-75 cursor-default hover:border-white/8",
                                        isStarted && "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                    )}
                                    onClick={() => handleSelectQuestion(idx)}
                                >
                                    <div className="p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                isDone ? "bg-green-500/10 text-green-500" :
                                                    isStarted ? "bg-blue-500/10 text-blue-500" :
                                                        "bg-[var(--surface-2)] text-zinc-400"
                                            )}>
                                                {isDone ? <CheckCircle className="w-5 h-5" /> :
                                                    isStarted ? <Play className="w-5 h-5 ml-1" /> :
                                                        <span className="font-bold">{idx + 1}</span>}
                                            </div>
                                            <div>
                                                <h3 className={cn("font-bold text-lg", isDone ? "text-zinc-300" : "text-white")}>
                                                    {q.title}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1 text-sm font-mono text-zinc-400">
                                                    <span className={cn(
                                                        q.difficulty === 'easy' && "text-green-400",
                                                        q.difficulty === 'medium' && "text-amber-400",
                                                        q.difficulty === 'hard' && "text-red-400"
                                                    )}>{q.difficulty}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {q.time_limit_mins} mins
                                                    </span>
                                                    {isDone && (
                                                        <>
                                                            <span>•</span>
                                                            <span className={state.status === 'expired' ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                                                                {state.status === 'expired' ? 'Time Expired' : 'Completed'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!isDone && (
                                            <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                                                {isStarted ? "Resume" : "Start"} →
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>

                {showExitModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <Card className="max-w-md w-full bg-[var(--surface-1)] border-white/8">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-400">
                                    <AlertTriangle className="w-5 h-5" /> Exit Assessment Early?
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-zinc-300 text-sm">
                                    Your progress so far will be saved and submitted. You will not be able to return to this assessment.
                                </p>
                                <div className="space-y-2 bg-[var(--surface-base)] p-3 rounded-lg border border-white/8 text-sm">
                                    {questions.map((q, idx) => {
                                        const status = questionStates[idx].status;
                                        return (
                                            <div key={q.id} className="flex justify-between items-center">
                                                <span className="text-zinc-300 truncate pr-4">{q.title}</span>
                                                <span className={cn(
                                                    "text-xs font-bold uppercase tracking-wider shrink-0",
                                                    status === 'completed' || status === 'expired' ? "text-green-400" :
                                                        status === 'in_progress' ? "text-blue-400" : "text-zinc-500"
                                                )}>
                                                    {status === 'not_started' ? 'Pending' :
                                                        status === 'in_progress' ? 'As-Is' : 'Done'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="ghost" onClick={() => setShowExitModal(false)} className="text-zinc-300">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleExitComplete} className="bg-red-600 hover:bg-red-500 text-white" disabled={isSaving}>
                                        {isSaving ? "Submitting..." : "Submit & Exit"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        );
    }

    // Active Question Render
    const activeQuestion = questions[activeQuestionIdx!];
    const activeState = questionStates[activeQuestionIdx!];

    return (
        <div className="flex flex-col h-screen bg-[var(--surface-base)] overflow-hidden">
            {/* Header: Unified with Campaign controls */}
            <header className="h-14 bg-[var(--surface-base)] border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setActiveQuestionIdx(null)} className="text-zinc-400 hover:text-white shrink-0">
                        ← Back to Questions
                    </Button>
                    <div className="h-4 w-px bg-zinc-800 hidden sm:block"></div>
                    <span className="text-white font-bold truncate max-w-[200px] hidden sm:block">{activeQuestion.title}</span>
                </div>


            </header>

            <div className="flex-1 relative overflow-hidden">
                <InterviewSession
                    problem={{
                        id: activeQuestion.id,
                        title: activeQuestion.title,
                        description: activeQuestion.description,
                        difficulty: activeQuestion.difficulty as any,
                        examples: activeQuestion.examples
                    } as any}
                    interviewConfig={{
                        mode: 'employer',
                        difficultyMode: 'practice',
                        maxTurnsPerProblem: 20,
                        maxDurationMs: Math.max(60_000, (activeState.time_limit_mins * 60 - activeState.elapsed_secs) * 1000),
                    } as any}
                    isAssessment
                    assessmentSessionToken={sessionToken}
                    assessmentApiEndpoint="/api/assess/chat"
                    initialTranscript={activeState.transcript.map(t => ({
                        role: t.speaker === 'ai' ? 'assistant' : t.speaker,
                        content: t.text
                    }))}
                    onAssessmentComplete={async (elapsed: number, transcript: any[]) => {
                        await handleQuestionSubmit(activeQuestionIdx!, transcript, activeState.final_code || '', elapsed);
                    }}
                />
            </div>

            {showNextQuestionBanner && (
                <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="text-center p-8 bg-zinc-900 border-red-500/50 max-w-sm w-full">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Time's Up!</h2>
                        <p className="text-zinc-400 mb-6">You've reached the time limit for this question. Moving to the next...</p>
                        <div className="text-4xl font-mono text-red-400 font-bold mb-6">
                            {nextQuestionCountdown}
                        </div>
                        <Button onClick={() => {
                            setShowNextQuestionBanner(false);
                            setActiveQuestionIdx(null);
                        }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
                            Continue Now
                        </Button>
                    </Card>
                </div>
            )}
        </div>
    );
}
