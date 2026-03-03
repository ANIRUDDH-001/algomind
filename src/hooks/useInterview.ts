/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import { generateSystemPrompt, generateTurnPrompt } from '@/lib/interview/prompts';
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

const AUTO_SUBMIT_DELAY = 2500; // 2.5 seconds of silence = done speaking

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
    const [roundCount, setRoundCount] = useState(0);           // Number of completed AI response rounds
    const [interviewStartTime, setInterviewStartTime] = useState<number | null>(null); // Unix ms
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [limitReason, setLimitReason] = useState<'rounds' | 'time' | null>(null);

    const INTERVIEW_MAX_ROUNDS = options.config.maxTurnsPerProblem;
    const INTERVIEW_MAX_MS = options.config.maxDurationMs;

    // Problem Context helper ref
    const currentProblemRef = useRef<ProblemContext | null>(null);
    const pendingAutoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Logic Refs
    const stateMachine = useRef(new InterviewStateMachine());
    const conversationHistoryRef = useRef<Message[]>([]);

    // ── STT & TTS ───────────────────────────────────────
    const whisperEnabled = useGlobalFeatureFlag('ENABLE_WHISPER_STT');
    const sttProvider = (
        whisperEnabled &&
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined'
    ) ? 'whisper' as const : 'browser' as const;

    const [hasPendingSend, setHasPendingSend] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const [voiceError, setVoiceError] = useState<Error | null>(null);
    const hasPendingRef = useRef(false);
    useEffect(() => { hasPendingRef.current = hasPendingSend; }, [hasPendingSend]);

    const tts = useTTS({
        onSpeakStart: () => {
            stt.stopListening();
            setHasPendingSend(false);
            setIsMicEnabled(false);
        },
        onSpeakEnd: () => {
            setTimeout(() => {
                if (!tts.isSpeaking && !hasPendingRef.current) {
                    setIsMicEnabled(true);
                    stt.startListening();
                    if (sttProvider === 'whisper') vad.startListening();
                }
            }, 400);
        },
        voiceName: optionsRef.current.voicePrefs?.name ?? null,
        voiceRate: optionsRef.current.voicePrefs?.rate ?? 1.0,
        voicePitch: optionsRef.current.voicePrefs?.pitch ?? 1.0,
    });

    const stt = useSTT({
        provider: sttProvider,
        silenceMs: 5000,
        onTranscript: (text: string, isFinal: boolean) => {
            if (isFinal) {
                setTranscript(prev => prev ? `${prev} ${text}` : text);
            } else {
                setInterimTranscript(text);
            }
            lastTranscriptTimeRef.current = Date.now(); // update for auto-submit timer
        },
        onSilenceTimeout: () => {
            stt.stopListening();
            setHasPendingSend(transcriptRef.current.length > 0);
            setIsMicEnabled(false);
        },
        onError: (err) => setVoiceError(new Error(err)),
    });

    const vad = useVAD({
        enabled: options.config.mode !== 'guest' && options.config.difficultyMode !== undefined,
        onSpeechEnd: (audio) => stt.transcribeAudio(audio),
    });

    // Legacy aliases
    const isSpeaking = tts.isSpeaking;
    const speak = tts.speak;
    const stopSpeaking = tts.stop;
    const isListening = stt.isListening;
    const startListening = stt.startListening;
    const stopListening = stt.stopListening;
    const abortListening = stt.stopListening;
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

    const micPausedForSilenceRef = useRef(false);

    const [optimisticListening, setOptimisticListening] = useState<boolean | null>(null);

    useEffect(() => {
        if (optimisticListening === isListening) {
            // Need a tiny timeout to avoid React state dispatch mid-render warnings
            setTimeout(() => setOptimisticListening(null), 0);
        }
    }, [isListening, optimisticListening]);

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
        setIsMicEnabled(false);
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

    const callChatApi = useCallback(async (prompt: string, systemPrompt: string, problemContext: ProblemContext) => {
        try {
            const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
            const data = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // We send the conversation history (excluding the just-added user message,
                    // which is passed separately as `prompt` below).
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

            return data.response; // string
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
            // Pass the count INCLUDING the newly added message
            optionsRef.current.onUserMessage(userMsg, conversationHistoryRef.current.length);
        }
        resetTranscript();

        setIsProcessing(true);
        stateMachine.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachine.current.getState());

        // Conversation history is passed via messages[] array, not embedded in prompt text
        const methodHistory = ''; // No longer embedded in prompt (was causing duplicate context)

        // Check for recent interrupted AI message → inject context
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
            ragContext: '', // Chat API performs live RAG lookup — do not pass literal string here
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
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());

            // Increment round count and check limits
            const newRoundCount = roundCount + 1;
            setRoundCount(newRoundCount);

            const elapsedMs = interviewStartTime ? Date.now() - interviewStartTime : 0;
            const roundLimitHit = newRoundCount >= INTERVIEW_MAX_ROUNDS;
            const timeLimitHit = elapsedMs >= INTERVIEW_MAX_MS;

            if (roundLimitHit || timeLimitHit) {
                setIsLimitReached(true);
                setLimitReason(roundLimitHit ? 'rounds' : 'time');
                // Auto-transition to solution-review after short delay
                setTimeout(() => {
                    stateMachine.current.transition('SUBMIT_SOLUTION');
                    setState(stateMachine.current.getState());
                }, 1500); // Give time for TTS to finish current sentence
            }
        } catch (e) {
            console.error('❌ [ERROR] Failed to process user response:', e);
            addMessage({ id: generateMessageId(), role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    }, [stopListening, addMessage, resetTranscript, callChatApi, speak, roundCount, interviewStartTime]);

    // Mic Intent State
    const isMicEnabledRef = useRef(false);
    useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);

    // Initial Start: Enable Mic
    // (Optional: If you want it to start automatically when interview starts)

    // Auto-Submit Logic
    useEffect(() => {
        if (!autoSubmitEnabled || !isListening || !transcript || isProcessing) return;

        const sinceLastWord = Date.now() - lastTranscriptTimeRef.current;
        const remaining = Math.max(100, AUTO_SUBMIT_DELAY - sinceLastWord);
        if (sinceLastWord >= AUTO_SUBMIT_DELAY && currentProblemRef.current) {
            submitUserResponse(transcript, currentProblemRef.current);
        } else if (currentProblemRef.current) {
            const timer = setTimeout(() => {
                pendingAutoSubmitRef.current = null;
                if (isListening && transcript && currentProblemRef.current) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }, remaining);
            pendingAutoSubmitRef.current = timer;
            return () => {
                clearTimeout(timer);
                pendingAutoSubmitRef.current = null;
            };
        }
    }, [transcript, isListening, autoSubmitEnabled, isProcessing, submitUserResponse]);

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

        // Reset state machine if restarting after completion
        if (stateMachine.current.getState() === 'completed') {
            stateMachine.current.reset();
        }
        // Reset conversation history for fresh interview
        conversationHistoryRef.current = [];
        setMessages([]);
        currentProblemRef.current = { title: problemTitle, content: problemContent, ragContext, kaiMemory, problemId, difficultyMode, difficulty };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        // Auto-enable mic on start if desired
        setIsMicEnabled(true);

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
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch {
            addMessage({ id: generateMessageId(), role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    }, [callChatApi, addMessage, speak]);


    // Cleanup Audio on Unmount or Visibility Change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopSpeaking();
                setIsMicEnabled(false); // Disable mic on hide
                stopListening();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopSpeaking(); // Force stop on unmount
            stopListening();
        };
    }, [stopSpeaking, stopListening]);

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

    // INTELLIGENT MIC SYNC: Stop listening when AI speaks, Resume when done
    // Controlled by isMicEnabled
    // Use a ref to track if we've already attempted to resume in this "AI finished" cycle
    const micResumeAttemptedRef = useRef(false);

    useEffect(() => {
        if ((state as string) === 'idle') {
            if (isListeningRef.current) stopListening();
            // Stop VAD when idle
            if (sttProvider === 'whisper') vad.stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        // If User Manually Disabled Mic -> Ensure Stopped
        if (!isMicEnabled) {
            if (isListeningRef.current) stopListening();
            // Stop VAD when mic disabled
            if (sttProvider === 'whisper') vad.stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        // CRITICAL: Stop mic when AI is processing (waiting for API)
        // OR when AI is speaking (to prevent echo)
        const shouldStopForSpeaking = isSpeaking;

        if (shouldStopForSpeaking || isProcessing) {
            if (isListeningRef.current) {
                if (pendingAutoSubmitRef.current) {
                    clearTimeout(pendingAutoSubmitRef.current);
                    pendingAutoSubmitRef.current = null;
                }
                abortListening();
            }
            // Pause VAD while AI is speaking/processing
            if (sttProvider === 'whisper') vad.stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        if (isListeningRef.current) {
            return;
        }

        // Mic is Enabled (Intent) AND AI is silent: Resume Mic
        if (!isListeningRef.current && !micPausedForSilenceRef.current) {
            const timer = setTimeout(() => {
                const currentlyListening = isListeningRef.current;
                const currentlySpeaking = isSpeakingRef.current;
                const currentlyProcessing = isProcessingRef.current;
                const micStillEnabled = isMicEnabledRef.current;

                const stillShouldStop = currentlySpeaking || currentlyProcessing;
                if (micStillEnabled && !stillShouldStop && !currentlyListening) {
                    resetTranscript();
                    startListening();
                    // Start VAD alongside STT in whisper mode
                    if (sttProvider === 'whisper') vad.startListening();
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [isSpeaking, isProcessing, startListening, stopListening, abortListening, state, isMicEnabled, resetTranscript, sttProvider, vad]);

    // Reset micResumeAttemptedRef once we confirm mic is actually live
    useEffect(() => {
        if (isListening) {
            micResumeAttemptedRef.current = false;
        }
    }, [isListening]);

    // Silence timeout removed — was causing erratic mic stops.
    // The mic stays on until user explicitly stops it or AI starts speaking.

    const resetInterview = useCallback(() => {
        setMessages([]);
        setState('idle');
        stateMachine.current.reset();
        conversationHistoryRef.current = [];
        resetTranscript();
        setIsProcessing(false);
        setIsMicEnabled(false); // Disable mic on reset
        stopListening();
        // Reset limits
        setRoundCount(0);
        setInterviewStartTime(null);
        setIsLimitReached(false);
        setLimitReason(null);
    }, [resetTranscript, stopListening]);

    const toggleMic = useCallback(() => {
        setIsMicEnabled(prev => !prev);
    }, []);

    // ── Session ID for analytics ─────────────────────────────────
    const sessionIdRef = useRef<string>(generateMessageId());

    // ── Handle interruption: capture partial content ─────────────
    const handleInterruption = useCallback((spokenContent?: string) => {
        setMessages(prev => {
            // Find the last assistant message
            const lastAiIdx = prev.length - 1;
            if (lastAiIdx < 0 || prev[lastAiIdx].role !== 'assistant') return prev;

            const lastAiMsg = prev[lastAiIdx];
            if (lastAiMsg.status === 'interrupted') return prev; // already marked

            const now = Date.now();
            const partial = spokenContent || lastAiMsg.content;

            // STOP SPEAKING BEFORE RECORDING INTERRUPTION
            stopSpeaking();

            // Update the message in both state and ref
            const updated: Message = {
                ...lastAiMsg,
                status: 'interrupted',
                partialContent: partial,
                interruptedAt: now,
            };

            const newMessages = [...prev];
            newMessages[lastAiIdx] = updated;

            // Keep conversationHistoryRef in sync
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
        if (roundCount < 1) return; // Minimum 1 round required
        setIsMicEnabled(false);
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
        vadMode: vad.mode,
        ttsProvider: tts.provider,
        sttProvider,
        handleMicStop: () => {
            stt.stopListening();
            setHasPendingSend(transcript.trim().length > 0);
            setIsMicEnabled(false);
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
            isListening: optimisticListening ?? isListening,
            transcript,
            interimTranscript,
            startListening: () => {
                setIsMicEnabled(true);
                setOptimisticListening(true);
                startListening();
                // Start VAD mic capture in whisper mode
                if (sttProvider === 'whisper') vad.startListening();
            },
            stopListening: () => {
                setIsMicEnabled(false);
                setOptimisticListening(false);
                stopListening();
                // Stop VAD mic capture in whisper mode
                if (sttProvider === 'whisper') vad.stopListening();
            },
            toggleMic, // New toggle
            isMicEnabled, // Expose state
            isSpeaking,
            speak,
            pauseSpeaking,
            resumeSpeaking,
            stopSpeaking,
            error: voiceError,
            transcribeVADAudio,
            submitCurrentTranscript: () => {
                if (transcript && currentProblemRef.current) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }
        }
    };
}

