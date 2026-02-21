import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useInterview, type Message } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { type AssessmentResult } from '@/lib/assessment/analyzer';
import { type CognitiveSkill } from '@/types/assessment';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterviewLimits } from '@/hooks/useInterviewLimits';
import { useGuestTrial, GUEST_TRIAL_LIMITS } from '@/hooks/useGuestTrial';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { RATE_LIMIT } from '@/lib/rate-limit/user-rate-limiter';
import { ConversationView } from './ConversationView';
import { CompanyModeSelector } from './CompanyModeSelector';
import { TextInterviewMode } from './TextInterviewMode';
// Voice & Layout
import { VoiceOnboarding } from './VoiceOnboarding';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare, ArrowLeft, Clock, AlertTriangle, Code } from 'lucide-react';
import { cn } from "@/lib/utils";

// Assessment & Core
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
import { ReportCard } from '@/components/assessment/ReportCard';
import { SkillBadge } from '@/components/assessment/SkillBadge';

// Tools & Helpers
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Problem } from '@/lib/supabase/problems';
import { CodeEditor } from './CodeEditor';
import { isMobileDevice } from '@/lib/utils/device-detection';
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
}

export function InterviewSession({
    problem,
    initialTranscript,
    readOnly = false,
    isGuest = false,
    ragContext,
    remainingQuestions,
    isReviewMode = false
}: InterviewSessionProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // VAD & Observer feature flags
    const { enabled: vadEnabled } = useFeatureFlag('ENABLE_VAD_INTERRUPTIONS');
    const { enabled: observerEnabled } = useFeatureFlag('ENABLE_SILENT_OBSERVER');

    // --- 1. Basic State ---
    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<CognitiveSkill>('pattern-recognition');
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('interview');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('python');
    const [voiceErrorDismissed, setVoiceErrorDismissed] = useState(false);
    const [isMobileTextMode, setIsMobileTextMode] = useState(false);

    // --- Company Mode Selection ---
    const [selectedCompany, setSelectedCompany] = useState<string | null>(searchParams.get('company'));
    const [companyPersona, setCompanyPersona] = useState<string | null>(null);

    // --- Kai Memory (fetched once on mount, sent with every request) ---
    const [kaiMemory, setKaiMemory] = useState<string | null>(null);

    // --- Silent Observer ---
    const observerRef = React.useRef(new SilentObserver());
    const [nudge, setNudge] = useState<string | null>(null);

    useEffect(() => {
        if (!user || isGuest) return;
        fetch('/api/user/memory')
            .then(r => r.ok ? r.json() : null)
            .then((data: { kaiMemory: string | null } | null) => {
                if (data?.kaiMemory) setKaiMemory(data.kaiMemory);
            })
            .catch(() => { }); // Never block the interview
    }, [user, isGuest]);

    const handleCompanySelect = (id: string | null, persona: string | null) => {
        setSelectedCompany(id);
        setCompanyPersona(persona);

        const newParams = new URLSearchParams(searchParams.toString());
        if (id) {
            newParams.set('company', id);
        } else {
            newParams.delete('company');
        }
        router.replace(`?${newParams.toString()}`, { scroll: false });
    };

    // --- 2. Supporting Hooks ---
    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const limits = useInterviewLimits();
    const guestTrial = useGuestTrial(isGuest);

    // --- 3. Interview Logic & Callbacks ---
    const { incrementTurn } = limits;
    const { recordTurn, isTrialComplete } = guestTrial;

    const handleUserMessage = useCallback((_msg: Message, messageCount: number) => {
        // 1. Guest trial turn tracking
        if (isGuest && hasStarted) {
            recordTurn();
            // Show login modal when trial is complete
            if (isTrialComplete && !showLoginModal) {
                setShowLoginModal(true);
            }
        }

        // 2. Increment turn counter
        if (hasStarted) {
            incrementTurn();
        }

        // 3. Demo Skill Badge logic: Trigger a badge on user message
        if (!showBadge && messageCount > 2) {
            setLastBadgeSkill(messageCount > 4 ? 'algorithmic-thinking' : 'pattern-recognition');
            setShowBadge(true);
        }
    }, [isGuest, hasStarted, recordTurn, isTrialComplete, showLoginModal, incrementTurn, showBadge]);

    const {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        handleInterruption,
        loadTranscript,
        voice
    } = useInterview({
        vadEnabled,
        isReviewMode,
        onUserMessage: handleUserMessage
    });

    // Track session start time for duration calculation
    const startTimeRef = React.useRef<number>(0);
    // Track if transcript has been loaded to prevent infinite loops
    const transcriptLoadedRef = React.useRef(false);

    // Sync optimistic state with real state
    // Handled by useInterview hook now

    // Keep a ref to always-current messages so the observer interval
    // doesn't need messages in its dep array (which recreated it on every turn).
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // --- Silent Observer Tick Loop ---
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
        // messages intentionally removed — accessed via messagesRef to prevent interval restart on each turn
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasStarted, readOnly, observerEnabled, state, isAnalyzing]);

    useEffect(() => {
        // Reset local and hook state when problem changes
        setHasStarted(false);
        setError(null);
        resetInterview();
        transcriptLoadedRef.current = false;
        guestTrial.reset();
        observerRef.current.reset();
        setNudge(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [problem.id]);

    // Stop listening when AI speaks (prevent echo) — only if VAD is disabled
    const { isSpeaking, isListening, stopListening } = voice;
    useEffect(() => {
        if (isSpeaking && isListening && !vadEnabled) {
            stopListening();
        }
    }, [isSpeaking, isListening, stopListening, vadEnabled]);

    // Handle Read-Only Mode / Resume Session
    useEffect(() => {
        if (readOnly && initialTranscript && initialTranscript.length > 0 && !transcriptLoadedRef.current) {
            const msgs = initialTranscript.map(t => ({
                role: t.role as 'user' | 'assistant' | 'system',
                content: typeof t.content === 'string'
                    ? t.content
                    : typeof (t as Record<string, unknown>).text === 'string'
                        ? (t as Record<string, unknown>).text as string
                        : String((t as Record<string, unknown>).content ?? ''),
                timestamp: new Date() // Placeholder as we don't store per-msg timestamp yet
            }));
            loadTranscript(msgs);
            setTimeout(() => setHasStarted(true), 0);
            transcriptLoadedRef.current = true;
        }
    }, [readOnly, initialTranscript, loadTranscript]);

    const handleStart = () => {
        setHasStarted(true);
        startTimeRef.current = Date.now(); // Record start time

        // Start timer for limits
        limits.startTimer();

        // Rate limiting is now handled atomically by check_user_rate_limit RPC
        // which increments on check. No separate client-side increment needed.

        startInterview(problem.title, problem.description, ragContext, companyPersona || undefined, kaiMemory || undefined);
    };

    // --- SESSION PERSISTENCE ---
    const handleSaveSession = useCallback(async (result: AssessmentResult) => {
        if (!user || !user.id || !problem || isGuest) return;

        try {
            toast.loading('Saving interview session...', { id: 'save-session' });

            // Convert history to serializable format
            const transcript = messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp
            }));

            // Calculate approximate duration
            const duration = startTimeRef.current
                ? Math.floor((Date.now() - startTimeRef.current) / 1000)
                : 0;

            const { success, error } = await saveInterviewSession(
                user.id,
                problem.id,
                problem.title,
                transcript,
                duration,
                result
            );

            if (success) {
                toast.success('Interview saved to history!', { id: 'save-session' });
            } else {
                toast.error('Failed to save session to history', { id: 'save-session' });
                console.error('Save failed:', error);
            }
        } catch (e) {
            console.error('Save exception:', e);
            toast.error('Error saving session', { id: 'save-session' });
        }
    }, [user, problem, isGuest, messages]);

    // Trigger save when assessment is complete
    useEffect(() => {
        if (state === 'completed' && result && !isGuest && !readOnly) {
            handleSaveSession(result);
        }
    }, [state, result, isGuest, readOnly, handleSaveSession]);


    // Adds user code to the interview context so AI can critique it
    const shareCodeWithAI = useCallback((code: string) => {
        if (!code.trim()) return;

        const codeMessage = `Here's my code solution:\n\n\`\`\`${codeLanguage}\n${code}\n\`\`\``;

        // Use existing submitUserResponse function
        submitUserResponse(codeMessage, {
            title: problem.title,
            content: problem.description
        });

        // Switch back to voice mode to hear Kai's feedback
        setShowCodeEditor(false);
    }, [codeLanguage, problem, submitUserResponse]);

    const handleFinish = async () => {
        if (messages.length < 2) {
            setError("Please interact with the AI at least once before ending the session to get a valid analysis.");
            return;
        }

        setError(null); // Clear any previous errors

        // Trigger Analysis
        const transcript = messages.map(m => ({ role: m.role, content: m.content }));

        try {
            const assessment = await analyzeSession(
                `sess-${Date.now()}`,
                { title: problem.title, description: problem.description || '', difficulty: problem.difficulty },
                transcript
            );

            if (!assessment) {
                console.error("❌ Analysis returned null - check assessmentError state");
                setError("Assessment failed. Please try again or check the console for details.");
                return;
            }

            // Session saving is handled by the server action (handleSaveSession)
            // triggered by the useEffect watching state === 'completed'
        } catch (err: unknown) {
            console.error("❌ Assessment error:", err);
            setError(err instanceof Error ? err.message : "Failed to analyze interview. Please try again.");
        }

        // Stop timer
        limits.stopTimer();
    };

    // Auto-end on limits (time or turns)
    const { isTimeUp, isTurnsUp } = limits;
    useEffect(() => {
        if (hasStarted && !readOnly && (isTimeUp || isTurnsUp)) {
            setShowLimitModal(true);
        }
    }, [hasStarted, readOnly, isTimeUp, isTurnsUp]);

    // Badge Auto-Hide Timer - Separate effect to prevent cancellation by message updates
    useEffect(() => {
        if (showBadge) {
            const timer = setTimeout(() => setShowBadge(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [showBadge]);

    if (result) {
        return <ReportCard assessment={result!} onClose={resetAssessment} />;
    }

    // --- Sub-components to avoid code duplication between Mobile/Desktop ---

    const renderProblemCardContent = (isMobile = false) => {
        const leetcodeUrl = problem.external_url || `https://leetcode.com/problemset/all/?search=${encodeURIComponent(problem.title)}`;

        return (
            <Card className={cn(
                "bg-slate-900/30 backdrop-blur-sm border-slate-800/50 overflow-hidden flex flex-col shadow-2xl",
                !isMobile ? "h-full" : "h-auto"
            )} data-tour="problem-panel">
                <CardHeader className="bg-slate-950/40 border-b border-slate-800/50 py-3 shrink-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-white truncate">
                                {problem.title}
                            </CardTitle>
                            <Badge className={cn(
                                "text-[10px] px-2 py-0 h-5 shrink-0",
                                problem.difficulty === 'easy' && 'bg-green-500/20 text-green-400 border-green-500/30',
                                problem.difficulty === 'medium' && 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                problem.difficulty === 'hard' && 'bg-red-500/20 text-red-400 border-red-500/30'
                            )}>
                                {problem.difficulty}
                            </Badge>
                        </div>
                        <a
                            href={leetcodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative z-50 cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:border-blue-500/50 hover:from-blue-600/30 hover:to-purple-600/30 transition-all shadow-lg shadow-blue-500/10"

                        >
                            🔗 Practice on LeetCode
                        </a>
                    </div>
                </CardHeader>
                <CardContent className={cn(
                    "p-3 lg:p-5 flex-1 text-slate-300 text-sm lg:text-[15px] leading-relaxed space-y-3 lg:space-y-6 min-h-0",
                    !isMobile ? "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent" : "overflow-visible"
                )}>
                    <div className="whitespace-pre-wrap font-medium">{problem.description}</div>
                    <div className="space-y-3 lg:space-y-4 pt-2">
                        {problem.examples && problem.examples.map((example, idx) => (
                            <div key={idx} className="bg-slate-800/40 rounded-xl p-3 lg:p-4 border border-slate-700/50 shadow-inner group hover:border-blue-500/30 transition-colors">
                                <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wider text-slate-500 mb-2 lg:mb-3 group-hover:text-blue-400 transition-colors">Example {idx + 1}:</p>
                                <div className="space-y-2 font-mono text-xs lg:text-sm">
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-slate-500 shrink-0 select-none">Input:</span>
                                        <span className="text-blue-300 break-all">{example.input}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-slate-500 shrink-0 select-none">Output:</span>
                                        <span className="text-emerald-400 break-all">{example.output}</span>
                                    </div>
                                    {example.explanation && (
                                        <div className="pt-2 mt-2 border-t border-slate-700/30">
                                            <p className="text-slate-400 font-sans text-[12px] lg:text-[13px] leading-normal">
                                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest block mb-1">Explanation</span>
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


    const renderCodeEditorToggle = () => (
        <div className="flex bg-slate-950/50 p-1 rounded-lg border border-slate-800/50 mb-4 self-center shrink-0" data-tour="mode-toggle">
            <button
                onClick={() => setShowCodeEditor(false)}
                className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center",
                    !showCodeEditor
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
            >
                <Mic className="w-4 h-4 mr-2" />
                Interview
            </button>
            <button
                onClick={() => {
                    if (isMobileDevice()) {
                        setActiveTab('code'); // Mobile has a code tab — just switch to it
                    } else {
                        setShowCodeEditor(true);
                    }
                }}
                className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center",
                    showCodeEditor
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
            >
                <Code className="w-4 h-4 mr-2" />
                Code Editor
            </button>
        </div>
    );

    const renderInteractionArea = (isMobile = false) => (
        <Card className={cn(
            "bg-slate-900/20 backdrop-blur-md border-slate-800/50 shadow-xl overflow-hidden relative flex flex-col",
            !isMobile ? "flex-1 h-full min-h-0 lg:min-h-[300px]" : "h-auto min-h-[400px] shrink-0"
        )} data-tour="chat-panel">
            <CardContent className="p-0 flex-1 flex flex-col h-full relative">
                <SilentObserverNudge nudge={nudge} onDismiss={() => setNudge(null)} />

                {/* Mobile Text Mode Toggle */}
                {isMobile && hasStarted && !readOnly && !showCodeEditor && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] flex bg-slate-900/80 backdrop-blur-md p-1 rounded-full border border-slate-700/50 shadow-lg">
                        <button
                            onClick={() => setIsMobileTextMode(false)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                !isMobileTextMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            <Mic className="w-3 h-3" /> Voice
                        </button>
                        <button
                            onClick={() => setIsMobileTextMode(true)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                isMobileTextMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            <MessageSquare className="w-3 h-3" /> Text
                        </button>
                    </div>
                )}

                {/* Mode Toggle (when interview started) */}
                {hasStarted && !readOnly && !isMobile && renderCodeEditorToggle()}

                {!hasStarted ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8">
                        <div className="w-full max-w-2xl mb-8">
                            <CompanyModeSelector
                                selectedCompany={selectedCompany}
                                onSelect={handleCompanySelect}
                            />
                        </div>
                        <Button
                            size="lg"
                            className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold h-14 lg:h-16 text-base lg:text-lg shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300"
                            onClick={handleStart}
                            data-tour="begin-button"
                        >
                            Begin Interview Experience
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Voice Interaction Mode */}
                        {!showCodeEditor && !isMobileTextMode && (
                            <div className="flex-1 relative flex flex-col items-center justify-center p-4 lg:p-10 h-full">
                                <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                    <MicPulse
                                        state={
                                            voice.isListening ? 'listening' :
                                                isProcessing ? 'processing' :
                                                    voice.isSpeaking ? 'speaking' :
                                                        'idle'
                                        }
                                    />
                                </div>

                                <div className="relative z-20 flex flex-col items-center gap-6 lg:gap-8 w-full max-w-md mx-auto h-full justify-center">
                                    {/* Top-left Timer Display */}
                                    <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
                                        {/* Timer */}
                                        <div className={cn(
                                            "bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2",
                                            limits.timeRemaining <= 60 ? "border-red-500/50 text-red-400" :
                                                limits.timeRemaining <= 300 ? "border-yellow-500/50 text-yellow-400" :
                                                    "border-slate-700 text-slate-300"
                                        )}>
                                            <Clock className="w-3 h-3" />
                                            <span className="font-mono font-bold">{limits.formattedElapsed}</span>
                                            <span className="text-slate-500">/</span>
                                            <span className="font-mono text-slate-500">20:00</span>
                                        </div>
                                        {/* Guest Trial Badge */}
                                        {isGuest && (
                                            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                                                🌟 Trial Mode ({GUEST_TRIAL_LIMITS.MAX_TURNS - guestTrial.turnsUsed} turns left)
                                            </div>
                                        )}
                                        {/* Turn Warning */}
                                        {limits.shouldShowTurnWarning && !isGuest && (
                                            <div className="bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-lg text-orange-400 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                                                <AlertTriangle className="w-3 h-3" />
                                                {limits.turnsRemaining} turns remaining
                                            </div>
                                        )}
                                        {/* Remaining Questions (authenticated users) */}
                                        {!isGuest && remainingQuestions !== undefined && (
                                            <div className="bg-slate-800/70 border border-slate-700 px-2 py-0.5 rounded text-[9px] text-slate-400">
                                                {remainingQuestions}/{RATE_LIMIT.DAILY_LIMIT} questions remaining today
                                            </div>
                                        )}
                                        {/* Review Mode Badge */}
                                        {isReviewMode && (
                                            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                                                🔄 Review Mode
                                            </div>
                                        )}
                                    </div>
                                    {/* Top-right Status Badge - moved from fixed position */}
                                    <div className="absolute top-2 right-2 z-30">
                                        <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                                            <div className="flex items-center gap-2">
                                                {voice.isSpeaking && (
                                                    <span className="flex items-center gap-1.5 text-purple-400">
                                                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                                                        AI Speaking
                                                    </span>
                                                )}
                                                {voice.isListening && !voice.isSpeaking && (
                                                    <span className="flex items-center gap-1.5 text-blue-400">
                                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                                        Listening
                                                    </span>
                                                )}
                                                {isProcessing && !voice.isSpeaking && (
                                                    <span className="flex items-center gap-1.5 text-yellow-400">
                                                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                                        Processing
                                                    </span>
                                                )}
                                                {!voice.isSpeaking && !voice.isListening && !isProcessing && (
                                                    <span className="flex items-center gap-1.5 text-green-400">
                                                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                                                        Ready
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Indicator */}
                                    <div className="text-center space-y-2 bg-slate-950/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-slate-800/80 shadow-inner">
                                        <p className="text-xs font-bold text-white tracking-wide" data-testid="interview-status-main">
                                            {voice.isListening ? "I'M LISTENING..." :
                                                isProcessing ? "THINKING..." :
                                                    voice.isSpeaking ? "AI IS SPEAKING..." :
                                                        "READY FOR YOU"}
                                        </p>
                                        <div className="flex items-center justify-center gap-2">
                                            <div className={cn(
                                                "w-1 h-1 rounded-full animate-pulse",
                                                voice.isListening ? "bg-blue-500" : "bg-slate-600"
                                            )} />
                                            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black" data-testid="mic-status-indicator">
                                                {voice.isListening ? "Auto-Submit Active" : "Waiting for mic"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Microphone / Interactions */}
                                    {!readOnly && (
                                        <div className="flex justify-center pb-6">
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
                                                className={cn(
                                                    "transition-all duration-300 scale-[1.2] lg:scale-[1.4] shadow-2xl",
                                                    voice.isListening && "ring-4 lg:ring-8 ring-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Read-Only Banner */}
                                    {readOnly && (
                                        <div className="flex justify-center pb-6">
                                            <div className="bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 text-slate-400 text-sm font-medium flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                Session Completed (Read-Only)
                                            </div>
                                        </div>
                                    )}

                                    {/* Stop AI Speaking Button - High Visibility */}
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
                                    <div className="w-full space-y-3 px-1 lg:px-4 flex-1 min-h-0 flex flex-col">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">Live Transcript</label>
                                            {(voice.transcript || voice.interimTranscript) && (
                                                <Badge variant="outline" className="text-[8px] border-emerald-500/30 bg-emerald-500/5 text-emerald-400 h-4">Active</Badge>
                                            )}
                                        </div>
                                        <div className="flex-1 min-h-[100px] bg-slate-950/30 rounded-xl border border-slate-800/40 backdrop-blur-sm overflow-hidden flex flex-col relative" data-testid="transcript-area">
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
                                                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 lg:h-10 text-xs shadow-lg shadow-blue-900/20"
                                                onClick={() => submitUserResponse(voice.transcript, { title: problem.title, content: problem.description })}
                                                disabled={isProcessing}
                                            >
                                                <Send className="w-3 h-3 mr-2" /> Send Message
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Text Interaction Mode (Mobile) */}
                        {!showCodeEditor && isMobileTextMode && (
                            <TextInterviewMode
                                messages={messages}
                                isProcessing={isProcessing}
                                isAISpeaking={voice.isSpeaking}
                                onSendMessage={(content) => submitUserResponse(content, { title: problem.title, content: problem.description, ragContext })}
                                className="flex-1"
                            />
                        )}

                        {/* Code Editor Mode */}
                        {showCodeEditor && (
                            <div className="flex-1 flex flex-col gap-3 p-4 h-full">
                                <CodeEditor
                                    onCodeChange={setUserCode}
                                    defaultLanguage={codeLanguage}
                                    initialCode={userCode}
                                    onLanguageChange={setCodeLanguage}
                                    onExecutionResult={(result) => {
                                        if (result.stdout || result.stderr) {
                                            const execSummary = result.exit_code === 0
                                                ? `Code executed successfully.\nOutput:\n${result.stdout.slice(0, 500)}`
                                                : `Code failed with exit code ${result.exit_code}.\nError:\n${result.stderr.slice(0, 500)}`;
                                            shareCodeWithAI(userCode + '\n\n[Execution Result]\n' + execSummary);
                                        }
                                    }}
                                />
                                <Button
                                    onClick={() => shareCodeWithAI(userCode)}
                                    disabled={!userCode.trim() || isProcessing || voice.isSpeaking}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/20"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Share Code with Kai
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );

    const renderControlsCard = () => (
        <Card className="shrink-0 bg-slate-900/30 backdrop-blur-sm border-slate-800/50 p-2.5 lg:p-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                    <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 capitalize text-[10px] px-2 py-0 h-5">
                        {state.replace('-', ' ')}
                    </Badge>
                </div>
                {(hasStarted || readOnly) && (
                    !readOnly ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFinish}
                            disabled={isAnalyzing}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10"
                        >
                            <Flag className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> End & Analyze
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/dashboard?tab=history')}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700 transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> Back
                        </Button>
                    )
                )}
            </div>
        </Card>
    );

    const renderHistoryArea = (isMobile = false) => (
        <div className={cn("flex flex-col", !isMobile ? "h-full" : "h-auto min-h-[60vh]")}>
            <div className="mb-2 flex justify-between items-center px-1">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Interview History</h2>
                {messages.length > 0 && (
                    <Badge variant="secondary" className="bg-slate-800/50 text-slate-400 text-[9px]">{messages.length} turns</Badge>
                )}
            </div>
            <div className={cn(
                "bg-slate-900/20 backdrop-blur-sm rounded-2xl border border-slate-800/50 shadow-2xl",
                !isMobile ? "flex-1 overflow-hidden min-h-[200px] lg:min-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent" : "h-auto overflow-visible min-h-[200px]"
            )}>
                <ConversationView
                    messages={messages}
                    isAISpeaking={voice.isSpeaking}
                    vadEnabled={vadEnabled && hasStarted}
                    onInterrupt={() => {
                        voice.stopSpeaking();
                        handleInterruption();
                    }}
                    onContinuePreviousResponse={() => {
                        submitUserResponse('Please continue your previous response.', { title: problem.title, content: problem.description, ragContext });
                    }}
                    onVadError={(err) => {
                        console.log('PAGE LOG: InterviewSession received VAD error:', err.message);
                        setError(`VAD Initialization Failed: ${err.message}`);
                    }}
                    onUserSpeaking={() => {
                        if (!voice.isListening && !isProcessing && !voice.isSpeaking) {
                            console.log('🎤 VAD woke up STT (onUserSpeaking)');
                            voice.startListening();
                        }
                    }}
                />
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div
            className="h-full flex flex-col bg-slate-950"
            data-tour="interview-container"
            aria-label="Interview"
            data-testid="interview-panel"
        >
            {isAnalyzing && <AssessmentLoader />}
            {error && (
                error.includes('VAD Initialization Failed') ||
                    error.includes('Voice Activity Detection') ||
                    error.includes('AudioWorklet') ? (
                    // Subtle informational notice for VAD issues
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-800/90 border border-slate-700/50 rounded-full text-xs text-slate-400 flex items-center gap-2 max-w-xs shadow-xl">
                        <svg className="w-3 h-3 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Using standard mic mode</span>
                        <button onClick={() => setError(null)} className="text-slate-500 hover:text-slate-300 ml-1">×</button>
                    </div>
                ) : (
                    // Full red error banner for real errors
                    <ErrorBanner
                        message={error}
                        onClose={() => setError(null)}
                        data-testid={error?.includes('VAD Initialization Failed') ? 'vad-error-banner' : undefined}
                    />
                )
            )}
            {voice.error && !voiceErrorDismissed && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-bounce">
                    <ErrorBanner
                        message={`Mic Problem: ${voice.error}. Try clicking the mic button to restart.`}
                        onClose={() => setVoiceErrorDismissed(true)}
                    />
                </div>
            )}

            {/* Guest Trial Register Modal */}
            <GuestRegisterModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
            />

            {/* Limit Reached Modal */}
            {showLimitModal && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                                <Clock className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white">
                                {limits.isTimeUp ? 'Time&apos;s Up!' : 'Turn Limit Reached'}
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {limits.isTimeUp
                                    ? 'Your 20-minute interview session has ended.'
                                    : 'You\'ve reached the 20-turn limit for this session.'}
                                {' '}Let&apos;s analyze your performance!
                            </p>
                            <Button
                                onClick={() => {
                                    setShowLimitModal(false);
                                    handleFinish();
                                }}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
                            >
                                <Flag className="w-4 h-4 mr-2" />
                                View My Assessment
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Real-time Overlay for Badges */}
            <div className="fixed top-24 right-6 z-[60] flex flex-col gap-4 pointer-events-none">
                <SkillBadge skillId={lastBadgeSkill} points={2} shown={showBadge} />
            </div>

            {hasStarted && <VoiceOnboarding />}


            {/* MOBILE LAYOUT (< 1024px) - Tabbed Interface with FIXED VIEWPORT */}
            <div
                className="lg:hidden fixed top-16 bottom-[72px] left-0 right-0 z-0 bg-slate-950"
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    e.currentTarget.dataset.touchStartX = touch.clientX.toString();
                    e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                }}
                onTouchEnd={(e) => {
                    const touch = e.changedTouches[0];
                    const startX = parseFloat(e.currentTarget.dataset.touchStartX || '0');
                    const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
                    const diffX = touch.clientX - startX;
                    const diffY = touch.clientY - startY;

                    // Only trigger if horizontal swipe is dominant (> 60px) and more horizontal than vertical
                    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                        const tabs = ['problem', 'interview', 'code', 'chat'];
                        const currentIndex = tabs.indexOf(activeTab);

                        if (diffX > 0 && currentIndex > 0) {
                            setActiveTab(tabs[currentIndex - 1]); // Swipe Right -> Previous Tab
                        } else if (diffX < 0 && currentIndex < tabs.length - 1) {
                            setActiveTab(tabs[currentIndex + 1]); // Swipe Left -> Next Tab
                        }
                    }
                }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
                    {/* 
                        FIXED VIEWPORT CONTAINER 
                        Content will scroll INSIDE this box, independent of Navbars.
                        No more overlap. No more massive padding hacks.
                    */}
                    <div className="w-full h-full relative">

                        {/* INTERVIEW TAB */}
                        <TabsContent value="interview" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-3 pb-6 min-h-full">
                                {renderInteractionArea(true)}
                                <div className="mt-4">
                                    {renderControlsCard()}
                                </div>
                            </div>
                        </TabsContent>

                        {/* CODE TAB */}
                        <TabsContent value="code" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-3 pb-6 flex flex-col" style={{ minHeight: 'calc(100dvh - 160px)' }}>
                                <Card className="flex-1 bg-slate-900/30 border-slate-800/50 p-2">
                                    <div className="h-full flex flex-col gap-3">
                                        <CodeEditor
                                            onCodeChange={setUserCode}
                                            defaultLanguage={codeLanguage}
                                            initialCode={userCode}
                                            onLanguageChange={setCodeLanguage}
                                            onExecutionResult={(result) => {
                                                if (result.stdout || result.stderr) {
                                                    const execSummary = result.exit_code === 0
                                                        ? `Code executed successfully.\nOutput:\n${result.stdout.slice(0, 500)}`
                                                        : `Code failed with exit code ${result.exit_code}.\nError:\n${result.stderr.slice(0, 500)}`;
                                                    shareCodeWithAI(userCode + '\n\n[Execution Result]\n' + execSummary);
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={() => shareCodeWithAI(userCode)}
                                            disabled={!userCode.trim() || isProcessing || voice.isSpeaking}
                                            className="bg-green-600 hover:bg-green-500 text-white font-bold"
                                        >
                                            <Send className="w-4 h-4 mr-2" />
                                            Share Code with Kai
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* PROBLEM TAB */}
                        <TabsContent value="problem" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-3 pb-6 min-h-full">
                                {renderProblemCardContent(true)}
                            </div>
                        </TabsContent>

                        {/* CHAT TAB */}
                        <TabsContent value="chat" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-2 pb-6 min-h-full">
                                {renderHistoryArea(true)}
                            </div>
                        </TabsContent>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1.5 ring-1 ring-white/10">
                            <TabsList className="w-full h-12 bg-transparent grid grid-cols-4 gap-1">
                                <TabsTrigger value="problem" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <BookOpen className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Problem</span>
                                </TabsTrigger>
                                <TabsTrigger value="interview" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <Mic className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Interview</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="code"
                                    className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300"
                                >
                                    <Code className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Code</span>
                                </TabsTrigger>
                                <TabsTrigger value="chat" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <MessageSquare className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Chat</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* DESKTOP LAYOUT (>= 1024px) - Draggable Resizable Interface */}
            <div className="hidden lg:flex flex-1 flex-col p-4 overflow-hidden h-[calc(100dvh-64px)]">
                <ResizablePanelGroup
                    direction="horizontal"
                    id="interview_panels_v2"
                    className="h-full rounded-xl border border-slate-800/50 bg-slate-950/30"
                >

                    {/* Left Panel: Problem */}
                    <ResizablePanel defaultSize={24} minSize={18} maxSize={38} id="panel-problem">
                        <div className="flex flex-col gap-4 h-full p-2">
                            <div className="flex-1 min-h-0 overflow-hidden">
                                {renderProblemCardContent()}
                            </div>
                            {renderControlsCard()}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle className="bg-slate-800/50 hover:bg-blue-500/50 transition-colors w-2 min-w-[8px] mx-1 z-50" />

                    {/* Center Panel: Interaction */}
                    <ResizablePanel defaultSize={52} minSize={30} id="panel-interaction">
                        <div className="h-full p-2" data-testid="panel-interaction">
                            {renderInteractionArea()}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle className="bg-slate-800/50 hover:bg-blue-500/50 transition-colors w-2 min-w-[8px] mx-1 z-50" />

                    {/* Right Panel: History */}
                    <ResizablePanel defaultSize={24} minSize={18} maxSize={38} id="panel-history">
                        <div className="h-full p-2">
                            {renderHistoryArea()}
                        </div>
                    </ResizablePanel>

                </ResizablePanelGroup>
            </div>
        </div>
    );
}
