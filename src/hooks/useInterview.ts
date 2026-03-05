/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import {
    generateSystemPrompt,
    generateTurnPrompt,
    generateInterviewOpeningTrigger,
    GUEST_INTRO_TEXT,
    MAX_USER_INPUT,
    type SystemPromptOptions,
} from '@/lib/interview/prompts';
import { useTTS } from '@/hooks/useTTS';
import { useSTT } from '@/hooks/useSTT';
import { useVAD } from '@/hooks/useVAD';
import type { InterviewConfig } from '@/lib/interview/interview-config';
import type { KaiMemoryStructured } from '@/types/kai-memory';
import type { Problem } from '@/types/problem';
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
    difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint' | 'employer';
    language?: string;
    optimalApproach?: string;
    sprintProblemIndex?: 0 | 1;
    secondProblem?: Pick<Problem, 'title' | 'content' | 'description' | 'difficulty'>;
}

export function useInterview(options: {
    config: InterviewConfig;
    isTimeUp?: boolean;
    turnsRemaining?: number;
    timeRemaining?: number;
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
        [options.config, options.isTimeUp, options.turnsRemaining, options.timeRemaining, options.voicePrefs, options.isReviewMode, options.apiEndpoint, options.sessionToken, options.onUserMessage, options.isGuest]
    );

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
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
    const [voiceError, setVoiceError] = useState<Error | null>(null);
    const [micStoppedManually, setMicStoppedManually] = useState(false);
    const [sendCountdown, setSendCountdown] = useState<number | null>(null);
    const [ttsError, setTtsError] = useState(false);

    // Smart pause: refs for interruption detection during AI speech
    const smartPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const smartPauseActiveRef = useRef(false);
    const currentAiTextRef = useRef('');
    // Send countdown interval ref
    const sendCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Derived: is mic "logically enabled" (for backward compat)
    const isMicEnabled = micIntent === 'user-on' || micIntent === 'auto-on';

    // ── STT & TTS ───────────────────────────────────────
    // Pass defaultValue=true so sttProvider='whisper' from the FIRST render.
    // Without this, useGlobalFeatureFlag defaults to false, causing
    // sttProvider='browser' → resolvedProvider='browser' → transcribeAudio silently skips.
    const whisperEnabled = useGlobalFeatureFlag('ENABLE_WHISPER_STT', true);

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
        // onSpeakStart/onSpeakEnd are ONLY used for reactive state — NOT for mic gating.
        // Mic gating is now done explicitly in startInterview/submitUserResponse via await.
        onSpeakStart: () => {
        },
        onSpeakEnd: () => {
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
        // Phase 0d: onSilenceTimeout no longer kills mic — just a no-op
        onSilenceTimeout: () => {},
        onError: (err) => setVoiceError(new Error(err)),
    });

    // Phase 3c: VAD enabled based on sttProvider, not guest mode or difficultyMode
    const vad = useVAD({
        enabled: sttProvider === 'whisper',
        onSpeechStart: () => {
            // Smart pause: if AI is speaking and VAD detects human voice → interrupt
            if (isSpeakingRef.current) {
                tts.stop();
                smartPauseActiveRef.current = true;
                // 1.5s grace timer: if user goes silent, activate mic normally
                if (smartPauseTimerRef.current) clearTimeout(smartPauseTimerRef.current);
                smartPauseTimerRef.current = setTimeout(() => {
                    if (smartPauseActiveRef.current) {
                        smartPauseActiveRef.current = false;
                        setMicStoppedManually(false);
                        setMicIntent('auto-on');
                    }
                }, 1500);
            }
        },
        onSpeechEnd: (audio) => {
            // A1 fix: Echo guard — reject VAD events while AI is speaking
            if (isSpeakingRef.current) {
                return;
            }
            // If smart pause was active, cancel grace timer — user actually spoke
            if (smartPauseActiveRef.current) {
                smartPauseActiveRef.current = false;
                if (smartPauseTimerRef.current) {
                    clearTimeout(smartPauseTimerRef.current);
                    smartPauseTimerRef.current = null;
                }
                setMicStoppedManually(false);
                setMicIntent('auto-on');
            }
            stt.transcribeAudio(audio);
        },
        onFallback: () => {
            console.warn('[useInterview] VAD failed, cascading to browser STT');
            setVadFailed(true);
        },
    });

    // Legacy aliases
    const isSpeaking = tts.isSpeaking;
    const speak = tts.speak;
    const speakAndWait = tts.speakAndWait;
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

    // ── Stable refs for values read inside timers / effects ──────────
    // Synchronous updates during render — eliminates 1-render-cycle lag
    // that caused duplicate mic starts (mic sync checked stale ref before
    // the useEffect could propagate the new value).
    const isListeningRef = useRef(false);
    isListeningRef.current = isListening;

    const isSpeakingRef = useRef(false);
    isSpeakingRef.current = isSpeaking;

    const isProcessingRef = useRef(false);
    isProcessingRef.current = isProcessing;

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

    // A1 fix: message deduplication — track last user message for 3s window
    const lastUserMsgRef = useRef<{ text: string; time: number } | null>(null);

    const submitUserResponse = useCallback(async (userText: string, problemContext: ProblemContext) => {
        if (stateMachine.current.getState() === 'completed') return;
        if (!userText.trim()) return;
        const safeUserText = userText.slice(0, MAX_USER_INPUT);

        // A1 fix: Deduplication — skip if identical message within 3 seconds
        const now = Date.now();
        if (lastUserMsgRef.current &&
            lastUserMsgRef.current.text === safeUserText.trim() &&
            now - lastUserMsgRef.current.time < 3000) {
            console.log('[useInterview] Duplicate message blocked (within 3s window)');
            return;
        }
        lastUserMsgRef.current = { text: safeUserText.trim(), time: now };

        // A1 fix: Reset ttsError at start of each submission
        setTtsError(false);

        // A1 fix: Cancel any active smart pause timer
        if (smartPauseTimerRef.current) {
            clearTimeout(smartPauseTimerRef.current);
            smartPauseTimerRef.current = null;
        }
        smartPauseActiveRef.current = false;

        // Stop mic and VAD for processing
        stopListening();
        setMicIntent('paused-for-ai');
        setMicStoppedManually(false);
        setSendCountdown(null);

        const userMsg: Message = { id: generateMessageId(), role: 'user', content: safeUserText, timestamp: new Date(), status: 'complete' };
        addMessage(userMsg);

        if (optionsRef.current.onUserMessage) {
            optionsRef.current.onUserMessage(userMsg, conversationHistoryRef.current.length);
        }
        resetTranscript();

        setIsProcessing(true);
        stateMachine.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachine.current.getState());

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
            transcript: safeUserText,
            interruptionContext: interruptionCtx,
            turnsRemaining: optionsRef.current.turnsRemaining,
            timeRemaining: optionsRef.current.timeRemaining,
        });

        // Rebuild system prompt every turn so turnsRemaining / timeRemaining are current
        const currentSysPrompt = generateSystemPrompt({
            problem: {
                id: currentProblemRef.current?.problemId ?? '',
                title: currentProblemRef.current?.title ?? '',
                content: currentProblemRef.current?.content ?? '',
                description: currentProblemRef.current?.content ?? '',
                difficulty: (currentProblemRef.current?.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
            } as Problem,
            difficulty: (currentProblemRef.current?.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
            difficultyMode: currentProblemRef.current?.difficultyMode as SystemPromptOptions['difficultyMode'],
            ragContext: currentProblemRef.current?.ragContext ?? '',
            kaiMemory: currentProblemRef.current?.kaiMemory ?? '',
            kaiMemoryStructured: optionsRef.current.config.kaiMemoryStructured ?? undefined,
            language: currentProblemRef.current?.language,
            optimalApproach: currentProblemRef.current?.optimalApproach,
            turnsRemaining: optionsRef.current.turnsRemaining,
            timeRemaining: optionsRef.current.timeRemaining,
            isGuest: optionsRef.current.isGuest ?? false,
            sprintProblemIndex: currentProblemRef.current?.sprintProblemIndex ?? 0,
            secondProblem: currentProblemRef.current?.secondProblem,
        });

        try {
            const responseText = await callChatApi(prompt, currentSysPrompt, problemContext);

            // Step 1i: TERMINATE_INTERVIEW token detection
            if (typeof responseText === 'string' && responseText.includes('TERMINATE_INTERVIEW')) {
                const cleanResponse = responseText.replace('TERMINATE_INTERVIEW', '').trim();
                const aiMsg: Message = {
                    id: generateMessageId(),
                    role: 'assistant',
                    content: cleanResponse,
                    timestamp: new Date(),
                    status: 'complete',
                };
                addMessage(aiMsg);
                setIsProcessing(false);
                setMicIntent('off');
                stopListening();
                stateMachine.current.transition('TERMINATE_INTERVIEW' as any);
                setState(stateMachine.current.getState());
                return;
            }

            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            addMessage(aiMsg);
            // A1 fix: setIsProcessing(false) MOVED to after speakAndWait
            // Previously fired here before TTS, allowing auto-submit during playback

            // Serial TTS: await full speech completion, then activate mic
            console.log(`[submitUserResponse] Speaking AI reply (serial), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;
            const ttsOk = await speakAndWait(responseText, 3);
            if (!ttsOk) {
                setTtsError(true);
                console.error('[submitUserResponse] TTS failed after 3 retries');
            }

            // A1 fix: Cancel smartPauseTimer after TTS completes
            if (smartPauseTimerRef.current) {
                clearTimeout(smartPauseTimerRef.current);
                smartPauseTimerRef.current = null;
            }

            // A1 fix: NOW set isProcessing false — after TTS is done
            setIsProcessing(false);

            // TTS done (or interrupted by smart pause) → activate mic
            setMicStoppedManually(false);
            setMicIntent('auto-on');

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
            setIsProcessing(false);
            // Even on error, activate mic so user can try again
            setMicStoppedManually(false);
            setMicIntent('auto-on');
        }
    }, [stopListening, addMessage, resetTranscript, callChatApi, speakAndWait, roundCount, interviewStartTime]);

    // Phase 2e: Auto-Submit on silence — submit accumulated transcript after 5s of no new speech.
    // Only active when mic is on (not manually stopped). Works alongside the manual Send button.
    useEffect(() => {
        if (!transcript.trim()) return;
        if (state === 'idle' || state === 'completed') return;
        if (isProcessing || isSpeaking) return;
        // Only auto-submit on silence when mic is actively listening (not manually stopped)
        if (micStoppedManually) return;

        const timer = setTimeout(() => {
            const text = transcriptRef.current.trim();
            if (text && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                console.log(`[useInterview] Auto-submit after 5s silence: "${text.substring(0, 60)}..."`);
                submitUserResponse(text, currentProblemRef.current);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [transcript, state, isProcessing, isSpeaking, micStoppedManually, submitUserResponse]);

    // Send countdown: when mic is manually stopped and transcript exists, start 5s countdown
    useEffect(() => {
        // Clear any existing countdown interval
        if (sendCountdownIntervalRef.current) {
            clearInterval(sendCountdownIntervalRef.current);
            sendCountdownIntervalRef.current = null;
        }

        if (!micStoppedManually || !transcript.trim() || state === 'idle' || state === 'completed' || isProcessing || isSpeaking) {
            setSendCountdown(null);
            return;
        }

        // Start 5s countdown
        setSendCountdown(5);
        sendCountdownIntervalRef.current = setInterval(() => {
            setSendCountdown(prev => {
                if (prev === null || prev <= 1) {
                    // Auto-send when countdown reaches 0
                    if (sendCountdownIntervalRef.current) {
                        clearInterval(sendCountdownIntervalRef.current);
                        sendCountdownIntervalRef.current = null;
                    }
                    const text = transcriptRef.current.trim();
                    // A1 fix: Also guard on isSpeakingRef to prevent send during TTS
                    if (text && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                        console.log(`[useInterview] Send countdown expired, auto-submitting: "${text.substring(0, 60)}..."`);
                        submitUserResponse(text, currentProblemRef.current);
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (sendCountdownIntervalRef.current) {
                clearInterval(sendCountdownIntervalRef.current);
                sendCountdownIntervalRef.current = null;
            }
        };
    }, [micStoppedManually, transcript, state, isProcessing, isSpeaking, submitUserResponse]);

    // Core Logic
    const startInterview = useCallback(async (opts: {
        problemTitle: string;
        problemContent: string;
        ragContext?: string;
        kaiMemory?: string;
        problemId?: string;
        difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint' | 'employer';
        difficulty?: 'easy' | 'medium' | 'hard';
        kaiMemoryStructured?: KaiMemoryStructured | null;
        language?: string;
        optimalApproach?: string;
        sprintProblemIndex?: 0 | 1;
        secondProblem?: Pick<Problem, 'title' | 'content' | 'description' | 'difficulty'>;
    }) => {
        const { problemTitle, problemContent, ragContext, kaiMemory, problemId, difficultyMode, difficulty, kaiMemoryStructured } = opts;

        if (stateMachine.current.getState() === 'completed') {
            stateMachine.current.reset();
        }
        conversationHistoryRef.current = [];
        setMessages([]);
        resetTranscript();
        currentProblemRef.current = {
            title: problemTitle,
            content: problemContent,
            ragContext,
            kaiMemory,
            problemId,
            difficultyMode: optionsRef.current.isGuest ? 'practice' : (difficultyMode ?? 'practice'),
            difficulty,
            language: opts.language,
            optimalApproach: opts.optimalApproach,
            sprintProblemIndex: opts.sprintProblemIndex ?? 0,
            secondProblem: opts.secondProblem,
        };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        // Phase 2a: Start paused — onSpeakEnd will transition to 'auto-on' when intro TTS finishes.
        // Never set 'auto-on' here: setIsProcessing(false) runs in finally while TTS is still
        // starting, creating a gap where mic+VAD activates while AI is speaking.
        setMicIntent('paused-for-ai');

        const sysPrompt = generateSystemPrompt({
            problem: {
                id: problemId ?? '',
                title: problemTitle,
                content: problemContent,
                description: problemContent,
                difficulty: (difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
            } as Problem,
            difficulty: (difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
            difficultyMode: optionsRef.current.isGuest
                ? 'practice'
                : (difficultyMode ?? 'practice') as SystemPromptOptions['difficultyMode'],
            ragContext: ragContext ?? '',
            kaiMemory: kaiMemory ?? '',
            kaiMemoryStructured: kaiMemoryStructured ?? undefined,
            language: opts.language,
            optimalApproach: opts.optimalApproach,
            turnsRemaining: optionsRef.current.turnsRemaining,
            timeRemaining: optionsRef.current.timeRemaining,
            isGuest: optionsRef.current.isGuest ?? false,
            sprintProblemIndex: opts.sprintProblemIndex ?? 0,
            secondProblem: opts.secondProblem,
        });

        const introTrigger = generateInterviewOpeningTrigger(
            problemTitle,
            optionsRef.current.isGuest ? 'practice' : (difficultyMode ?? 'practice')
        );

        setRoundCount(0);
        setInterviewStartTime(Date.now());
        setIsLimitReached(false);
        setLimitReason(null);

        setIsProcessing(true);
        try {
            // ── Guest intro — system-injected, Kai never generates this ──────────────
            if (optionsRef.current.isGuest) {
                const guestIntroMsg: Message = {
                    id: generateMessageId(),
                    role: 'assistant',
                    content: GUEST_INTRO_TEXT,
                    timestamp: new Date(),
                    status: 'complete',
                };
                addMessage(guestIntroMsg);
                const guestTtsOk = await speakAndWait(GUEST_INTRO_TEXT, 3);
                if (!guestTtsOk) {
                    console.warn('[startInterview] Guest intro TTS failed — message shown in chat.');
                }
                // Brief pause between intro and Kai's first problem presentation
                await new Promise(resolve => setTimeout(resolve, 600));
            }
            // ── End guest intro ──────────────────────────────────────────────────────

            let responseText = '';
            if (optionsRef.current.isReviewMode) {
                responseText = `Let's review ${problemTitle} which you've seen before. Without looking at your previous solution, explain your approach to this problem.`;
            } else {
                responseText = await callChatApi(introTrigger, sysPrompt, currentProblemRef.current!);
            }
            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            addMessage(aiMsg);
            // A1 fix: setIsProcessing(false) MOVED to after speakAndWait

            // Serial TTS: await full speech completion, then activate mic
            console.log(`[startInterview] Speaking intro (serial), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;
            const ttsOk = await speakAndWait(responseText, 3);
            if (!ttsOk) {
                setTtsError(true);
                console.error('[startInterview] TTS failed after 3 retries');
            }

            // A1 fix: NOW set isProcessing false — after TTS is done
            setIsProcessing(false);

            // TTS done → activate mic and VAD
            setMicStoppedManually(false);
            setMicIntent('auto-on');

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch {
            addMessage({ id: generateMessageId(), role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date(), status: 'complete' });
            setIsProcessing(false);
            // Even on error, activate mic
            setMicStoppedManually(false);
            setMicIntent('auto-on');
        }
    }, [callChatApi, addMessage, speakAndWait]);


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

    // Test Hook: Expose trigger for Playwright (secured)
    useEffect(() => {
        const testHooksEnabled =
            process.env.NODE_ENV !== 'production' &&
            process.env.NEXT_PUBLIC_ENABLE_TEST_HOOKS === 'true';

        if (typeof window !== 'undefined' && testHooksEnabled) {
            (window as any).__TRIGGER_AI_CALL__ = (message: string) => {
                const safeMsg = message.slice(0, MAX_USER_INPUT);
                submitUserResponse(safeMsg, currentProblemRef.current || { title: 'Test', content: 'Test' });
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
                    // NOTE: Don't call resetTranscript() here — it clears valid accumulated
                    // transcript on every mic restart. Transcript is correctly reset in
                    // submitUserResponse() and startInterview() when appropriate.
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
        setMicStoppedManually(false);
        setSendCountdown(null);
        setTtsError(false);
        stopListening();
        setRoundCount(0);
        setInterviewStartTime(null);
        setIsLimitReached(false);
        setLimitReason(null);
        // Clear smart pause timer
        if (smartPauseTimerRef.current) { clearTimeout(smartPauseTimerRef.current); smartPauseTimerRef.current = null; }
        smartPauseActiveRef.current = false;
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
    }, [resetTranscript, stopListening]);

    const toggleMic = useCallback(() => {
        setMicIntent(prev => {
            if (prev === 'user-on' || prev === 'auto-on') {
                // User is stopping the mic manually
                setMicStoppedManually(true);
                return 'off';
            }
            // User is resuming the mic — cancel any send countdown
            setMicStoppedManually(false);
            setSendCountdown(null);
            return 'user-on';
        });
    }, []);

    // ── Session ID for analytics ─────────────────────────────────
    const _sessionIdRef = useRef<string>(generateMessageId());

    // ── Handle interruption: capture partial content ─────────────
    const handleInterruption = useCallback((spokenContent?: string) => {
        // Immediately re-enable mic — user explicitly stopped Kai
        setMicStoppedManually(false);
        setMicIntent('auto-on');
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

    // A3: Coding state management — pause mic & auto-submit when user switches to code tab
    const enterCodingMode = useCallback(() => {
        stateMachine.current.transition('USER_STARTED_CODING');
        setState(stateMachine.current.getState());
        // Pause mic so voice doesn't interfere while coding
        setMicIntent('off');
        stopListening();
        // Clear any pending auto-submit
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
        setSendCountdown(null);
    }, [stopListening]);

    const exitCodingMode = useCallback(() => {
        stateMachine.current.transition('USER_STOPPED_CODING');
        setState(stateMachine.current.getState());
        // Resume mic
        setMicIntent('user-on');
        setMicStoppedManually(false);
    }, []);

    const shareCode = useCallback((code: string) => {
        stateMachine.current.transition('USER_SHARED_CODE');
        setState(stateMachine.current.getState());
        // Resume mic after sharing
        setMicIntent('user-on');
        setMicStoppedManually(false);
    }, []);

    const endInterview = useCallback(() => {
        if (roundCount < 1) return;
        setMicIntent('off');
        setMicStoppedManually(false);
        setSendCountdown(null);
        stopListening();
        stopSpeaking();
        // A2 fix: Kill the raw hardware MediaStream so Chrome mic indicator disappears
        if (stt.mediaStreamRef?.current) {
            stt.mediaStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            stt.mediaStreamRef.current = null;
        }
        // Clear smart pause & countdown timers
        if (smartPauseTimerRef.current) { clearTimeout(smartPauseTimerRef.current); smartPauseTimerRef.current = null; }
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
        stateMachine.current.transition('SUBMIT_SOLUTION');
        setState(stateMachine.current.getState());
    }, [roundCount, stopListening, stopSpeaking, stt.mediaStreamRef]);

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
        isMicEnabled,
        micIntent,
        micStoppedManually,
        sendCountdown,
        ttsError,
        vadFailed,
        isPushToTalk: vadFailed || sttProvider === 'browser',
        enterCodingMode,
        exitCodingMode,
        shareCode,
        ttsProvider: tts.provider,
        sttProvider,
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
            isListening,
            transcript,
            interimTranscript,
            startListening: () => {
                // Don't start mic while AI is speaking — would cause feedback/echo into VAD
                if (isSpeaking) return;
                setMicIntent('user-on');
                setMicStoppedManually(false);
                setSendCountdown(null);
                // Mic sync effect will handle actual hardware start
            },
            stopListening: () => {
                setMicIntent('off');
                setMicStoppedManually(true);
                // Mic sync effect will handle actual hardware stop
            },
            toggleMic,
            isMicEnabled,
            isSpeaking,
            speak,
            stopSpeaking,
            error: voiceError,
            permissionState: stt.permissionState,
            sttResolvedProvider: stt.resolvedProvider,
        }
    };
}
