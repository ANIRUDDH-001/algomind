/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import { generateSystemPrompt, generateTurnPrompt } from '@/lib/interview/prompts';
import { generateInterviewerSystemPrompt, InterviewConfig } from '@/lib/interview/interviewer-prompt';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useWhisperInput } from '@/hooks/useWhisperInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { WhisperSTT } from '@/lib/voice/whisper-stt';
import { buildInterruptionContext } from '@/lib/interview/interruption-context';
import { trackInterruption } from '@/lib/analytics/interruption-analytics';

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
    companyPersona?: string;
    kaiMemory?: string;
    problemId?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint';
}

export function useInterview(options: {
    vadEnabled?: boolean;
    isReviewMode?: boolean;
    apiEndpoint?: string;
    sessionToken?: string;
    onUserMessage?: (msg: Message, messageCount: number) => void;
    isGuest?: boolean;        // ADD: passed to Chat API as guestMode
    maxRounds?: number;       // ADD: overrides INTERVIEW_MAX_ROUNDS (default 20)
    maxDurationMs?: number;   // ADD: overrides INTERVIEW_MAX_MS (default 10 min)
} = {}) {
    const optionsRef = useRef(options);
    useEffect(() => { optionsRef.current = options; },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options.vadEnabled, options.isReviewMode, options.apiEndpoint, options.sessionToken, options.onUserMessage, options.isGuest, options.maxRounds, options.maxDurationMs]
    );

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);

    // Interview limits
    const [roundCount, setRoundCount] = useState(0);           // Number of completed AI response rounds
    const [interviewStartTime, setInterviewStartTime] = useState<number | null>(null); // Unix ms
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [limitReason, setLimitReason] = useState<'rounds' | 'time' | null>(null);

    const INTERVIEW_MAX_ROUNDS = options.maxRounds ?? 20;
    const INTERVIEW_MAX_MS = options.maxDurationMs ?? (10 * 60 * 1000);

    // Problem Context helper ref
    const currentProblemRef = useRef<ProblemContext | null>(null);
    const pendingAutoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Logic Refs
    const stateMachine = useRef(new InterviewStateMachine());
    const conversationHistoryRef = useRef<Message[]>([]);

    // ── STT provider selection ───────────────────────────────────────
    const whisperEnabled = useGlobalFeatureFlag('ENABLE_WHISPER_STT');

    // Call BOTH hooks unconditionally (React rules), pick the active one
    const whisperOptions = useMemo(() => ({ enabled: whisperEnabled }), [whisperEnabled]);
    const whisperInput = useWhisperInput(whisperOptions);

    const browserOptions = useMemo(() => ({ continuous: true, interimResults: true }), []);
    const browserInput = useVoiceInput(browserOptions);

    // Use Whisper if enabled AND supported, else browser STT
    const useWhisper = whisperEnabled && WhisperSTT.isSupported();
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        abortListening,
        resetTranscript,
        error: voiceError,
        lastResultTime,
        transcribeVADAudio
    } = useWhisper ? whisperInput : browserInput as any;

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

    // Voice Hooks
    const voiceOutputOptions = useRef({}).current; // Or useMemo(() => ({}), [])

    const {
        speak,
        pause: pauseSpeaking,
        resume: resumeSpeaking,
        stop: stopSpeaking,
        isSpeaking,
    } = useVoiceOutput(voiceOutputOptions);

    const isSpeakingRef = useRef(false);
    useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

    const isProcessingRef = useRef(false);
    useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

    // Time limit enforcement: check every 30 seconds
    useEffect(() => {
        if (!interviewStartTime || isLimitReached || state === 'idle' || state === 'completed') return;

        const interval = setInterval(() => {
            const elapsedMs = Date.now() - interviewStartTime;
            if (elapsedMs >= INTERVIEW_MAX_MS) {
                setIsLimitReached(true);
                setLimitReason('time');
                clearInterval(interval);
                // Stop mic and transition
                setIsMicEnabled(false);
                stopListening();
                stateMachine.current.transition('SUBMIT_SOLUTION');
                setState(stateMachine.current.getState());
            }
        }, 30_000);

        return () => clearInterval(interval);
    }, [interviewStartTime, isLimitReached, state, stopListening]);

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
                    problemContext,
                    companyPersona: problemContext.companyPersona,
                    kaiMemory: problemContext.kaiMemory,
                    problemId: problemContext.problemId,
                    sessionToken: optionsRef.current.sessionToken,
                    guestMode: optionsRef.current.isGuest ?? false,   // ADD THIS LINE
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

        const config: InterviewConfig = {
            problem: { title: problemContext.title, description: problemContext.content, difficulty: problemContext.difficulty || 'medium', id: problemContext.problemId || '' } as any,
            difficulty: problemContext.difficulty || 'medium',
            difficultyMode: problemContext.difficultyMode ?? 'practice',
            ragContext: problemContext.ragContext,
            kaiPersona: problemContext.companyPersona,
            kaiMemory: problemContext.kaiMemory,
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
    const [isMicEnabled, setIsMicEnabled] = useState(false);

    const isMicEnabledRef = useRef(false);
    useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);

    // Initial Start: Enable Mic
    // (Optional: If you want it to start automatically when interview starts)

    // Auto-Submit Logic
    useEffect(() => {
        if (!autoSubmitEnabled || !isListening || !transcript || isProcessing) return;

        const timeSinceLastResult = Date.now() - lastResultTime;
        if (timeSinceLastResult >= AUTO_SUBMIT_DELAY && currentProblemRef.current) {
            submitUserResponse(transcript, currentProblemRef.current);
        } else if (currentProblemRef.current) {
            const timer = setTimeout(() => {
                pendingAutoSubmitRef.current = null;
                if (isListening && transcript && currentProblemRef.current) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }, AUTO_SUBMIT_DELAY - timeSinceLastResult);
            pendingAutoSubmitRef.current = timer;
            return () => {
                clearTimeout(timer);
                pendingAutoSubmitRef.current = null;
            };
        }
    }, [transcript, lastResultTime, isListening, autoSubmitEnabled, isProcessing, submitUserResponse]);

    // Core Logic
    const startInterview = useCallback(async (
        problemTitle: string,
        problemContent: string,
        ragContext?: string,
        companyPersona?: string,
        kaiMemory?: string,
        problemId?: string,
        difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint',
        difficulty?: 'easy' | 'medium' | 'hard'
    ) => {
        // Reset state machine if restarting after completion
        if (stateMachine.current.getState() === 'completed') {
            stateMachine.current.reset();
        }
        // Reset conversation history for fresh interview
        conversationHistoryRef.current = [];
        setMessages([]);
        currentProblemRef.current = { title: problemTitle, content: problemContent, ragContext, companyPersona, kaiMemory, problemId, difficultyMode, difficulty };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        // Auto-enable mic on start if desired
        setIsMicEnabled(true);

        const config: InterviewConfig = {
            problem: { title: problemTitle, description: problemContent, difficulty: difficulty || 'medium', id: problemId || '' } as any,
            difficulty: difficulty || 'medium',
            difficultyMode: difficultyMode ?? 'practice',
            ragContext,
            kaiPersona: companyPersona,
            kaiMemory
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
                responseText = await callChatApi(introPrompt, sysPrompt, currentProblemRef.current);
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
            micResumeAttemptedRef.current = false;
            return;
        }

        // If User Manually Disabled Mic -> Ensure Stopped
        if (!isMicEnabled) {
            if (isListeningRef.current) stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        // CRITICAL: Stop mic when AI is processing (waiting for API)
        // OR when AI is speaking AND VAD is disabled (to prevent echo)
        const shouldStopForSpeaking = isSpeaking && !options.vadEnabled;

        if (shouldStopForSpeaking || isProcessing) {
            if (isListeningRef.current) {
                // ✅ Cancel any pending auto-submit to prevent race condition
                if (pendingAutoSubmitRef.current) {
                    clearTimeout(pendingAutoSubmitRef.current);
                    pendingAutoSubmitRef.current = null;
                }
                // Use abort to immediately cut off stream and discard partial inputs
                abortListening();
            }
            // Reset the resume flag when AI starts speaking/processing
            micResumeAttemptedRef.current = false;
            return; // Don't proceed to start logic
        }

        // Already listening — nothing to do. DO NOT reset the guard here.
        // The guard resets when AI starts speaking (the shouldStopForSpeaking branch).
        if (isListeningRef.current) {
            return;
        }

        // Mic is Enabled (Intent) AND (AI is silent OR VAD is enabled): Resume Mic
        // CRITICAL: Only attempt once per "AI finished" cycle to prevent loop
        if (!isListeningRef.current && !micResumeAttemptedRef.current && !micPausedForSilenceRef.current) {
            micResumeAttemptedRef.current = true; // Mark that we're attempting

            // Delay to ensure audio is fully cleared and prevent "Self-Hearing" loops
            const timer = setTimeout(() => {
                // Read from refs — these are always current
                const currentlyListening = isListeningRef.current;
                const currentlySpeaking = isSpeakingRef.current;
                const currentlyProcessing = isProcessingRef.current;
                const micStillEnabled = isMicEnabledRef.current;

                const stillShouldStop = (currentlySpeaking && !options.vadEnabled) || currentlyProcessing;
                if (micStillEnabled && !stillShouldStop && !currentlyListening) {
                    // CRITICAL: Reset transcript before resuming to prevent carryover
                    resetTranscript();
                    startListening();
                }
            }, 350); // Reduced from 1500ms — 350ms is sufficient for TTS audio drain
            return () => clearTimeout(timer);
        }
    }, [isSpeaking, isProcessing, startListening, stopListening, abortListening, state, isMicEnabled, resetTranscript, options.vadEnabled]);

    // Reset micResumeAttemptedRef once we confirm mic is actually live
    useEffect(() => {
        if (isListening) {
            micResumeAttemptedRef.current = false;
        }
    }, [isListening]);

    // 7-SECOND SILENCE TIMEOUT: Auto-stop mic if no voice detected for 7 seconds
    // DISBLED IF VAD IS ACTIVE: We want continuous listening for interruptions
    useEffect(() => {
        if (!isListening || !isMicEnabled || options.vadEnabled) return;

        const SILENCE_TIMEOUT = 7000; // 7 seconds

        const checkSilence = setInterval(() => {
            if (lastResultTime === 0) return;
            const timeSinceLastResult = Date.now() - lastResultTime;
            if (timeSinceLastResult >= SILENCE_TIMEOUT && !transcript && !interimTranscript) {
                // Soft stop: just stop listening for now, don't disable the intent
                // The mic sync effect will restart it when conditions are right
                stopListening();
                // DON'T call setIsMicEnabled(false)
                // Instead, set a "paused for silence" ref to prevent immediate restart:
                micPausedForSilenceRef.current = true;
                setTimeout(() => { micPausedForSilenceRef.current = false; }, 3000); // 3s before auto-restart allowed
            }
        }, 1000);

        return () => clearInterval(checkSilence);
    }, [isListening, isMicEnabled, lastResultTime, transcript, interimTranscript, options.vadEnabled, stopListening]);

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

            // Track analytics
            trackInterruption(
                sessionIdRef.current,
                partial.length,
                lastAiMsg.content.length,
            );

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
            },
            stopListening: () => {
                setIsMicEnabled(false);
                setOptimisticListening(false);
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

