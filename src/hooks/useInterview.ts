/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import { generateTurnPrompt } from '@/lib/interview/prompts';
import { generateInterviewerSystemPrompt } from '@/lib/interview/interviewer-prompt';
import { useTTS } from '@/hooks/useTTS';
import { useSTT } from '@/hooks/useSTT';
import { useVAD } from '@/hooks/useVAD';
import type { InterviewConfig } from '@/lib/interview/interview-config';
import type { KaiMemoryStructured } from '@/types/kai-memory';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { buildInterruptionContext } from '@/lib/interview/interruption-context';

/** Unique ID for stable message identification. */
function generateMessageId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface Message {
    /** Stable unique identifier for this message. */
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    /** Message delivery status. */
    status?: 'complete' | 'interrupted' | 'cancelled';
    /** What the AI said before the user interrupted (subset of content). */
    partialContent?: string;
    /** Unix timestamp of when the interruption occurred. */
    interruptedAt?: number;
}

// Phase 2a: micIntent state machine replaces boolean isMicEnabled
export type MicIntent = 'user-on' | 'auto-on' | 'paused-for-ai' | 'off';

interface ProblemContext {
    title: string;
    content: string;
    ragContext?: string;
    kaiMemory?: string;
    problemId?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint';
}

export function useInterview(options: {
    config: InterviewConfig;
    isTimeUp?: boolean;          // ← ADD THIS: from useInterviewLimits
    voicePrefs?: { name: string | null; rate: number; pitch: number };
    isReviewMode?: boolean;
    apiEndpoint?: string;
    sessionToken?: string;
    onUserMessage?: (msg: Message, count: number) => void;
    isGuest?: boolean;
}) {
    const optionsRef = useRef(options);
    useEffect(() => { optionsRef.current = options; },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options.config, options.isTimeUp, options.voicePrefs, options.isReviewMode, options.apiEndpoint, options.sessionToken, options.onUserMessage, options.isGuest]
    );

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const lastTranscriptTimeRef = useRef<number>(0);
    const transcriptRef = useRef('');
    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

    // Interview limits
    const [roundCount, setRoundCount] = useState(0);
    const [interviewStartTime, setInterviewStartTime] = useState<number | null>(null);
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [limitReason, setLimitReason] = useState<'rounds' | 'time' | null>(null);

    const INTERVIEW_MAX_ROUNDS = options.config.maxTurnsPerProblem;
    const INTERVIEW_MAX_MS = options.config.maxDurationMs;

    // Problem Context helper ref
    const currentProblemRef = useRef<ProblemContext | null>(null);

    // Logic Refs
    const stateMachine = useRef(new InterviewStateMachine());
    const conversationHistoryRef = useRef<Message[]>([]);

    // ── Phase 2a: micIntent state machine ──────────────────────────
    const [micIntent, setMicIntent] = useState<MicIntent>('off');
    const [hasPendingSend, setHasPendingSend] = useState(false);
    const [voiceError, setVoiceError] = useState<Error | null>(null);
    const hasPendingRef = useRef(false);
    useEffect(() => { hasPendingRef.current = hasPendingSend; }, [hasPendingSend]);

    // Derived: is mic "logically enabled" (for backward compat)
    const isMicEnabled = micIntent === 'user-on' || micIntent === 'auto-on';

    // ── STT & TTS ───────────────────────────────────────
    const whisperEnabled = useGlobalFeatureFlag('ENABLE_WHISPER_STT');

    // Track whether VAD failed and we need to cascade to browser STT
    const [vadFailed, setVadFailed] = useState(false);

    // sttProvider: start with 'whisper' if enabled, but cascade to 'browser' if VAD fails
    const sttProvider = (
        whisperEnabled &&
        !vadFailed &&
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined'
    ) ? 'whisper' as const : 'browser' as const;

    const tts = useTTS({
        // Phase 0e: onSpeakStart just pauses intent, no direct stopListening
        onSpeakStart: () => {
            stt.stopListening();
            setHasPendingSend(false);
            setMicIntent('paused-for-ai');
        },
        // Phase 0e: onSpeakEnd — let the mic sync effect handle resumption reactively
        onSpeakEnd: () => {
            // Transition from paused-for-ai → auto-on (mic sync effect will resume)
            setMicIntent(prev => prev === 'paused-for-ai' ? 'auto-on' : prev);
        },
        voiceName: optionsRef.current.voicePrefs?.name ?? null,
        voiceRate: optionsRef.current.voicePrefs?.rate ?? 1.0,
        voicePitch: optionsRef.current.voicePrefs?.pitch ?? 1.0,
    });

    const stt = useSTT({
        provider: sttProvider,
        // Phase 0c: Increase silence timeout from 5s to 15s
        silenceMs: 15000,
        onTranscript: (text: string, isFinal: boolean) => {
            if (isFinal) {
                setTranscript(prev => prev ? `${prev} ${text}` : text);
            } else {
                setInterimTranscript(text);
            }
            lastTranscriptTimeRef.current = Date.now();
        },
        // Phase 0d: onSilenceTimeout no longer kills mic — just prompts send
        onSilenceTimeout: () => {
            // Don't stop listening or disable mic — just prompt user to send
            setHasPendingSend(transcriptRef.current.length > 0);
        },
        onError: (err) => setVoiceError(new Error(err)),
    });

    // Phase 3c: VAD enabled based on sttProvider, not guest mode or difficultyMode
    const vad = useVAD({
        enabled: sttProvider === 'whisper',
        onSpeechEnd: (audio) => stt.transcribeAudio(audio),
        onFallback: () => {
            // VAD failed (ONNX unavailable) — cascade to browser SpeechRecognition
            console.warn('[useInterview] VAD failed, cascading to browser STT');
            setVadFailed(true);
        },
    });

    // Legacy aliases
    const isSpeaking = tts.isSpeaking;
    const speak = tts.speak;
    const stopSpeaking = tts.stop;
    const isListening = stt.isListening;
    const startListening = stt.startListening;
    const stopListening = stt.stopListening;
    const _abortListening = stt.stopListening;
    const resetTranscript = useCallback(() => {
        stt.resetTranscript();
        setTranscript('');
        setInterimTranscript('');
        lastTranscriptTimeRef.current = 0;
    }, [stt.resetTranscript]);
    const transcribeVADAudio = stt.transcribeAudio;
    const pauseSpeaking = () => { };
    const resumeSpeaking = () => { };

    // ── Stable refs for values read inside timers / effects ──────────
    const isListeningRef = useRef(false);
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

    const isSpeakingRef = useRef(false);
    useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

    const isProcessingRef = useRef(false);
    useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

    // Time limit enforcement: tied strictly to global UI hook
    useEffect(() => {
        if (!options.isTimeUp) return;
        if (isLimitReached || state === 'idle' || state === 'completed') return;
        setIsLimitReached(true);
        setLimitReason('time');
        setMicIntent('off');
        stopListening();
        stateMachine.current.transition('SUBMIT_SOLUTION');
        setState(stateMachine.current.getState());
    }, [options.isTimeUp, isLimitReached, state, stopListening]);

    const fetchWithRetry = useCallback(async (url: string, fetchOptions: RequestInit, retries = 3, backoff = 1000): Promise<{ response: string } | any> => {
        const runFetch = async (currentRetries: number, currentBackoff: number): Promise<any> => {
            try {
                const response = await fetch(url, fetchOptions);

                if (response.status === 429 || response.status >= 500) {
                    if (currentRetries > 0) {
                        console.log(`[Retry] Request failed with ${response.status}. Retrying in ${currentBackoff}ms...`);
                        await new Promise(resolve => setTimeout(resolve, currentBackoff));
                        return runFetch(currentRetries - 1, currentBackoff * 2);
                    }
                }

                if (!response.ok) {
                    const err = (await response.json().catch(() => ({ error: 'Failed to fetch chat response' }))) as { error?: string };
                    throw new Error(err.error || `Request failed with status ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (currentRetries > 0) {
                    console.log(`[Retry] Network error. Retrying in ${currentBackoff}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, currentBackoff));
                    return runFetch(currentRetries - 1, currentBackoff * 2);
                }
                throw error;
            }
        };

        return runFetch(retries, backoff);
    }, []);

    const callChatApi = useCallback(async (prompt: string, systemPrompt: string, _problemContext: ProblemContext) => {
        try {
            const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
            const data = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...conversationHistoryRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: prompt }
                    ],
                    systemPrompt,
                    problemContext: {
                        title: currentProblemRef.current?.title ?? '',
                        content: currentProblemRef.current?.content ?? '',
                        ragContext: optionsRef.current.config.ragContext,
                        tags: (currentProblemRef.current as any)?.tags ?? [],
                    },
                    sessionToken: optionsRef.current.sessionToken,
                    guestMode: optionsRef.current.isGuest ?? false,
                    kaiMemory: optionsRef.current.config.kaiMemory,
                    interviewState: stateMachine.current.getState(),
                })
            });

            return data.response;
        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    }, [fetchWithRetry]);

    const addMessage = useCallback((msg: Message) => {
        setMessages(prev => [...prev, msg]);
        conversationHistoryRef.current.push(msg);
    }, []);

    const submitUserResponse = useCallback(async (userText: string, problemContext: ProblemContext) => {
        if (stateMachine.current.getState() === 'completed') return;
        if (!userText.trim()) return;

        // Don't disable intent, just stop listening momentarily for processing
        stopListening();

        const userMsg: Message = { id: generateMessageId(), role: 'user', content: userText, timestamp: new Date(), status: 'complete' };
        addMessage(userMsg);

        if (optionsRef.current.onUserMessage) {
            optionsRef.current.onUserMessage(userMsg, conversationHistoryRef.current.length);
        }
        resetTranscript();

        setIsProcessing(true);
        stateMachine.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachine.current.getState());

        const methodHistory = '';

        const lastInterrupted = conversationHistoryRef.current
            .slice()
            .reverse()
            .find(m => m.role === 'assistant' && m.status === 'interrupted' && m.partialContent);

        const interruptionCtx = lastInterrupted
            ? buildInterruptionContext(lastInterrupted.partialContent!, lastInterrupted.interruptedAt ?? Date.now())
            : undefined;

        const prompt = generateTurnPrompt({
            state: stateMachine.current.getState(),
            problemTitle: problemContext.title,
            problemContent: problemContext.content,
            transcript: userText,
            conversationHistory: methodHistory,
            ragContext: '',
            interruptionContext: interruptionCtx,
        });

        const config: any = {
            problem: { title: problemContext.title, description: problemContext.content, difficulty: problemContext.difficulty || 'medium', id: problemContext.problemId || '' } as any,
            difficulty: problemContext.difficulty || 'medium',
            difficultyMode: optionsRef.current.config.difficultyMode,
            ragContext: optionsRef.current.config.ragContext,
            kaiMemory: optionsRef.current.config.kaiMemory,
            kaiMemoryStructured: optionsRef.current.config.kaiMemoryStructured,
        };

        try {
            const responseText = await callChatApi(prompt, generateInterviewerSystemPrompt(config), problemContext);
            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            addMessage(aiMsg);
            // Gate mic before speak() so onSpeakStart race is closed.
            // onSpeakEnd will transition paused-for-ai → auto-on when TTS finishes.
            setMicIntent('paused-for-ai');
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());

            const newRoundCount = roundCount + 1;
            setRoundCount(newRoundCount);

            const elapsedMs = interviewStartTime ? Date.now() - interviewStartTime : 0;
            const roundLimitHit = newRoundCount >= INTERVIEW_MAX_ROUNDS;
            const timeLimitHit = elapsedMs >= INTERVIEW_MAX_MS;

            if (roundLimitHit || timeLimitHit) {
                setIsLimitReached(true);
                setLimitReason(roundLimitHit ? 'rounds' : 'time');
                setTimeout(() => {
                    stateMachine.current.transition('SUBMIT_SOLUTION');
                    setState(stateMachine.current.getState());
                }, 1500);
            }
        } catch (e) {
            console.error('❌ [ERROR] Failed to process user response:', e);
            addMessage({ id: generateMessageId(), role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    }, [stopListening, addMessage, resetTranscript, callChatApi, speak, roundCount, interviewStartTime]);

    // Phase 2e: Auto-Submit removed — user sends manually via Send button.
    // The hasPendingSend state + sendPendingTranscript() remain for manual send.

    // Core Logic
    const startInterview = useCallback(async (opts: {
        problemTitle: string;
        problemContent: string;
        ragContext?: string;
        kaiMemory?: string;
        problemId?: string;
        difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint';
        difficulty?: 'easy' | 'medium' | 'hard';
        kaiMemoryStructured?: KaiMemoryStructured | null;
    }) => {
        const { problemTitle, problemContent, ragContext, kaiMemory, problemId, difficultyMode, difficulty, kaiMemoryStructured } = opts;

        if (stateMachine.current.getState() === 'completed') {
            stateMachine.current.reset();
        }
        conversationHistoryRef.current = [];
        setMessages([]);
        currentProblemRef.current = { title: problemTitle, content: problemContent, ragContext, kaiMemory, problemId, difficultyMode, difficulty };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        // Phase 2a: Start paused — onSpeakEnd will transition to 'auto-on' when intro TTS finishes.
        // Never set 'auto-on' here: setIsProcessing(false) runs in finally while TTS is still
        // starting, creating a gap where mic+VAD activates while AI is speaking.
        setMicIntent('paused-for-ai');

        const config = {
            problem: { title: problemTitle, description: problemContent, difficulty: difficulty || 'medium', id: problemId || '' } as any,
            difficulty: difficulty || 'medium',
            difficultyMode: difficultyMode ?? 'practice',
            ragContext: ragContext || '',
            kaiMemory: kaiMemory || '',
            kaiMemoryStructured: kaiMemoryStructured ?? undefined
        };

        const sysPrompt = generateInterviewerSystemPrompt(config);
        const introPrompt = generateTurnPrompt({
            state: 'problem-intro',
            problemTitle,
            problemContent,
            transcript: '',
            conversationHistory: '',
            ragContext: ragContext || ''
        });

        setRoundCount(0);
        setInterviewStartTime(Date.now());
        setIsLimitReached(false);
        setLimitReason(null);

        setIsProcessing(true);
        try {
            let responseText = '';
            if (optionsRef.current.isReviewMode) {
                responseText = `Let's review ${problemTitle} which you've seen before. Without looking at your previous solution, explain your approach to this problem.`;
            } else {
                responseText = await callChatApi(introPrompt, sysPrompt, currentProblemRef.current!);
            }
            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            addMessage(aiMsg);
            // Gate mic before speak() so onSpeakStart race is closed.
            // onSpeakEnd will transition paused-for-ai → auto-on when TTS finishes.
            setMicIntent('paused-for-ai');
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch {
            addMessage({ id: generateMessageId(), role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    }, [callChatApi, addMessage, speak]);


    // Phase 2d: Fix tab visibility recovery — pause on hide, resume on visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopSpeaking();
                setMicIntent('paused-for-ai');
            } else {
                // Resume mic when tab becomes visible again
                if (state !== 'idle' && state !== 'completed') {
                    setMicIntent('auto-on');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopSpeaking();
            stopListening();
        };
    }, [stopSpeaking, stopListening, state]);

    // ── Mic diagnostics: log permission + resolved provider on mount ──
    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const info = {
            sttProvider,
            resolvedProvider: stt.resolvedProvider,
            permissionState: stt.permissionState,
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
            hasSpeechRecognition: !!(
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            ),
            hasMediaRecorder: typeof MediaRecorder !== 'undefined',
            hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
            hasAudioWorklet: !!(window as any).AudioWorklet,
        };
        console.info('[Mic Diagnostics]', info);

        // Live permission query (more up-to-date than useSTT's cached state)
        navigator.permissions?.query({ name: 'microphone' as PermissionName })
            .then(status => {
                console.info('[Mic Permission] current state:', status.state);
                if (status.state === 'denied') {
                    console.warn('[Mic Permission] DENIED — user must unblock mic in browser settings');
                }
            })
            .catch(() => console.warn('[Mic Permission] permissions API not available'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount only

    // Test Hook: Expose trigger for Playwright
    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
            (window as any).__TRIGGER_AI_CALL__ = (message: string) => {
                submitUserResponse(message, currentProblemRef.current || { title: 'Test', content: 'Test' });
            };
            return () => {
                delete (window as any).__TRIGGER_AI_CALL__;
            };
        }
    }, [submitUserResponse]);

    // ── Phase 2c: Simplified mic sync effect ──────────────────────
    // Clean reactive effect driven by micIntent + AI state
    useEffect(() => {
        // Gate on interview being active
        if (state === 'idle' || state === 'completed') {
            if (isListeningRef.current) stopListening();
            if (sttProvider === 'whisper') vad.stopListening();
            return;
        }

        // Derive desired mic state from intent + AI state
        const shouldListen =
            (micIntent === 'user-on' || micIntent === 'auto-on') &&
            !isSpeaking &&
            !isProcessing;

        if (shouldListen && !isListeningRef.current) {
            // Small delay to avoid tight loops during state transitions
            const timer = setTimeout(() => {
                // Re-check conditions inside the timeout
                if (!isSpeakingRef.current && !isProcessingRef.current && !isListeningRef.current) {
                    console.log(`[Mic Sync] Starting mic. sttProvider=${sttProvider}, resolvedSTT=${stt.resolvedProvider}`);
                    resetTranscript();
                    startListening();
                    if (sttProvider === 'whisper') vad.startListening();
                }
            }, 350);
            return () => clearTimeout(timer);
        } else if (!shouldListen) {
            // Always stop both STT and VAD when we shouldn't be listening.
            // isListeningRef lags by one render cycle (async ref update), so check both unconditionally.
            if (isListeningRef.current) stopListening();
            if (sttProvider === 'whisper') vad.stopListening(); // idempotent — safe even if VAD is already stopped
        }
    }, [micIntent, isSpeaking, isProcessing, state, startListening, stopListening, resetTranscript, sttProvider, vad]);

    const resetInterview = useCallback(() => {
        setMessages([]);
        setState('idle');
        stateMachine.current.reset();
        conversationHistoryRef.current = [];
        resetTranscript();
        setIsProcessing(false);
        setMicIntent('off');
        stopListening();
        setRoundCount(0);
        setInterviewStartTime(null);
        setIsLimitReached(false);
        setLimitReason(null);
    }, [resetTranscript, stopListening]);

    const toggleMic = useCallback(() => {
        setMicIntent(prev => {
            if (prev === 'user-on' || prev === 'auto-on') return 'off';
            return 'user-on';
        });
    }, []);

    // ── Session ID for analytics ─────────────────────────────────
    const _sessionIdRef = useRef<string>(generateMessageId());

    // ── Handle interruption: capture partial content ─────────────
    const handleInterruption = useCallback((spokenContent?: string) => {
        setMessages(prev => {
            const lastAiIdx = prev.length - 1;
            if (lastAiIdx < 0 || prev[lastAiIdx].role !== 'assistant') return prev;

            const lastAiMsg = prev[lastAiIdx];
            if (lastAiMsg.status === 'interrupted') return prev;

            const now = Date.now();
            const partial = spokenContent || lastAiMsg.content;

            stopSpeaking();

            const updated: Message = {
                ...lastAiMsg,
                status: 'interrupted',
                partialContent: partial,
                interruptedAt: now,
            };

            const newMessages = [...prev];
            newMessages[lastAiIdx] = updated;

            if (conversationHistoryRef.current.length > 0) {
                const refIdx = conversationHistoryRef.current.length - 1;
                if (conversationHistoryRef.current[refIdx].id === lastAiMsg.id) {
                    conversationHistoryRef.current[refIdx] = updated;
                }
            }

            return newMessages;
        });
    }, []);

    const endInterview = useCallback(() => {
        if (roundCount < 1) return;
        setMicIntent('off');
        stopListening();
        stopSpeaking();
        stateMachine.current.transition('SUBMIT_SOLUTION');
        setState(stateMachine.current.getState());
    }, [roundCount, stopListening, stopSpeaking]);

    return {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        handleInterruption,
        endInterview,
        roundCount,
        interviewStartTime,
        isLimitReached,
        limitReason,
        autoSubmitEnabled,
        setAutoSubmitEnabled,
        hasPendingSend,
        isMicEnabled,
        micIntent,
        vadMode: vad.mode,
        vadFailed,
        ttsProvider: tts.provider,
        sttProvider,
        handleMicStop: () => {
            stt.stopListening();
            setHasPendingSend(transcript.trim().length > 0);
            setMicIntent('off');
        },
        sendPendingTranscript: () => {
            const text = transcript.trim();
            if (!text) return;
            resetTranscript();
            setHasPendingSend(false);
            submitUserResponse(text, currentProblemRef.current!);
        },
        loadTranscript: (msgs: (Omit<Message, 'id'> & { id?: string })[]) => {
            const withIds = msgs.map(m => ({
                ...m,
                id: m.id || generateMessageId(),
            })) as Message[];
            setMessages(withIds);
            conversationHistoryRef.current = withIds;
            setState('completed');
        },
        voice: {
            // Phase 2b: Remove optimisticListening — just use isListening directly
            isListening,
            transcript,
            interimTranscript,
            startListening: () => {
                // Don't start mic while AI is speaking — would cause feedback/echo into VAD
                if (isSpeaking) return;
                setMicIntent('user-on');
                startListening();
                if (sttProvider === 'whisper') vad.startListening();
            },
            stopListening: () => {
                setMicIntent('off');
                stopListening();
                if (sttProvider === 'whisper') vad.stopListening();
            },
            toggleMic,
            isMicEnabled,
            isSpeaking,
            speak,
            pauseSpeaking,
            resumeSpeaking,
            stopSpeaking,
            error: voiceError,
            permissionState: stt.permissionState,
            sttResolvedProvider: stt.resolvedProvider,
            transcribeVADAudio,
            submitCurrentTranscript: () => {
                if (transcript && currentProblemRef.current) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }
        }
    };
}
