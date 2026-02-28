import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useInterview, type Message } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { type AssessmentResult } from '@/lib/assessment/analyzer';
import { type CognitiveSkill } from '@/types/assessment';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterviewLimits } from '@/hooks/useInterviewLimits';
import { useGuestSession, GUEST_SESSION_LIMITS } from '@/hooks/useGuestSession';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { RATE_LIMIT } from '@/lib/rate-limit/user-rate-limiter';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { ConversationView } from './ConversationView';
import { CompanyModeSelector } from './CompanyModeSelector';
import { InterviewLimitBar } from './InterviewLimitBar';
import { TextInterviewMode } from './TextInterviewMode';
// Voice & Layout
import { VoiceOnboarding } from './VoiceOnboarding';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare, ArrowLeft, Clock, AlertTriangle, Code } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

// Assessment & Core
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
import { ReportCard } from '@/components/assessment/ReportCard';
import { SkillBadge } from '@/components/assessment/SkillBadge';

// Tools & Helpers
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Problem } from '@/lib/supabase/problems';
import { CodeEditor } from './CodeEditor';
import { saveInterviewSession } from '@/app/actions/save-session';
import { toast } from 'sonner';
import { GuestRegisterModal } from './GuestRegisterModal';

// Observer
import { SilentObserver, type InterviewState } from '@/lib/interview/silent-observer';
import { SilentObserverNudge } from './SilentObserverNudge';

interface InterviewSessionProps {
    problem: Problem;
    initialTranscript?: { role: string; content: string }[];
    readOnly?: boolean;
    isGuest?: boolean;
    ragContext?: string;
    remainingQuestions?: number;
    isReviewMode?: boolean;
    difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint';

    // Assessment capabilities
    isAssessment?: boolean;
    assessmentSessionToken?: string;
    assessmentApiEndpoint?: string;
    timeLimitMins?: number;
    startTimeOffsetSeconds?: number;
    onAssessmentComplete?: (durationSecs: number, transcript: { speaker: string, text: string }[]) => Promise<void>;
}

const mobileTabs = ['problem', 'interview', 'code', 'history'] as const;
type MobileTab = typeof mobileTabs[number];

export function InterviewSession({
    problem,
    initialTranscript,
    readOnly = false,
    isGuest = false,
    ragContext,
    remainingQuestions,
    isReviewMode = false,
    difficultyMode,
    isAssessment = false,
    assessmentSessionToken,
    assessmentApiEndpoint,
    timeLimitMins,
    startTimeOffsetSeconds,
    onAssessmentComplete
}: InterviewSessionProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // VAD & Observer feature flags (server-side)
    const vadEnabled = useGlobalFeatureFlag('ENABLE_VAD_INTERRUPTIONS', true);
    const observerEnabled = useGlobalFeatureFlag('ENABLE_SILENT_OBSERVER', true);

    // --- 1. Basic State ---
    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<CognitiveSkill>('pattern-recognition');
    const [error, setError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('python');
    const [voiceErrorDismissed, setVoiceErrorDismissed] = useState(false);
    const [vadMode, setVadMode] = useState<'vad' | 'simple'>('vad');

    // Desktop Layout State
    const [showProblemPanel, setShowProblemPanel] = useState(true);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);

    // Mobile Swipe Navigation State
    const [activeTab, setActiveTab] = useState<MobileTab>('interview');
    const { handlers: swipeHandlers, currentIndex } = useSwipeNavigation({
        tabs: mobileTabs,
        activeTab: activeTab,
        onTabChange: (tab) => setActiveTab(tab as MobileTab),
        disabled: showLimitModal || showLoginModal || isAssessment && activeTab === 'problem', // Optional conditional disablings
    });

    // Handle screen resize fallback properly
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                // Reset tab stuff if resized to desktop
                if (showCodeEditor && activeTab !== 'code') setShowCodeEditor(true);
                if (!showCodeEditor && activeTab === 'code') setShowCodeEditor(false);
            } else {
                // Sync state when resizing to mobile
                if (showCodeEditor) setActiveTab('code');
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showCodeEditor, activeTab]);

    // Ensure CodeEditor state merges with mobile tab elegantly
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            if (activeTab === 'code' && !showCodeEditor) setShowCodeEditor(true);
            if (activeTab !== 'code' && showCodeEditor) setShowCodeEditor(false);
        }
    }, [activeTab, showCodeEditor]);


    // --- Company Mode Selection ---
    const [selectedCompany, setSelectedCompany] = useState<string | null>(isAssessment ? null : searchParams.get('company'));
    const [companyPersona, setCompanyPersona] = useState<string | null>(null);

    // --- Kai Memory ---
    const [kaiMemory, setKaiMemory] = useState<string | null>(null);

    // --- Silent Observer ---
    const observerRef = useRef(new SilentObserver());
    const [nudge, setNudge] = useState<string | null>(null);

    useEffect(() => {
        if (!user || isGuest) return;
        fetch('/api/user/memory')
            .then(r => r.ok ? r.json() : null)
            .then((data: { kaiMemory: string | null } | null) => {
                if (data?.kaiMemory) setKaiMemory(data.kaiMemory);
            })
            .catch(() => { });
    }, [user, isGuest]);

    const handleCompanySelect = (id: string | null, persona: string | null) => {
        setSelectedCompany(id);
        setCompanyPersona(persona);

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (id) {
                url.searchParams.set('company', id);
            } else {
                url.searchParams.delete('company');
            }
            window.history.replaceState(null, '', url.toString());
        }
    };

    // --- 2. Supporting Hooks ---
    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const limits = useInterviewLimits({
        maxDurationMins: timeLimitMins,
        startTimeOffsetSeconds
    });
    const guestSession = useGuestSession(isGuest);

    // --- 3. Interview Logic & Callbacks ---
    const { incrementTurn } = limits;
    const { recordUserTurn, recordAITurn, isTrialComplete, showLoginPrompt } = guestSession;

    const handleUserMessage = useCallback((_msg: Message, messageCount: number) => {
        if (isGuest && hasStarted && !isAssessment) {
            recordUserTurn();
            if (isTrialComplete && !showLoginModal) {
                setShowLoginModal(true);
            }
        }
        incrementTurn();
        if (!hasStarted) {
            setHasStarted(true);
        }
        if (!showBadge && messageCount > 2) {
            setLastBadgeSkill(messageCount > 4 ? 'algorithmic-thinking' : 'pattern-recognition');
            setShowBadge(true);
        }
    }, [isGuest, hasStarted, recordUserTurn, isTrialComplete, showLoginModal, incrementTurn, showBadge]);

    const {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        handleInterruption,
        loadTranscript,
        voice,
        endInterview,
        roundCount,
        interviewStartTime,
        isLimitReached,
        limitReason
    } = useInterview({
        vadEnabled,
        isReviewMode,
        apiEndpoint: isAssessment ? assessmentApiEndpoint : undefined,
        sessionToken: isAssessment ? assessmentSessionToken : undefined,
        onUserMessage: handleUserMessage
    });

    // Added an effect to sync AI turns
    useEffect(() => {
        if (isGuest && hasStarted && !isAssessment) {
            const aiMessages = messages.filter(m => m.role === 'assistant').length;
            if (aiMessages > guestSession.aiTurns) {
                recordAITurn();
            }
            if (isTrialComplete && !showLoginModal && showLoginPrompt) {
                setShowLoginModal(true);
            }
        }
    }, [messages, isGuest, hasStarted, isAssessment, guestSession.aiTurns, recordAITurn, isTrialComplete, showLoginModal, showLoginPrompt]);

    const startTimeRef = useRef<number>(0);
    const transcriptLoadedRef = useRef(false);

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    useEffect(() => {
        if (!observerEnabled || !hasStarted || readOnly) return;
        if (state === 'completed' || state === 'idle' || isAnalyzing) return;

        const interval = setInterval(async () => {
            const currentMessages = messagesRef.current;
            const currentElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const tip = await observerRef.current.analyze({
                recentTurns: currentMessages.slice(-3).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                interviewState: state as InterviewState,
                elapsedSeconds: currentElapsed,
            });

            if (tip) {
                setNudge(tip);
            }
        }, 60_000);

        return () => clearInterval(interval);
    }, [hasStarted, readOnly, observerEnabled, state, isAnalyzing]);

    useEffect(() => {
        setHasStarted(false);
        setError(null);
        resetInterview();
        transcriptLoadedRef.current = false;
        guestSession.reset();
        observerRef.current.reset();
        setNudge(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [problem.id]);

    const { isSpeaking, isListening, stopListening } = voice;
    useEffect(() => {
        if (isSpeaking && isListening && !vadEnabled) {
            stopListening();
        }
    }, [isSpeaking, isListening, stopListening, vadEnabled]);

    useEffect(() => {
        if (readOnly && initialTranscript && initialTranscript.length > 0 && !transcriptLoadedRef.current) {
            const msgs = initialTranscript.map(t => ({
                role: t.role as 'user' | 'assistant' | 'system',
                content: typeof t.content === 'string'
                    ? t.content
                    : typeof (t as Record<string, unknown>).text === 'string'
                        ? (t as Record<string, unknown>).text as string
                        : String((t as Record<string, unknown>).content ?? ''),
                timestamp: new Date()
            }));
            loadTranscript(msgs);
            setTimeout(() => setHasStarted(true), 0);
            transcriptLoadedRef.current = true;
        }
    }, [readOnly, initialTranscript, loadTranscript]);

    const handleStart = () => {
        setHasStarted(true);
        startTimeRef.current = Date.now();
        limits.startTimer();
        startInterview(
            problem.title,
            problem.description,
            ragContext,
            companyPersona || undefined,
            kaiMemory || undefined,
            problem.id,
            difficultyMode,
            problem.difficulty
        );
    };



    const shareCodeWithAI = useCallback((code: string) => {
        if (!code.trim()) return;
        const codeMessage = `Here's my code solution:\n\n\`\`\`${codeLanguage}\n${code}\n\`\`\``;
        submitUserResponse(codeMessage, { title: problem.title, content: problem.description });
        setShowCodeEditor(false);
        setActiveTab('interview');
    }, [codeLanguage, problem, submitUserResponse]);

    const isSavingRef = useRef(false);

    const handleFinish = async () => {
        if (isSavingRef.current) return; // Prevent double-click save
        if (messages.length < 2) {
            setError("Please interact with the AI at least once before ending the session to get a valid analysis.");
            return;
        }
        isSavingRef.current = true;
        setError(null);
        try {
            const transcript = messages.map(m => ({ role: m.role, content: m.content }));
            const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000) + (startTimeOffsetSeconds || 0);

            if (isAssessment && onAssessmentComplete) {
                try {
                    await onAssessmentComplete(durationSecs, transcript.map(m => ({ speaker: m.role === 'assistant' ? 'ai' : 'user', text: m.content })));
                } catch (err: unknown) {
                    console.error("❌ Assessment error:", err);
                    setError(err instanceof Error ? err.message : "Failed to submit assessment.");
                }
            } else {
                try {
                    const assessment = await analyzeSession(
                        `sess-${Date.now()}`,
                        { title: problem.title, description: problem.description || '', difficulty: problem.difficulty },
                        transcript
                    );
                    if (!assessment) {
                        setError("Assessment failed. Please try again or check the console for details.");
                        return;
                    }

                    // ✅ FIX: Save immediately after analysis — don't wait for state machine
                    if (user && !isGuest) {
                        try {
                            const fullTranscript = messages.map(msg => ({
                                role: msg.role,
                                content: msg.content,
                                timestamp: msg.timestamp
                            }));
                            const duration = startTimeRef.current
                                ? Math.floor((Date.now() - startTimeRef.current) / 1000)
                                : durationSecs;

                            const { success, error: saveError, sessionId } = await saveInterviewSession(
                                user.id, problem.id, problem.title, fullTranscript, duration, assessment,
                                { difficultyMode }
                            );
                            if (!success) {
                                console.error('Failed to save session:', saveError);
                                toast.error('Session analyzed but could not be saved to history.');
                            } else if (sessionId) {
                                toast.success(
                                    <div>
                                        Interview saved!
                                        <a
                                            href={`/interview/analysis?sessionId=${sessionId}`}
                                            className="underline ml-2"
                                            onClick={() => toast.dismiss()}
                                        >
                                            View Analysis →
                                        </a>
                                    </div>,
                                    { duration: 8000 }
                                );
                            }
                        } catch (saveErr) {
                            console.error('Save exception:', saveErr);
                        }
                    }
                } catch (err: unknown) {
                    console.error("❌ Assessment error:", err);
                    setError(err instanceof Error ? err.message : "Failed to analyze interview. Please try again.");
                }
            }
            limits.stopTimer();
        } finally {
            isSavingRef.current = false;
        }
    };

    useEffect(() => {
        if (hasStarted && !readOnly && (limits.isTimeUp || limits.isTurnsUp)) {
            setShowLimitModal(true);
        }
    }, [hasStarted, readOnly, limits.isTimeUp, limits.isTurnsUp]);

    useEffect(() => {
        if (showBadge) {
            const timer = setTimeout(() => setShowBadge(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [showBadge]);

    if (result) {
        return <ReportCard assessment={result!} onClose={resetAssessment} />;
    }

    // --- Sub-components (Visual Rendering) --- //

    const renderProblemCardContent = () => {
        const leetcodeUrl = problem.external_url || `https://leetcode.com/problemset/all/?search=${encodeURIComponent(problem.title)}`;

        return (
            <Card className="h-full flex flex-col shadow-2xl border-none bg-transparent" data-tour="problem-panel">
                <CardHeader className="bg-black/20 rounded-2xl border py-3 shrink-0 mb-4" style={{ borderColor: 'var(--surface-edge)' }}>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-white truncate">
                                {problem.title}
                            </CardTitle>
                            <Badge className={cn(
                                "text-[10px] px-2 py-0 h-5 shrink-0 border",
                                problem.difficulty === 'easy' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                                problem.difficulty === 'medium' && 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                                problem.difficulty === 'hard' && 'bg-red-500/15 text-red-400 border-red-500/25'
                            )}>
                                {problem.difficulty}
                            </Badge>
                        </div>
                        <a href={leetcodeUrl} target="_blank" rel="noopener noreferrer"
                            className="relative z-50 cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-lg text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:from-indigo-600/30 hover:to-purple-600/30 transition-all shadow-lg shadow-indigo-500/10"
                        >
                            🔗 Practice on LeetCode
                        </a>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 text-zinc-300 text-sm lg:text-[15px] leading-relaxed space-y-3 lg:space-y-6 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="whitespace-pre-wrap font-medium">{problem.description}</div>
                    <div className="space-y-3 lg:space-y-4 pt-2">
                        {problem.examples && problem.examples.map((example, idx) => (
                            <div key={idx} className="rounded-xl p-3 lg:p-4 border shadow-inner group transition-colors" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-edge)' }}>
                                <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wider text-zinc-500 mb-2 lg:mb-3 group-hover:text-indigo-400 transition-colors">Example {idx + 1}:</p>
                                <div className="space-y-2 font-mono text-xs lg:text-sm">
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0 select-none">Input:</span>
                                        <span className="text-indigo-300 break-all">{example.input}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0 select-none">Output:</span>
                                        <span className="text-emerald-400 break-all">{example.output}</span>
                                    </div>
                                    {example.explanation && (
                                        <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                                            <p className="text-zinc-400 font-sans text-[12px] lg:text-[13px] leading-normal">
                                                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest block mb-1">Explanation</span>
                                                {example.explanation}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card >
        );
    };

    const renderInteractionArea = (isMobile: boolean) => (
        <div className="flex-1 h-full min-h-0 container mx-auto relative flex flex-col items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.05) 0%, transparent 70%)' }}>
            <div className="w-full h-full flex flex-col relative max-w-4xl mx-auto">
                <SilentObserverNudge nudge={nudge} onDismiss={() => setNudge(null)} />

                {/* Status Float Chip */}
                {hasStarted && !readOnly && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300">
                        <div className="bg-zinc-900/80 backdrop-blur-xl px-4 py-2 rounded-full border border-zinc-800 shadow-xl flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                voice.isListening ? "bg-indigo-500" : isProcessing ? "bg-amber-400" : voice.isSpeaking ? "bg-purple-500" : "bg-emerald-500"
                            )} />
                            <span className="text-[10px] font-black tracking-widest text-zinc-300 uppercase">
                                {voice.isListening ? "Listening" : isProcessing ? "Thinking" : voice.isSpeaking ? "Speaking" : "Ready"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Mode Toggle as small pill if not started (desktop uses main CTA, mobile might toggle code) */}
                {hasStarted && !readOnly && !isMobile && (
                    <div className="mt-4 absolute top-4 right-4 z-40 hidden lg:block">
                        <div className="flex p-0.5 rounded-full border bg-zinc-900/80 backdrop-blur-sm border-zinc-800">
                            <button onClick={() => setShowCodeEditor(false)} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all", !showCodeEditor ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white")}>Voice</button>
                            <button onClick={() => setShowCodeEditor(true)} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all", showCodeEditor ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white")}>Code</button>
                        </div>
                    </div>
                )}

                {!hasStarted ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8">
                        {!isAssessment && (
                            <div className="w-full max-w-2xl mb-8">
                                <CompanyModeSelector selectedCompany={selectedCompany} onSelect={handleCompanySelect} />
                            </div>
                        )}
                        <Button
                            size="lg"
                            className="w-full max-w-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold h-14 lg:h-16 text-base lg:text-lg shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300 rounded-2xl"
                            onClick={handleStart}
                            data-tour="begin-button"
                        >
                            Begin Interview Experience
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Voice Interaction Mode */}
                        {(!showCodeEditor || isMobile) && (
                            <div className="flex-1 relative flex flex-col items-center justify-center p-4 lg:p-10 h-full w-full">
                                <div className="relative z-20 flex flex-col items-center gap-6 lg:gap-8 w-full max-w-md mx-auto h-full justify-center">

                                    {/* Top-left Timer Display */}
                                    <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
                                        {(!isAssessment && state !== 'idle' && state !== 'completed' && interviewStartTime) ? (
                                            <InterviewLimitBar
                                                startTime={interviewStartTime}
                                                maxMs={10 * 60 * 1000}
                                                roundCount={roundCount}
                                                maxRounds={20}
                                                isLimitReached={isLimitReached}
                                                limitReason={limitReason}
                                            />
                                        ) : (
                                            <div className={cn(
                                                "bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2",
                                                limits.timeRemaining <= 60 ? "border-red-500/50 text-red-400" :
                                                    limits.timeRemaining <= 300 ? "border-amber-500/50 text-amber-400" :
                                                        "border-zinc-800 text-zinc-300"
                                            )}>
                                                <Clock className="w-3 h-3" />
                                                <span className="font-mono font-bold">{limits.formattedElapsed}</span>
                                                <span className="text-zinc-500">/</span>
                                                <span className="font-mono text-zinc-500">{timeLimitMins ? `${timeLimitMins}:00` : "20:00"}</span>
                                            </div>
                                        )}
                                        {isGuest && !isAssessment && (
                                            <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                                                🌟 Trial Mode ({GUEST_SESSION_LIMITS.MAX_USER_TURNS - guestSession.userTurns} turns left)
                                            </div>
                                        )}
                                        {limits.shouldShowTurnWarning && !isGuest && !isAssessment && (
                                            <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-lg text-orange-400 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                                                <AlertTriangle className="w-3 h-3" />
                                                {limits.turnsRemaining} turns remaining
                                            </div>
                                        )}
                                        {!isGuest && remainingQuestions !== undefined && !isAssessment && (
                                            <div className="bg-zinc-800/70 border border-zinc-700 px-2 py-0.5 rounded text-[9px] text-zinc-400">
                                                {remainingQuestions}/{RATE_LIMIT.DAILY_LIMIT} questions remaining today
                                            </div>
                                        )}
                                        {isReviewMode && (
                                            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                                                🔄 Review Mode
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-h-0" />

                                    {/* Microphone / Interactions */}
                                    {!readOnly && (
                                        <div className="flex flex-col items-center justify-center pb-6 gap-3">
                                            <div className="flex items-center justify-center gap-4 relative">
                                                <MicrophoneButton
                                                    isListening={voice.isListening}
                                                    onClick={() => {
                                                        if (voice.isListening) {
                                                            voice.stopListening();
                                                        } else if (!isProcessing && !voice.isSpeaking) {
                                                            voice.startListening();
                                                        }
                                                    }}
                                                    disabled={isProcessing || voice.isSpeaking}
                                                />
                                                <div className="absolute top-1/2 -translate-y-1/2 -right-16">
                                                    <MicPulse
                                                        size="compact"
                                                        state={voice.isListening ? 'listening' : isProcessing ? 'processing' : voice.isSpeaking ? 'speaking' : 'idle'}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {readOnly && (
                                        <div className="flex justify-center pb-6">
                                            <div className="bg-zinc-800/80 px-4 py-2 rounded-full border border-zinc-700 text-zinc-400 text-sm font-medium flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                Session Completed
                                            </div>
                                        </div>
                                    )}

                                    {/* Stop AI Speaking Button */}
                                    {voice.isSpeaking && (
                                        <div className="z-50 w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <Button
                                                size="lg"
                                                onClick={voice.stopSpeaking}
                                                className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm h-12 shadow-xl shadow-red-900/40 transition-all px-8 rounded-full"
                                            >
                                                <StopCircle className="mr-2 h-5 w-5" /> Stop Speaking
                                            </Button>
                                        </div>
                                    )}

                                    {/* Transcript Area */}
                                    <div className="w-full space-y-3 px-1 flex-none min-h-0 flex flex-col h-32 mb-4">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">Live Transcript</label>
                                            {(voice.transcript || voice.interimTranscript) && (
                                                <Badge variant="outline" className="text-[8px] border-emerald-500/30 bg-emerald-500/5 text-emerald-400 h-4">Active</Badge>
                                            )}
                                        </div>
                                        <div className="flex-1 bg-zinc-900/40 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden flex flex-col relative" data-testid="transcript-area">
                                            <div className="absolute inset-0 p-1">
                                                <TranscriptViewer
                                                    transcript={voice.transcript}
                                                    interimTranscript={voice.interimTranscript}
                                                    isEditable={false}
                                                />
                                            </div>
                                        </div>

                                        {voice.transcript && !voice.isListening && (
                                            <Button
                                                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 text-xs shadow-lg shadow-indigo-900/20"
                                                onClick={() => submitUserResponse(voice.transcript, { title: problem.title, content: problem.description })}
                                                disabled={isProcessing}
                                            >
                                                <Send className="w-3 h-3 mr-2" /> Send Message
                                            </Button>
                                        )}

                                        {/* ✅ FIX: End Interview button visible in interview tab on mobile */}
                                        {isMobile && hasStarted && !readOnly && (
                                            <div className="w-full mt-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    onClick={endInterview}
                                                    disabled={roundCount < 1 || isProcessing || isAnalyzing}
                                                    title={roundCount < 1 ? 'Complete at least 1 round before ending' : 'End interview and see analysis'}
                                                    className="w-full h-10 text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10 rounded-xl"
                                                >
                                                    <Flag className="w-4 h-4 mr-1.5" /> End & Analyze
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    const renderControlsCard = () => (
        <div className="shrink-0 w-full">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</span>
                    <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 capitalize text-[10px] px-2 py-0 h-5">
                        {state.replace('-', ' ')}
                    </Badge>
                </div>
                {(hasStarted || readOnly) && (
                    !readOnly ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={endInterview}
                            disabled={roundCount < 1 || isProcessing || isAnalyzing}
                            title={roundCount < 1 ? 'Complete at least 1 round before ending' : 'End interview and see analysis'}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10 rounded-xl"
                        >
                            <Flag className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> End & Analyze
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/dashboard?tab=history')}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-700 transition-all duration-300 rounded-xl"
                        >
                            <ArrowLeft className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> Back
                        </Button>
                    )
                )}
            </div>
        </div>
    );

    const renderHistoryArea = () => (
        <div className="flex flex-col h-full w-full">
            <div className="mb-2 flex justify-between items-center px-1">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Interview History</h2>
                {messages.length > 0 && (
                    <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 text-[9px]">{messages.length} turns</Badge>
                )}
            </div>
            <div className="rounded-2xl border flex flex-col flex-1 overflow-hidden min-h-[200px]" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                <ConversationView
                    messages={messages}
                    isAISpeaking={voice.isSpeaking}
                    vadEnabled={vadEnabled && vadMode === 'vad' && hasStarted}
                    onInterrupt={() => {
                        voice.stopSpeaking();
                        handleInterruption();
                    }}
                    onContinuePreviousResponse={() => {
                        submitUserResponse('Please continue your previous response.', { title: problem.title, content: problem.description, ragContext });
                    }}
                    onVadError={(err) => {
                        console.log('VAD init failed, falling back to simple mic mode:', err.message);
                        setVadMode('simple');
                        // Show a small non-intrusive toast instead of a red error banner
                        toast('Using standard mic mode', {
                            icon: '🎤',
                            duration: 3000,
                            style: { background: '#27272a', color: '#a1a1aa' }
                        });
                    }}
                    onSpeechEnd={(audio) => {
                        if (voice.transcribeVADAudio) {
                            console.log('🎤 VAD triggered Whisper transcription');
                            voice.transcribeVADAudio(audio);
                        } else {
                            console.log('🎤 VAD triggered Browser STT submission');
                            voice.submitCurrentTranscript?.();
                        }
                    }}
                />
            </div>
        </div>
    );

    // --- MAIN RETURN --- //

    return (
        <div className="h-full flex flex-col w-full overflow-y-auto overflow-x-hidden" style={{ background: 'var(--surface-base)' }} data-tour="interview-container">
            {isAnalyzing && <AssessmentLoader />}
            {error && (
                error.includes('VAD Initialization Failed') || error.includes('Voice Activity Detection') || error.includes('AudioWorklet') ? (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800/90 border border-zinc-700/50 rounded-full text-xs text-zinc-400 flex items-center gap-2 max-w-xs shadow-xl">
                        <AlertTriangle className="w-3 h-3 text-zinc-500" />
                        <span>Using standard mic mode</span>
                        <button onClick={() => setError(null)} className="text-zinc-500 hover:text-zinc-300 ml-1">×</button>
                    </div>
                ) : (
                    <ErrorBanner message={error} onClose={() => setError(null)} />
                )
            )}
            {voice.error && !voiceErrorDismissed && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-bounce">
                    <ErrorBanner
                        className="!relative !top-auto !bottom-auto !left-auto !transform-none !w-full"
                        message={`Mic Problem: ${voice.error}. Try clicking the mic button to restart.`}
                        onClose={() => setVoiceErrorDismissed(true)}
                    />
                </div>
            )}
            <GuestRegisterModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

            {showLimitModal && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                                <Clock className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white">
                                {limits.isTimeUp ? 'Time\'s Up!' : 'Turn Limit Reached'}
                            </h3>
                            <p className="text-zinc-400 text-sm">
                                {limits.isTimeUp ? 'Your 20-minute interview session has ended.' : 'You\'ve reached the 20-turn limit for this session.'} Let's analyze your performance!
                            </p>
                            <Button onClick={() => { setShowLimitModal(false); handleFinish(); }} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold">
                                <Flag className="w-4 h-4 mr-2" /> View My Assessment
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed top-24 right-6 z-[60] flex flex-col gap-4 pointer-events-none">
                <SkillBadge skillId={lastBadgeSkill} points={2} shown={showBadge} />
            </div>

            {hasStarted && <VoiceOnboarding />}

            {/* NEW DESKTOP LAYOUT */}
            <div className="hidden lg:flex flex-1 relative min-h-0 w-full overflow-hidden">
                {/* Left Drawer (Problem) */}
                <AnimatePresence>
                    {showProblemPanel && (
                        <motion.div
                            initial={{ x: -400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -400, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                            className="absolute left-0 top-0 bottom-0 w-[380px] z-30 flex flex-col shadow-2xl"
                            style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--surface-edge)' }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
                                <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Problem</span>
                                <button onClick={() => setShowProblemPanel(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                {renderProblemCardContent()}
                            </div>
                            <div className="p-3 border-t bg-black/20 backdrop-blur-xl" style={{ borderColor: 'var(--surface-edge)' }}>
                                {renderControlsCard()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-0 transition-all duration-300 relative w-full"
                    style={{
                        marginLeft: showProblemPanel ? '380px' : '0',
                        marginRight: showHistoryPanel ? '340px' : '0',
                    }}>

                    {!showCodeEditor ? renderInteractionArea(false) : (
                        <div className="flex-1 w-full h-full p-6 animate-in fade-in zoom-in-95 duration-200">
                            <Card className="h-full flex flex-col shadow-2xl rounded-2xl overflow-hidden border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--surface-edge)' }}>
                                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                                        <Code className="w-4 h-4" /> Code Editor
                                    </div>
                                    <button onClick={() => setShowCodeEditor(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                                        ×
                                    </button>
                                </div>
                                <div className="flex-1 flex flex-col gap-3 p-4">
                                    <CodeEditor
                                        onCodeChange={setUserCode}
                                        defaultLanguage={codeLanguage}
                                        initialCode={userCode}
                                        onLanguageChange={setCodeLanguage}
                                        onExecutionResult={(result) => {
                                            if (result.stdout || result.stderr) {
                                                const execSummary = result.exit_code === 0 ? `Code executed successfully.\nOutput:\n${result.stdout.slice(0, 500)}` : `Code failed with exit code ${result.exit_code}.\nError:\n${result.stderr.slice(0, 500)}`;
                                                shareCodeWithAI(userCode + '\n\n[Execution Result]\n' + execSummary);
                                            }
                                        }}
                                    />
                                    <Button onClick={() => shareCodeWithAI(userCode)} disabled={!userCode.trim() || isProcessing || voice.isSpeaking} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 shadow-lg shadow-indigo-900/20 rounded-xl">
                                        <Send className="w-4 h-4 mr-2" /> Share Code with Kai
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                </div>

                {/* Right Drawer (History) */}
                <AnimatePresence>
                    {showHistoryPanel && (
                        <motion.div
                            initial={{ x: 340, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 340, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                            className="absolute right-0 top-0 bottom-0 w-[340px] z-30 flex flex-col shadow-2xl"
                            style={{ background: 'var(--surface-1)', borderLeft: '1px solid var(--surface-edge)' }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
                                <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Conversation</span>
                                <button onClick={() => setShowHistoryPanel(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                                {renderHistoryArea()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating sidebar toggles (always visible) */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowProblemPanel(v => !v)}
                        className="w-8 h-24 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-bold transition-all shadow-xl"
                        style={{
                            background: showProblemPanel ? 'var(--accent-primary)' : 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            color: showProblemPanel ? 'white' : '#71717a',
                            writingMode: 'vertical-rl',
                        }}>
                        <BookOpen className="w-3.5 h-3.5" style={{ writingMode: 'initial' }} />
                        Problem
                    </motion.button>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowHistoryPanel(v => !v)}
                        className="w-8 h-24 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-bold transition-all shadow-xl"
                        style={{
                            background: showHistoryPanel ? 'var(--accent-primary)' : 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            color: showHistoryPanel ? 'white' : '#71717a',
                            writingMode: 'vertical-rl',
                        }}>
                        <MessageSquare className="w-3.5 h-3.5" style={{ writingMode: 'initial' }} />
                        History
                    </motion.button>
                </div>
            </div>

            {/* MOBILE LAYOUT w/ Swipe Tabs */}
            <div
                className="lg:hidden flex-1 w-full h-full relative"
                {...swipeHandlers}
                style={{ touchAction: 'pan-y' }}
            >
                <div className="absolute inset-0 flex flex-col overflow-hidden pb-14">
                    {activeTab === 'problem' && (
                        <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-left-4">
                            <div className="flex-1">{renderProblemCardContent()}</div>
                            <div className="mt-4 shrink-0">{renderControlsCard()}</div>
                        </div>
                    )}

                    {activeTab === 'interview' && (
                        <div className="flex-1 w-full h-full animate-in fade-in zoom-in-95">
                            {renderInteractionArea(true)}
                        </div>
                    )}

                    {activeTab === 'code' && (
                        <div className="flex-1 w-full h-full p-2 animate-in fade-in slide-in-from-bottom-4">
                            <Card className="h-full flex flex-col shadow-xl rounded-2xl overflow-hidden border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--surface-edge)' }}>
                                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[12px]">
                                        <Code className="w-3.5 h-3.5" /> Code
                                    </div>
                                    <button onClick={() => setActiveTab('interview')} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                                        ×
                                    </button>
                                </div>
                                <div className="flex-1 flex flex-col gap-2 p-2">
                                    <CodeEditor
                                        onCodeChange={setUserCode}
                                        defaultLanguage={codeLanguage}
                                        initialCode={userCode}
                                        onLanguageChange={setCodeLanguage}
                                        onExecutionResult={(result) => {
                                            if (result.stdout || result.stderr) {
                                                const execSummary = result.exit_code === 0 ? `Code executed successfully.\nOutput:\n${result.stdout.slice(0, 500)}` : `Code failed with exit code ${result.exit_code}.\nError:\n${result.stderr.slice(0, 500)}`;
                                                shareCodeWithAI(userCode + '\n\n[Execution Result]\n' + execSummary);
                                            }
                                        }}
                                    />
                                    <Button onClick={() => shareCodeWithAI(userCode)} disabled={!userCode.trim() || isProcessing || voice.isSpeaking} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 shadow-lg shrink-0 rounded-xl">
                                        <Send className="w-3.5 h-3.5 mr-1.5" /> Share
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-right-4">
                            {renderHistoryArea()}
                        </div>
                    )}

                    {/* ✅ FIXED: Visible clickable tab bar (replaces useless swipe dots) */}
                    <div className="absolute bottom-0 left-0 right-0 z-50 flex border-t"
                        style={{
                            background: 'var(--surface-1)',
                            borderColor: 'var(--surface-edge)',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)'  // iPhone home bar
                        }}
                    >
                        {([
                            { id: 'problem', label: 'Problem', icon: BookOpen },
                            { id: 'interview', label: 'Voice', icon: Mic },
                            { id: 'code', label: 'Code', icon: Code },
                            { id: 'history', label: 'Chat', icon: MessageSquare },
                        ] as const).map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id as MobileTab)}
                                className={cn(
                                    "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all text-[10px] font-bold uppercase tracking-wider",
                                    activeTab === id
                                        ? "text-indigo-400"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Icon className={cn(
                                    "w-5 h-5 transition-all",
                                    activeTab === id ? "text-indigo-400" : "text-zinc-500"
                                )} />
                                <span>{label}</span>
                                {/* Active indicator dot */}
                                {activeTab === id && (
                                    <div className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}