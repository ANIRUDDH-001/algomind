import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useInterview, type Message } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { type CognitiveSkill } from '@/types/assessment';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterviewLimits } from '@/hooks/useInterviewLimits';
import { useGuestSession, GUEST_SESSION_LIMITS } from '@/hooks/useGuestSession';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { RATE_LIMIT } from '@/lib/rate-limit/user-rate-limiter';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { ConversationView } from './ConversationView';
import { InterviewLimitBar } from './InterviewLimitBar';
import { TextInterviewMode } from './TextInterviewMode';
// Voice & Layout
import { GuestModeBanner } from './GuestModeBanner';
import { GuestResultsOverlay } from './GuestResultsOverlay';
import { GuestProblemSelectorModal } from './GuestProblemSelectorModal';
import { GUEST_PROBLEMS } from '@/lib/guest/guest-problems';
import { VoiceOnboarding } from './VoiceOnboarding';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { ZoomTranscript } from '@/components/voice/ZoomTranscript';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare, ArrowLeft, Clock, AlertTriangle, Code, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

// Assessment & Core
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
// ReportCard deprecated — users now redirect to /interview/analysis (A5)
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
import { classifyTurnSignal } from '@/lib/interview/turn-classifier';
import { buildEnrichedTranscript } from '@/lib/interview/transcript-enricher';

import type { InterviewConfig } from '@/lib/interview/interview-config';
import { shouldAdvanceSprint, advanceSprintProblem } from '@/lib/interview/interview-config';
import type { KaiMemoryStructured } from '@/types/kai-memory';
import { getSupabase } from '@/lib/supabase/client';
import { getProblemById } from '@/lib/supabase/problems';
import { GUEST_INTRO_BANNER } from '@/lib/interview/prompts';

interface InterviewSessionProps {
    problem: Problem;
    interviewConfig: InterviewConfig;  // New single source
    isGuest?: boolean;
    isReviewMode?: boolean;
    readOnly?: boolean;
    initialTranscript?: { role: string; content: string }[];

    // Employer assessment
    isAssessment?: boolean;
    assessmentSessionToken?: string;
    assessmentApiEndpoint?: string;
    startTimeOffsetSeconds?: number;
    onAssessmentComplete?: (duration: number, transcript: any[], flags?: string[]) => Promise<void>;
}

const mobileTabs = ['problem', 'interview', 'code', 'history'] as const;
type MobileTab = typeof mobileTabs[number];

export function InterviewSession({
    problem,
    interviewConfig,
    initialTranscript,
    readOnly = false,
    isGuest = false,
    isReviewMode = false,
    isAssessment = false,
    assessmentSessionToken,
    assessmentApiEndpoint,
    startTimeOffsetSeconds,
    onAssessmentComplete
}: InterviewSessionProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // VAD & Observer feature flags (server-side)
    const observerEnabled = useGlobalFeatureFlag('ENABLE_SILENT_OBSERVER', true);

    // --- 1. Basic State ---
    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<CognitiveSkill>('pattern-recognition');
    const [badgeTriggerPhrase, setBadgeTriggerPhrase] = useState<string>('Signal detected');
    const [firedDimensions] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('python');
    const [voiceErrorDismissed, setVoiceErrorDismissed] = useState(false);

    // Desktop Layout State
    const [showProblemPanel, setShowProblemPanel] = useState(true);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);

    // --- 2. Supporting Hooks ---
    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const limits = useInterviewLimits(interviewConfig);
    const guestSession = useGuestSession(isGuest);
    const { incrementTurn } = limits;
    const { recordUserTurn, recordAITurn, isTrialComplete, showLoginPrompt } = guestSession;

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

    // Handle screen resize fallback properly
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            if (activeTab === 'code' && !showCodeEditor) setShowCodeEditor(true);
            if (activeTab !== 'code' && showCodeEditor) setShowCodeEditor(false);
        }
    }, [activeTab, showCodeEditor]);

    const [sprintTransitionMsg, setSprintTransitionMsg] = useState<string | null>(null);
    const [sprintProblem2, setSprintProblem2] = useState<Problem | null>(null);
    const [sprintCurrentIndex, setSprintCurrentIndex] = useState<0 | 1>(0);

    // Sprint: fetch problem 2 upfront so it's ready when problem 1 ends
    useEffect(() => {
        const p2Id = interviewConfig.sprint?.problemIds?.[1];
        if (!p2Id || sprintProblem2) return;
        getProblemById(p2Id).then(p => { if (p) setSprintProblem2(p); }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewConfig.sprint?.problemIds]);

    // Sprint: show limit modal when half-time reached on problem 1
    useEffect(() => {
        if (
            !hasStarted ||
            readOnly ||
            interviewConfig.difficultyMode !== 'sprint' ||
            sprintCurrentIndex !== 0 ||
            !(limits.isHalfTime || limits.isTurnsUp) ||
            !sprintProblem2
        ) return;

        setShowLimitModal(true);
        voice.stopListening();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasStarted, readOnly, limits.isHalfTime, limits.isTurnsUp, sprintCurrentIndex, sprintProblem2]);

    // Guest mode: problem selector + result overlay
    const [showGuestSelector, setShowGuestSelector] = useState<boolean>(isGuest);
    const [activeProblem, setActiveProblem] = useState(problem);
    const [guestDurationSecs, setGuestDurationSecs] = useState(0);



    const handleGuestProblemSelect = useCallback((selected: typeof GUEST_PROBLEMS[number]) => {
        setActiveProblem(selected);
        setShowGuestSelector(false);
        // Clear any existing session data so the new problem starts fresh
        try {
            sessionStorage.removeItem('algomind_guest_trial');
            sessionStorage.removeItem('algomind_guest_session_user');
            sessionStorage.removeItem('algomind_guest_session_ai');
        } catch { /* ignore */ }
    }, []);

    const [voicePrefs, setVoicePrefs] = useState<{
        name: string | null;
        rate: number;
        pitch: number;
    }>({ name: null, rate: 1.0, pitch: 1.0 });

    useEffect(() => {
        if (!user || isGuest) return;
        const supabase = getSupabase();
        if (!supabase) return;
        supabase
            .from('user_preferences')
            .select('preferred_voice_name, voice_rate, voice_pitch')
            .eq('user_id', user.id)
            .single()
            .then((res: any) => {
                const data = res.data;
                if (data) {
                    setVoicePrefs({
                        name: data.preferred_voice_name ?? null,
                        rate: Number(data.voice_rate ?? 1.0),
                        pitch: Number(data.voice_pitch ?? 1.0),
                    });
                }
            });
    }, [user, isGuest]);

    // --- Silent Observer ---
    const observerRef = useRef(new SilentObserver());
    const [nudge, setNudge] = useState<string | null>(null);

    // --- 3. Interview Logic & Callbacks ---
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
        // Badge detection moved to Silent Observer
    }, [isGuest, hasStarted, recordUserTurn, isTrialComplete, showLoginModal, incrementTurn]);

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
        limitReason,
        micStoppedManually,
        sendCountdown,
        ttsError,
        isPushToTalk,
        enterCodingMode,
        exitCodingMode,
        shareCode,
    } = useInterview({
        config: interviewConfig,
        isTimeUp: limits.isTimeUp,
        turnsRemaining: limits.turnsRemaining,
        timeRemaining: limits.timeRemaining,
        voicePrefs,
        isReviewMode,
        apiEndpoint: isAssessment ? assessmentApiEndpoint : undefined,
        sessionToken: isAssessment ? assessmentSessionToken : undefined,
        onUserMessage: handleUserMessage,
        isGuest: isGuest,
    });

    // A3: Signal coding state changes when code editor visibility changes
    const prevShowCodeEditorRef = useRef(showCodeEditor);
    useEffect(() => {
        if (showCodeEditor && !prevShowCodeEditorRef.current && hasStarted) {
            enterCodingMode();
        } else if (!showCodeEditor && prevShowCodeEditorRef.current && hasStarted) {
            exitCodingMode();
        }
        prevShowCodeEditorRef.current = showCodeEditor;
    }, [showCodeEditor, hasStarted, enterCodingMode, exitCodingMode]);

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
        if (!observerEnabled || !hasStarted || readOnly || isAssessment) return;
        if (state === 'completed' || state === 'idle' || isAnalyzing) return;

        // Run observer more frequently (e.g. every 15s) since it handles its own cooldowns now,
        // and needs to catch badges close to when the user spoke.
        const interval = setInterval(async () => {
            const currentMessages = messagesRef.current;
            const currentElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const result = await observerRef.current.analyze({
                recentTurns: currentMessages.slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                interviewState: state as InterviewState,
                elapsedSeconds: currentElapsed,
                problemTitle: activeProblem.title,
            });

            if (result.nudgeText) {
                setNudge(result.nudgeText);
            }

            if (result.badgeSignal && !showBadge && !firedDimensions.has(result.badgeSignal.dimension)) {
                firedDimensions.add(result.badgeSignal.dimension);
                setLastBadgeSkill(result.badgeSignal.dimension);
                setBadgeTriggerPhrase(result.badgeSignal.triggerPhrase);
                setShowBadge(true);
            }
        }, 15_000);

        return () => clearInterval(interval);
    }, [hasStarted, readOnly, observerEnabled, state, isAnalyzing, isAssessment, activeProblem.title, showBadge, firedDimensions]);

    useEffect(() => {
        setHasStarted(false);
        setError(null);
        resetInterview();
        transcriptLoadedRef.current = false;
        guestSession.reset();
        observerRef.current.reset();
        setNudge(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProblem.id]);

    // Guest session cleanup — clear all ephemeral data when component unmounts
    useEffect(() => {
        if (!isGuest) return;

        return () => {
            try {
                sessionStorage.removeItem('algomind_guest_trial');
                sessionStorage.removeItem('algomind_guest_session_user');
                sessionStorage.removeItem('algomind_guest_session_ai');
                sessionStorage.removeItem('algomind_guest_banner_dismissed');
                // Clear the demo cookie so navigating to /interview again
                // without ?demo=true doesn't stay in guest mode
                document.cookie = 'algomind_demo_mode=; path=/; max-age=0; SameSite=Lax';
            } catch {
                // Ignore — cleanup is best-effort
            }
        };
    }, [isGuest]);

    const { isSpeaking, isListening, stopListening } = voice;
    useEffect(() => {
        if (isSpeaking && isListening) {
            stopListening();
        }
    }, [isSpeaking, isListening, stopListening]);

    // Phase 5b: Auto-detect mic failure → promote text input
    // Only show after 45s of continuous listening with zero transcript (real failure)
    useEffect(() => {
        if (!voice.isListening || voice.transcript || voice.interimTranscript) return;

        const timer = setTimeout(() => {
            if (voice.isListening && !voice.transcript && !voice.interimTranscript) {
                toast('Mic may not be working — tap the keyboard icon below to type instead', {
                    icon: '⌨️',
                    duration: 5000,
                });
            }
        }, 45_000);

        return () => clearTimeout(timer);
    }, [voice.isListening, voice.transcript, voice.interimTranscript]);

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

    const handleStart = async () => {
        // Phase 5a: Pre-interview microphone permission check
        try {
            const perm = await navigator.permissions.query({
                name: 'microphone' as PermissionName
            });
            if (perm.state === 'denied') {
                setError(
                    'Microphone access is blocked. ' +
                    'Please enable it in your browser settings to use voice features.'
                );
                return; // Can't proceed without mic in voice-only mode
            }
            if (perm.state === 'prompt') {
                // Trigger permission request before starting interview
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop()); // Release immediately
            }
        } catch {
            // permissions API not available — proceed, mic will prompt on use
        }

        setHasStarted(true);
        startTimeRef.current = Date.now();
        limits.startTimer();
        startInterview({
            problemTitle: activeProblem.title,
            problemContent: activeProblem.description,
            ragContext: interviewConfig.ragContext,
            kaiMemory: interviewConfig.kaiMemory,
            problemId: activeProblem.id,
            difficultyMode: isGuest ? 'practice' : interviewConfig.difficultyMode,
            difficulty: activeProblem.difficulty,
            kaiMemoryStructured: interviewConfig.kaiMemoryStructured ?? undefined,
            language: (activeProblem as any).language,
            optimalApproach: (activeProblem as any).solution ?? undefined,
        });
    };



    const shareCodeWithAI = useCallback((code: string) => {
        if (!code.trim()) return;
        const codeMessage = `Here's my code solution:\n\n\`\`\`${codeLanguage}\n${code}\n\`\`\``;
        submitUserResponse(codeMessage, { title: activeProblem.title, content: activeProblem.description });
        shareCode(code); // A3: transition state machine back to ai-feedback
        setShowCodeEditor(false);
        setActiveTab('interview');
    }, [codeLanguage, activeProblem, submitUserResponse, shareCode]);

    const isSavingRef = useRef(false);

    const handleSprintAdvance = useCallback(() => {
        if (!sprintProblem2) return;
        setShowLimitModal(false);
        setSprintCurrentIndex(1);
        setSprintTransitionMsg('Starting Problem 2...');

        const advancedConfig = advanceSprintProblem(interviewConfig, (sprintProblem2 as any).ragContext ?? '');

        setTimeout(() => {
            setSprintTransitionMsg(null);
            (limits as any).resetTurns?.();
            limits.startTimer?.();
            startInterview({
                problemTitle: sprintProblem2.title,
                problemContent: sprintProblem2.description ?? (sprintProblem2 as any).content,
                difficulty: sprintProblem2.difficulty,
                difficultyMode: 'sprint',
                ragContext: advancedConfig.ragContext,
                kaiMemory: interviewConfig.kaiMemory,
                kaiMemoryStructured: interviewConfig.kaiMemoryStructured ?? undefined,
                language: (activeProblem as any).language,
                optimalApproach: (sprintProblem2 as any).solution ?? undefined,
                sprintProblemIndex: 1,
                secondProblem: {
                    title: sprintProblem2.title,
                    content: (sprintProblem2 as any).content ?? sprintProblem2.description,
                    description: sprintProblem2.description,
                    difficulty: sprintProblem2.difficulty,
                },
            });
        }, 1500);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sprintProblem2, interviewConfig, limits, startInterview, activeProblem]);

    const handleFinish = async () => {
        if (isSavingRef.current) return; // Prevent double-click save
        if (messages.length < 2) {
            setError("Please interact with the AI at least once before ending the session to get a valid analysis.");
            return;
        }
        isSavingRef.current = true;
        setError(null);
        try {
            const baseTranscript = messages.map(m => ({ role: m.role, content: m.content }));
            const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000) + (startTimeOffsetSeconds || 0);

            const enrichedTranscript = buildEnrichedTranscript(
                baseTranscript,
                userCode,
                codeLanguage,
                activeProblem.title
            );

            // Detect Integrity Flags
            const flags: string[] = [];
            if (durationSecs < 120) flags.push('fast_solution');

            const userMessages = baseTranscript.filter(m => m.role === 'user');
            const hasMeaningfulTalk = userMessages.some(m => m.content.split(/\s+/).length > 10);
            if (!hasMeaningfulTalk && userCode.trim().length > 50) {
                flags.push('no_verbal_discussion');
            }

            if (isAssessment && onAssessmentComplete) {
                try {
                    await onAssessmentComplete(
                        durationSecs,
                        enrichedTranscript.map(m => ({ speaker: m.role === 'assistant' ? 'ai' : 'user', text: m.content })),
                        flags
                    );
                } catch (err: unknown) {
                    console.error("❌ Assessment error:", err);
                    setError(err instanceof Error ? err.message : "Failed to submit assessment.");
                }
            } else {
                try {
                    const assessment = await analyzeSession(
                        `sess-${Date.now()}`,
                        { title: activeProblem.title, description: activeProblem.description || '', difficulty: activeProblem.difficulty, difficultyMode: interviewConfig.difficultyMode },
                        enrichedTranscript
                    );
                    if (!assessment) {
                        setError("Assessment failed. Please try again or check the console for details.");
                        return;
                    }

                    // Capture duration for guest results overlay
                    if (isGuest) {
                        const elapsed = startTimeRef.current
                            ? Math.floor((Date.now() - startTimeRef.current) / 1000)
                            : 0;
                        setGuestDurationSecs(elapsed);
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
                                user.id, activeProblem.id, activeProblem.title, fullTranscript, duration, assessment,
                                { difficultyMode: interviewConfig.difficultyMode }
                            );
                            if (!success) {
                                console.error('Failed to save session:', saveError);
                                toast.error('Session analyzed but could not be saved to history.');
                            } else if (sessionId) {
                                // A5: Auto-navigate to analysis page
                                router.push(`/interview/analysis?sessionId=${sessionId}`);
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
            // Sprint problem 1 half-time is handled by the sprint advancement effect above
            const isSprintP1 =
                interviewConfig.difficultyMode === 'sprint' &&
                sprintCurrentIndex === 0 &&
                sprintProblem2 !== null;

            if (isSprintP1) {
                // Sprint P1: show modal for "Continue to Problem 2"
                setShowLimitModal(true);
                voice.stopListening();
            } else {
                // All other modes: immediately auto-submit, no modal
                voice.stopListening();
                if (!isSavingRef.current && !limitAutoFinishRef.current) {
                    limitAutoFinishRef.current = true;
                    setIsAutoSubmitting(true);
                    endInterview();
                    handleFinish();
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasStarted, readOnly, limits.isTimeUp, limits.isHalfTime, limits.isTurnsUp]);

    // Auto-finish ref to prevent double triggers
    const limitAutoFinishRef = useRef(false);

    // A5: Derived flag — all interactive inputs are locked after limit
    const isLimitLocked = isAutoSubmitting || showLimitModal || (hasStarted && !readOnly && (limits.isTimeUp || limits.isTurnsUp));

    useEffect(() => {
        if (showBadge) {
            const timer = setTimeout(() => setShowBadge(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [showBadge]);

    if (result) {
        if (isGuest) {
            return (
                <GuestResultsOverlay
                    assessment={result}
                    durationSecs={guestDurationSecs}
                    roundCount={roundCount}
                    problemTitle={activeProblem.title}
                    onTryAnother={() => {
                        resetAssessment();
                        setShowGuestSelector(true);
                        setActiveProblem(problem); // reset to original prop
                    }}
                    onSignUp={() => { window.location.href = '/login'; }}
                    onClose={resetAssessment}
                />
            );
        }
        // A5: Logged-in users get redirected to /interview/analysis after save (line ~519).
        // This fallback shows briefly while the redirect is pending, or if save failed.
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Loading your analysis...</p>
                <button
                    onClick={resetAssessment}
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-2"
                >
                    Return to interview
                </button>
            </div>
        );
    }

    // --- Sub-components (Visual Rendering) --- //

    const renderProblemCardContent = () => {
        const leetcodeUrl = activeProblem.external_url || `https://leetcode.com/problemset/all/?search=${encodeURIComponent(activeProblem.title)}`;

        return (
            <Card className="h-full flex flex-col shadow-2xl border-none bg-transparent" data-tour="problem-panel">
                <CardHeader className="bg-black/20 rounded-2xl border py-3 shrink-0 mb-4" style={{ borderColor: 'var(--surface-edge)' }}>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-sm font-bold text-white whitespace-normal break-words flex-1">
                                {activeProblem.title}
                            </CardTitle>
                            <Badge className={cn(
                                "text-[10px] px-2 py-0 h-5 shrink-0 border mt-0.5",
                                activeProblem.difficulty === 'easy' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                                activeProblem.difficulty === 'medium' && 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                                activeProblem.difficulty === 'hard' && 'bg-red-500/15 text-red-400 border-red-500/25'
                            )}>
                                {activeProblem.difficulty}
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
                    <div className="whitespace-pre-wrap font-medium">{activeProblem.description}</div>
                    <div className="space-y-3 lg:space-y-4 pt-2">
                        {activeProblem.examples && activeProblem.examples.map((example, idx) => (
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
                                                maxMs={interviewConfig.maxDurationMs}
                                                roundCount={roundCount}
                                                maxRounds={interviewConfig.maxTurnsPerProblem}
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
                                                <span className="font-mono text-zinc-500">
                                                    {limits.formattedTotal}
                                                </span>
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
                                        {isReviewMode && (
                                            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                                                🔄 Review Mode
                                            </div>
                                        )}
                                    </div>
                                    {/* Spacer when no messages yet */}
                                    {messages.length === 0 && <div className="flex-1 min-h-0" />}

                                    {/* Microphone / Interactions */}
                                    {!readOnly && !isLimitLocked && (
                                        <div className="flex flex-col items-center justify-center pb-6 gap-3">
                                            <div className="flex items-center justify-center gap-4 relative">
                                                <MicrophoneButton
                                                    isListening={voice.isListening}
                                                    error={voice.error?.message}
                                                    onClick={() => {
                                                        if (voice.isSpeaking) {
                                                            // Interrupt AI speech — mic will auto-activate after
                                                            voice.stopSpeaking();
                                                            handleInterruption();
                                                            return;
                                                        }
                                                        if (voice.isListening) {
                                                            voice.stopListening();
                                                        } else if (!isProcessing) {
                                                            voice.startListening();
                                                        }
                                                    }}
                                                    onRetry={() => {
                                                        setVoiceErrorDismissed(false);
                                                        voice.startListening();
                                                    }}
                                                    disabled={isProcessing}
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
                                    <div className="w-full space-y-2 px-1 flex-none flex flex-col min-h-45 h-[35vh] max-h-70 mb-4">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">Live Transcript</label>
                                            {(voice.transcript || voice.interimTranscript) && (
                                                <Badge variant="outline" className="text-[8px] border-emerald-500/30 bg-emerald-500/5 text-emerald-400 h-4">Active</Badge>
                                            )}
                                        </div>
                                        <div className="flex-1 bg-zinc-900/40 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden flex flex-col relative" data-testid="transcript-area">
                                            <div className="absolute inset-0 p-1">
                                                <ZoomTranscript
                                                    lastAiMessage={[...messages].reverse().find(m => m.role === 'assistant')?.content}
                                                    isSpeaking={voice.isSpeaking}
                                                    isProcessing={isProcessing}
                                                    transcript={voice.transcript}
                                                    interimTranscript={voice.interimTranscript}
                                                    isListening={voice.isListening}
                                                    micStoppedManually={micStoppedManually}
                                                    isPushToTalk={isPushToTalk}
                                                    isTranscribing={voice.isTranscribing}
                                                />
                                            </div>
                                        </div>

                                        {/* TTS error banner */}
                                        {ttsError && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-400 text-[10px] font-bold flex items-center gap-1.5">
                                                <AlertTriangle className="w-3 h-3" />
                                                Voice playback failed. AI response is shown in chat history.
                                            </div>
                                        )}

                                        {/* Send button: shown when mic is manually stopped AND there is content (or Whisper is in-flight) */}
                                        {micStoppedManually && (voice.transcript || voice.isTranscribing) && (
                                            <Button
                                                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 text-xs shadow-lg shadow-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                onClick={() => {
                                                    const content = voice.transcript;
                                                    if (content) {
                                                        submitUserResponse(content, { title: activeProblem.title, content: activeProblem.description });
                                                    }
                                                }}
                                                disabled={isProcessing || voice.isTranscribing}
                                                title="Send your response"
                                            >
                                                <Send className="w-3 h-3 mr-2" />
                                                {voice.isTranscribing ? 'Transcribing…' : sendCountdown !== null ? `Sending in ${sendCountdown}s…` : 'Send Message'}
                                            </Button>
                                        )}

                                        {/* ✅ FIX: End Interview button visible in interview tab on mobile */}
                                        {isMobile && hasStarted && !readOnly && (
                                            <div className="w-full mt-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => { endInterview(); handleFinish(); }}
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
                            onClick={() => { endInterview(); handleFinish(); }}
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
                {/* Guest Mode Banner — shown after interview starts, guides user */}
                {isGuest && hasStarted && !isAssessment && (
                    <GuestModeBanner
                        turnsUsed={guestSession.userTurns}
                        timeRemaining={limits.timeRemaining}
                        onSignUp={() => { window.location.href = '/login'; }}
                    />
                )}
                <ConversationView
                    messages={messages}
                    isAISpeaking={voice.isSpeaking}
                    isProcessing={isProcessing}
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

            {showLimitModal && (() => {
                // Only sprint P1 uses the modal now ("Continue to Problem 2")
                const isSprintP1 = interviewConfig.difficultyMode === 'sprint' && sprintCurrentIndex === 0 && sprintProblem2 !== null;
                if (!isSprintP1) return null;
                return (
                    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                                    <Clock className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Problem 1 Complete!</h3>
                                <p className="text-zinc-400 text-sm">Great work! Ready for Problem 2?</p>
                                <Button onClick={handleSprintAdvance} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold">
                                    Continue to Problem 2 <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Auto-submit overlay — shown when time/turn limit triggers immediate submission */}
            {isAutoSubmitting && (
                <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <h3 className="text-xl font-bold text-white">Submitting your interview...</h3>
                        <p className="text-zinc-400 text-sm">Analyzing your performance. You&#39;ll be redirected shortly.</p>
                    </div>
                </div>
            )}

            <div className="fixed top-24 right-6 z-[60] flex flex-col gap-4 pointer-events-none">
                <SkillBadge skillId={lastBadgeSkill} triggerPhrase={badgeTriggerPhrase} shown={showBadge} />
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

            {/* Guest Problem Selector — shown before interview starts */}
            {isGuest && (
                <GuestProblemSelectorModal
                    isOpen={showGuestSelector}
                    onSelect={handleGuestProblemSelect}
                />
            )}

            {sprintTransitionMsg && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-slate-800 border border-emerald-500/50 rounded-2xl p-8 text-center max-w-sm mx-4">
                        <div className="text-5xl mb-4">⚡</div>
                        <h2 className="text-xl font-bold text-white mb-2">Sprint Progress</h2>
                        <p className="text-emerald-400 text-lg font-medium">{sprintTransitionMsg}</p>
                        <p className="text-slate-400 text-sm mt-3">Problem 1 of 2 complete · Timer continues</p>
                    </div>
                </div>
            )}
        </div>
    );
}