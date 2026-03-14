import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useInterview, type Message } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { type CognitiveSkill } from '@/types/assessment';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterviewLimits } from '@/hooks/useInterviewLimits';
import { useGuestSession, GUEST_SESSION_LIMITS } from '@/hooks/useGuestSession';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { ConversationView } from './ConversationView';
import { InterviewLimitBar } from './InterviewLimitBar';
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
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare, ArrowLeft, Clock, AlertTriangle, Code, ChevronRight, Code2, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, useResizablePanelGroup } from '@/components/ui/resizable';
import { InterviewTopBar } from './InterviewTopBar';

// Assessment & Core
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
// ReportCard deprecated — users now redirect to /interview/analysis (A5)
import { SkillBadge } from '@/components/assessment/SkillBadge';

// Tools & Helpers
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Problem } from '@/lib/supabase/problems';
import { CodeEditor } from './CodeEditor';
import type { ExecutionResult } from './CodeEditor';
import { TestCasePanel, buildKaiExecutionContext, matchResults } from './TestCasePanel';
import type { TestCase, TestCaseResult } from './TestCasePanel';
import { saveInterviewSession } from '@/app/actions/save-session';
import { toast } from 'sonner';
import { GuestRegisterModal } from './GuestRegisterModal';
import { StreakMilestoneModal } from '../dashboard/StreakMilestoneModal';

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
// (GUEST_INTRO_BANNER import removed — was unused)

interface InterviewSessionProps {
    problem: Problem;
    interviewConfig: InterviewConfig;  // New single source
    isGuest?: boolean;
    isReviewMode?: boolean;
    readOnly?: boolean;
    initialTranscript?: { role: string; content: string }[];
    userTtsProvider?: 'auto' | 'polly' | 'browser';

    // Employer assessment
    isAssessment?: boolean;
    assessmentSessionToken?: string;
    assessmentApiEndpoint?: string;
    startTimeOffsetSeconds?: number;
    onAssessmentComplete?: (duration: number, transcript: any[], flags?: string[]) => Promise<void>;
    // Campaign Overrides
    apiEndpoint?: string;
    sessionToken?: string;
    onCampaignQuestionEnd?: (transcript: any[], code: string, elapsedSecs: number) => void;
    onCampaignSaveProgress?: (transcript: any[], code: string, elapsedSecs: number) => void;
    campaignTimeLeftSecs?: number;
}

const mobileTabs = ['problem', 'interview', 'code', 'history'] as const;
type MobileTab = typeof mobileTabs[number];

/**
 * Invisible controller rendered inside ResizablePanelGroup.
 * Calls setPanelSize programmatically when isProblemCollapsed changes,
 * so the problem panel actually resizes without remounting (no ghost IDs).
 */
function ThreePanelCollapseController({ isProblemCollapsed }: { isProblemCollapsed: boolean }) {
    const { setPanelSize } = useResizablePanelGroup();
    const isFirstRender = React.useRef(true);

    React.useEffect(() => {
        // Skip the very first render — let defaultSize initialise sizes normally
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (isProblemCollapsed) {
            // Collapse to 3% (48px at typical viewport widths)
            setPanelSize('problem-panel', 3);
        } else {
            // Expand back to 25%
            setPanelSize('problem-panel', 25);
        }
    }, [isProblemCollapsed, setPanelSize]);

    return null;
}

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
    onAssessmentComplete,
    apiEndpoint,
    sessionToken,
    onCampaignQuestionEnd,
    onCampaignSaveProgress,
    campaignTimeLeftSecs,
    userTtsProvider
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
    const [userCode, setUserCode] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('python');
    const [voiceErrorDismissed, setVoiceErrorDismissed] = useState(false);

    const [lastExecResult, setLastExecResult] = useState<ExecutionResult | null>(null);
    const [isExecRunning, setIsExecRunning] = useState(false);

    // Desktop Layout State
    const [isProblemCollapsed, setIsProblemCollapsed] = useState(false);
    const [streakMilestone, setStreakMilestone] = useState<{days: number; isRecord: boolean; onDismiss?: () => void} | null>(null);

    // --- 2. Supporting Hooks ---
    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const limits = useInterviewLimits(interviewConfig);
    const guestSession = useGuestSession(isGuest);
    const { incrementTurn } = limits;
    const { recordUserTurn, recordAITurn, isTrialComplete, showLoginPrompt } = guestSession;

    // Mobile Swipe Navigation State
    const [activeTab, setActiveTab] = useState<MobileTab>('interview');
    const { handlers: swipeHandlers, currentIndex, dragOffset } = useSwipeNavigation({
        tabs: mobileTabs,
        activeTab: activeTab,
        onTabChange: (tab) => setActiveTab(tab as MobileTab),
        disabled: showLimitModal || showLoginModal || isAssessment && activeTab === 'problem', // Optional conditional disablings
    });



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

    const testCases: TestCase[] = useMemo(() => {
        const examples = (activeProblem as any)?.examples;
        if (!examples || !Array.isArray(examples)) return [];
        return examples.map((ex: any) => ({
            input: String(ex.input ?? ''),
            expected: String(ex.output ?? ''),
            explanation: ex.explanation ? String(ex.explanation) : undefined,
        }));
    }, [activeProblem]);

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
        voicePrefs: { name: voicePrefs.name, rate: voicePrefs.rate, pitch: voicePrefs.pitch },
        isReviewMode,
        apiEndpoint: apiEndpoint || (isAssessment ? assessmentApiEndpoint : undefined),
        sessionToken: sessionToken || (isAssessment ? assessmentSessionToken : undefined),
        onUserMessage: handleUserMessage,
        isGuest: isGuest,
        userTtsProvider,
    });

    // A3: Signal coding state changes when user edits code via keystrokes
    const lastKeystrokeRef = useRef<number>(0);
    const codingModeActiveRef = useRef(false);
    const CODING_IDLE_TIMEOUT_MS = 8000;

    const handleCodeKeyDown = useCallback(() => {
        lastKeystrokeRef.current = Date.now();
        if (!codingModeActiveRef.current && hasStarted) {
            codingModeActiveRef.current = true;
            enterCodingMode();
        }
    }, [hasStarted, enterCodingMode]);

    useEffect(() => {
        if (!hasStarted) return;
        const interval = setInterval(() => {
            if (codingModeActiveRef.current && Date.now() - lastKeystrokeRef.current > CODING_IDLE_TIMEOUT_MS) {
                codingModeActiveRef.current = false;
                exitCodingMode();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [hasStarted, exitCodingMode]);

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
        setLastExecResult(null);
        setIsExecRunning(false);
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
            title: activeProblem.title,
            content: activeProblem.description,
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
            limits.startTimer();
            startInterview({
                title: sprintProblem2.title,
                content: sprintProblem2.description ?? (sprintProblem2 as any).content,
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
         
    }, [sprintProblem2, interviewConfig, limits, startInterview, activeProblem]);

    // A5: Consolidated completion logic
    const handleFinish = async () => {
        if (isSavingRef.current) return; // Prevent double-click save

        // 1. Calculate final state
        const finalTranscript = messages.map(m => ({
            speaker: m.role === 'assistant' ? 'ai' : m.role,
            text: m.content,
            timestamp: m.timestamp
        }));

        // 2. If in campaign mode, delegate to onComplete callback
        if (onCampaignQuestionEnd) {
            const elapsed = interviewStartTime ? Math.floor((Date.now() - interviewStartTime) / 1000) : 0;
            onCampaignQuestionEnd(finalTranscript, userCode, elapsed);
            return;
        }

        if (messages.length < 2) {
            setError("Please interact with the AI at least once before ending the session to get a valid analysis.");
            return;
        }
        isSavingRef.current = true;
        setError(null);

        try {
            const durationSecsValue = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000) + (startTimeOffsetSeconds || 0);

            const enrichedTranscript = buildEnrichedTranscript(
                messages,
                userCode,
                codeLanguage,
                activeProblem.title
            );

            // Detect Integrity Flags
            const flags: string[] = [];
            if (durationSecsValue < 120) flags.push('fast_solution');

            const userMessages = messages.filter(m => m.role === 'user');
            const hasMeaningfulTalk = userMessages.some(m => m.content.split(/\s+/).length > 10);
            if (!hasMeaningfulTalk && userCode.trim().length > 50) {
                flags.push('no_verbal_discussion');
            }

            if (isAssessment && onAssessmentComplete) {
                try {
                    await onAssessmentComplete(
                        durationSecsValue,
                        enrichedTranscript.map(m => ({ speaker: m.role === 'assistant' ? 'ai' : 'user', text: m.content })),
                        flags
                    );
                } catch (err: unknown) {
                    console.error("❌ Assessment error:", err);
                    voice.setVadEnabled(true);
                    setError(err instanceof Error ? err.message : "Failed to submit assessment.");
                }
            } else {
                try {
                    // BUG-C3 fix: Capture actual duration for result display
                    const interviewDuration = startTimeRef.current
                        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
                        : 0;

                    const assessment = await analyzeSession(
                        `sess-${Date.now()}`,
                        { 
                            title: activeProblem.title, 
                            description: activeProblem.description || '', 
                            difficulty: activeProblem.difficulty, 
                            difficultyMode: interviewConfig.difficultyMode 
                        },
                        enrichedTranscript
                    );
                    if (!assessment) {
                        setError("Assessment failed. Please try again or check the console for details.");
                        return;
                    }

                    if (isGuest) {
                        setGuestDurationSecs(interviewDuration);
                    }

                    if (user && !isGuest) {
                        try {
                            const { success, error: saveError, sessionId, streakDays, isNewStreakRecord } = await saveInterviewSession(
                                user.id, activeProblem.id, activeProblem.title, messages, interviewDuration, assessment,
                                { difficultyMode: interviewConfig.difficultyMode }
                            );
                            if (!success) {
                                console.error('Failed to save session:', saveError);
                                toast.error('Session analyzed but could not be saved to history.');
                            } else if (sessionId) {
                                const targetUrl = `/interview/analysis?sessionId=${sessionId}`;
                                if (streakDays && [3, 7, 14, 30, 50, 100].includes(streakDays)) {
                                    setStreakMilestone({ 
                                        days: streakDays, 
                                        isRecord: Boolean(isNewStreakRecord),
                                        onDismiss: () => router.push(targetUrl)
                                    });
                                } else {
                                    router.push(targetUrl);
                                }
                            }
                        } catch (saveErr) {
                            console.error('Save exception:', saveErr);
                        }
                    }
                } catch (err: unknown) {
                    console.error("❌ Analysis error:", err);
                    voice.setVadEnabled(true);
                    setError(err instanceof Error ? err.message : "Failed to analyze interview. Please try again.");
                }
            }
            limits.stopTimer();
        } finally {
            isSavingRef.current = false;
        }
    };

    // Auto-finish ref to prevent double triggers (BUG-H4: declared before usage)
    const limitAutoFinishRef = useRef(false);

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
                    // BUG-C4 fix: endInterview() is a state dispatch; handleFinish reads
                    // messages immediately, so sequence them properly
                    endInterview();
                    handleFinish();
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasStarted, readOnly, limits.isTimeUp, limits.isHalfTime, limits.isTurnsUp]);

    // A5.2: Periodic Save (Practice only, or Campaign if callback provided)
    useEffect(() => {
        if (!hasStarted || readOnly || !interviewStartTime) return;
        
        const interval = setInterval(() => {
            const finalTranscript = messages.map(m => ({
                speaker: m.role === 'assistant' ? 'ai' : m.role,
                text: m.content
            }));
            const elapsed = Math.floor((Date.now() - interviewStartTime) / 1000);

            if (onCampaignSaveProgress) {
                onCampaignSaveProgress(finalTranscript, userCode, elapsed);
            }
        }, 30000); // 30s auto-save

        return () => clearInterval(interval);
    }, [hasStarted, readOnly, messages, userCode, onCampaignSaveProgress, interviewStartTime]);
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
        // A5: Logged-in users get redirected to /interview/analysis after save (handled in handleFinish).
        // This fallback shows briefly while the redirect is pending.
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

    // Safety helper: Supabase JSON columns may return objects (e.g. {k, nums})
    // instead of strings. Render them safely to avoid React error #31.
    const safeRender = (v: unknown): string =>
        v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

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
                    <div className="whitespace-pre-wrap font-medium">{safeRender(activeProblem.description)}</div>
                    <div className="space-y-3 lg:space-y-4 pt-2">
                        {activeProblem.examples && activeProblem.examples.map((example, idx) => (
                            <div key={idx} className="rounded-xl p-3 lg:p-4 border shadow-inner group transition-colors" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-edge)' }}>
                                <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wider text-zinc-500 mb-2 lg:mb-3 group-hover:text-indigo-400 transition-colors">Example {idx + 1}:</p>
                                <div className="space-y-2 font-mono text-xs lg:text-sm">
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0 select-none">Input:</span>
                                        <span className="text-indigo-300 break-all">{safeRender(example.input)}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0 select-none">Output:</span>
                                        <span className="text-emerald-400 break-all">{safeRender(example.output)}</span>
                                    </div>
                                    {example.explanation && (
                                        <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                                            <p className="text-zinc-400 font-sans text-[12px] lg:text-[13px] leading-normal">
                                                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest block mb-1">Explanation</span>
                                                {safeRender(example.explanation)}
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

    const renderTopBarTimer = () => {
        if (!isAssessment && state !== 'idle' && state !== 'completed' && interviewStartTime) {
            return (
                <div className="scale-90 origin-right">
                    <InterviewLimitBar startTime={interviewStartTime} maxMs={interviewConfig.maxDurationMs} roundCount={roundCount} maxRounds={interviewConfig.maxTurnsPerProblem} isLimitReached={isLimitReached} limitReason={limitReason} />
                </div>
            );
        }
        return (
            <div className={cn("bg-zinc-900/80 px-2 py-1.5 rounded-lg border text-[10px] flex items-center gap-1.5", limits.timeRemaining <= 60 ? "border-red-500/50 text-red-400" : limits.timeRemaining <= 300 ? "border-amber-500/50 text-amber-400" : "border-zinc-800 text-zinc-400")}>
                <Clock className="w-3 h-3" />
                <span className="font-mono font-bold">{limits.formattedElapsed}</span>
                <span className="text-zinc-600">/</span>
                <span className="font-mono">{limits.formattedTotal}</span>
            </div>
        );
    };

    const renderProblemPanel = () => {
        if (isProblemCollapsed) {
            return (
                <div className="h-full flex flex-col items-center py-3 gap-4 border-r" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                    <button onClick={() => setIsProblemCollapsed(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
                        <BookOpen className="w-4 h-4 text-zinc-400 hover:text-white" />
                    </button>
                </div>
            );
        }
        return (
            <div className="h-full flex flex-col border-r" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    {renderProblemCardContent()}
                </div>
            </div>
        );
    };

    const renderCodePanel = () => (
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-1)' }}>
            <div className="flex-1 min-h-0 relative">
                {!hasStarted && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <span className="text-zinc-500 text-sm font-medium">Start interview to write code</span>
                    </div>
                )}
                <CodeEditor
                    onCodeChange={setUserCode}
                    defaultLanguage={codeLanguage}
                    initialCode={userCode}
                    onLanguageChange={setCodeLanguage}
                    readOnly={!hasStarted || readOnly}
                    onKeyDown={handleCodeKeyDown}
                    onExecutionStart={() => {
                        setIsExecRunning(true);
                        setLastExecResult(null);
                    }}
                    onExecutionResult={(result) => {
                        setLastExecResult(result);
                        setIsExecRunning(false);
                        if (result.stdout || result.stderr || result.exit_code !== 0) {
                            const testResults = matchResults(testCases, result);
                            const kaiCtx = buildKaiExecutionContext(userCode, codeLanguage, testCases, result, testResults);
                            shareCodeWithAI(kaiCtx);
                        }
                    }}
                />
            </div>
            {testCases.length > 0 && (
                <div className="shrink-0 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                    <TestCasePanel testCases={testCases} executionResult={lastExecResult} isRunning={isExecRunning} />
                </div>
            )}
            {hasStarted && !readOnly && (
                <div className="shrink-0 p-3 border-t" style={{ borderColor: 'var(--surface-edge)' }}>
                    <Button onClick={() => shareCodeWithAI(userCode)} disabled={!userCode.trim() || isProcessing || voice.isSpeaking} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 text-xs rounded-xl shadow-lg border-t border-white/10">
                        <Send className="w-3.5 h-3.5 mr-2" /> Share Code with Kai
                    </Button>
                </div>
            )}
        </div>
    );

    const renderStatusChip = () => (
        <div className="bg-zinc-900/80 backdrop-blur-xl px-2.5 py-1 rounded-full border border-zinc-800 flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", voice.isListening ? "bg-indigo-500" : isProcessing ? "bg-amber-400" : voice.isSpeaking ? "bg-purple-500" : "bg-emerald-500")} />
            <span className="text-[9px] font-black tracking-widest text-zinc-300 uppercase">
                {voice.isListening ? "Listening" : isProcessing ? "Thinking" : voice.isSpeaking ? "Speaking" : "Ready"}
            </span>
        </div>
    );

    const renderVoicePanel = () => {
        if (!hasStarted) {
            return (
                <div className="h-full flex flex-col items-center justify-center p-6 border-l" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-6 max-w-xs w-full">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)' }}>
                            K
                        </div>
                        <p className="text-zinc-400 text-sm text-center">Ready when you are</p>
                        <Button onClick={handleStart} size="lg" className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 h-12 font-bold rounded-xl text-white shadow-lg" data-tour="begin-button">
                            Begin Interview Experience
                        </Button>
                    </motion.div>
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col relative border-l" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                {/* Header */}
                <div className="h-11 shrink-0 border-b flex items-center justify-between px-3 bg-black/10" style={{ borderColor: 'var(--surface-edge)' }}>
                    {renderStatusChip()}
                    <div className="flex gap-2 items-center">
                        {isReviewMode && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Review</span>}
                        {isGuest && !isAssessment && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Trial ({GUEST_SESSION_LIMITS.MAX_USER_TURNS - guestSession.userTurns} left)</span>}
                    </div>
                </div>
                
                {/* Chat History (Universal full view replace slice(-3)) */}
                <div className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar flex flex-col">
                    <div className="flex-1 min-h-0">
                        <ConversationView 
                            messages={messages} 
                            isAISpeaking={voice.isSpeaking} 
                            isProcessing={isProcessing} 
                        />
                    </div>
                </div>

                {/* Live Transcript */}
                <div className="shrink-0 px-2 py-2 border-t h-28 overflow-hidden bg-black/20" style={{ borderColor: 'var(--surface-edge)' }}>
                    <div className="flex justify-between items-center px-1 mb-1">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">Live Tracker</label>
                    </div>
                    <div className="h-full relative">
                        <div className="absolute inset-0 pb-6">
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
                    {ttsError && (
                        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1 text-red-400 text-[10px] font-bold whitespace-nowrap z-20">
                            Playback failed. Read above.
                        </div>
                    )}
                </div>

                {/* Mic Controls */}
                {!readOnly && !isLimitLocked && (
                    <div className="shrink-0 p-4 border-t flex flex-col items-center gap-3 bg-black/10 relative" style={{ borderColor: 'var(--surface-edge)' }}>
                        <div className="flex items-center gap-4 relative">
                            <MicrophoneButton
                                isListening={voice.isListening}
                                error={voice.error?.message}
                                onClick={() => {
                                    if (voice.isSpeaking) {
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
                                <MicPulse size="compact" state={voice.isListening ? 'listening' : isProcessing ? 'processing' : voice.isSpeaking ? 'speaking' : 'idle'} />
                            </div>
                        </div>

                        {voice.isSpeaking && (
                            <Button onClick={voice.stopSpeaking} variant="outline" size="sm" className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border-red-500/30 text-[11px] uppercase tracking-wider font-bold rounded-full px-4 h-8 transition-colors absolute top-4 right-4 z-40">
                                <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Stop Kai
                            </Button>
                        )}

                        {(voice.transcript || voice.isTranscribing) && !isProcessing && (
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 text-xs mt-1 rounded-lg"
                                onClick={() => { if (voice.transcript) submitUserResponse(voice.transcript, { title: activeProblem.title, content: activeProblem.description }); }}
                                disabled={voice.isTranscribing}>
                                <Send className="w-3 h-3 mr-1.5" />
                                {voice.isTranscribing ? 'Transcribing...' : sendCountdown !== null ? `Sending in ${sendCountdown}s...` : 'Send Message'}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        );
    };

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
            <div className="hidden lg:flex flex-col relative w-full h-full">
                <InterviewTopBar
                    problemTitle={activeProblem.title}
                    difficultyMode={interviewConfig.difficultyMode}
                    isCollapsed={isProblemCollapsed}
                    onToggleProblem={() => setIsProblemCollapsed(!isProblemCollapsed)}
                    onEnd={() => { endInterview(); handleFinish(); }}
                    hasStarted={hasStarted}
                    readOnly={readOnly}
                    roundCount={roundCount}
                    timerNode={renderTopBarTimer()}
                />
                
                <div className="flex-1 w-full min-h-0">
                    <ResizablePanelGroup direction="horizontal">
                        <ThreePanelCollapseController isProblemCollapsed={isProblemCollapsed} />
                        <ResizablePanel
                            id="problem-panel"
                            defaultSize={25}
                            minSize={15}
                            maxSize={40}
                            className={isProblemCollapsed ? "min-w-[48px] max-w-[48px]" : ""}
                        >
                            {renderProblemPanel()}
                        </ResizablePanel>
                        <ResizableHandle className={isProblemCollapsed ? "w-px bg-zinc-800/50 cursor-default hover:bg-zinc-800/50 active:bg-zinc-800/50" : "w-1.5 hover:bg-indigo-500/50 transition-colors bg-zinc-800/50"} />
                        
                        <ResizablePanel defaultSize={45} minSize={30}>
                            {renderCodePanel()}
                        </ResizablePanel>
                        
                        <ResizableHandle className="w-1.5 hover:bg-indigo-500/50 transition-colors bg-zinc-800/50" />
                        
                        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
                            {renderVoicePanel()}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>
            </div>

            {/* MOBILE LAYOUT w/ Swipe Tabs */}
            <div
                className="lg:hidden flex-1 w-full h-full relative"
                {...swipeHandlers}
                style={{
                    touchAction: 'pan-y',
                    transform: `translateX(${dragOffset}px)`,
                    transition: dragOffset === 0 ? 'transform 180ms ease-out' : 'none',
                }}
            >
                <div className="absolute inset-0 flex flex-col overflow-hidden pb-14">
                    {activeTab === 'problem' && (
                        <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-left-4">
                            <div className="flex-1">{renderProblemCardContent()}</div>
                        </div>
                    )}

                    {activeTab === 'interview' && (
                        <div className="flex-1 w-full h-full animate-in fade-in zoom-in-95">
                            {renderVoicePanel()}
                        </div>
                    )}

                    {activeTab === 'code' && (
                        <div className="flex-1 w-full h-full p-2 animate-in fade-in slide-in-from-bottom-4" onPointerDown={(e) => e.stopPropagation()}>
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
                                        onKeyDown={handleCodeKeyDown}
                                        onExecutionStart={() => {
                                            setIsExecRunning(true);
                                            setLastExecResult(null);
                                        }}
                                        onExecutionResult={(result) => {
                                            setLastExecResult(result);
                                            setIsExecRunning(false);
                                            if (result.stdout || result.stderr || result.exit_code !== 0) {
                                                const testResults = matchResults(testCases, result);
                                                const kaiCtx = buildKaiExecutionContext(userCode, codeLanguage, testCases, result, testResults);
                                                shareCodeWithAI(kaiCtx);
                                            }
                                        }}
                                    />
                                    {testCases.length > 0 && (
                                        <div className="mt-2 shrink-0">
                                            <TestCasePanel
                                                testCases={testCases}
                                                executionResult={lastExecResult}
                                                isRunning={isExecRunning}
                                            />
                                        </div>
                                    )}
                                    <Button onClick={() => shareCodeWithAI(userCode)} disabled={!userCode.trim() || isProcessing || voice.isSpeaking} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 shadow-lg shrink-0 rounded-xl">
                                        <Send className="w-3.5 h-3.5 mr-1.5" /> Share
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-right-4">
                            <div className="mb-2 flex justify-between items-center px-1">
                                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Interview History</h2>
                                {messages.length > 0 && (
                                    <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 text-[9px]">{messages.length} turns</Badge>
                                )}
                            </div>
                            <div className="rounded-2xl border flex flex-col flex-1 overflow-hidden min-h-[200px]" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
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
                            { id: 'interview', label: 'Kai', icon: Mic },
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

            {streakMilestone && (
                <StreakMilestoneModal
                    streak={streakMilestone.days}
                    isNewRecord={streakMilestone.isRecord}
                    onDismiss={() => {
                        setStreakMilestone(null);
                        streakMilestone.onDismiss?.();
                    }}
                />
            )}
        </div>
    );
}