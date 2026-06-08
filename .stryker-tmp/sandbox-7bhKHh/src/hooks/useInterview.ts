/**
 * @codesage
 * @file      src/hooks/useInterview.ts
 * @purpose   Monolithic React hook handling the entire AI interview session logic, state machine, and audio coordination.
 * @tech      React, Fetch API
 * @connects  Imports TTS, STT, VAD hooks and state machine; Used by InterviewSession
 * @apis      POST /api/chat
 * @db        none
 * @state     Complex state: round limits, voice recording intents, message history, SSE stream accumulation
 * @env       NODE_ENV, ENABLE_WHISPER_STT
 * @issues    Very large file (1300+ lines); appears to duplicate logic with useInterviewControl / useInterviewApi / etc.
 * @audit     CODESAGE-v1
 * 
 * @section   Reducers
 * Handles round and voice states via useReducer.
 * 
 * @section   Audio Pipeline
 * Orchestrates useSTT, useTTS, and useVAD hooks.
 * 
 * @section   Chat API & Message Management
 * Manages streaming response (SSE) and conversation history tracking.
 */
// @ts-nocheck

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useReducer } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// Reducer: round / limit state
// Consolidates 4 useState calls (roundCount, interviewStartTime,
// isLimitReached, limitReason) so that setting the limit doesn't trigger
// an extra render from the limitReason setter.
// ──────────────────────────────────────────────────────────────────────────
type RoundState = {
    count: number;
    isLimitReached: boolean;
    limitReason: 'rounds' | 'time' | null;
    startTime: number | null;
};

type RoundAction =
    | { type: 'INCREMENT' }
    | { type: 'SET_COUNT'; value: number }
    | { type: 'SET_LIMIT'; reason: 'rounds' | 'time' }
    | { type: 'CLEAR_LIMIT' }
    | { type: 'SET_START_TIME'; time: number | null }
    | { type: 'RESET' };

const INITIAL_ROUND_STATE: RoundState = {
    count: 0,
    isLimitReached: false,
    limitReason: null,
    startTime: null,
};

function roundReducer(state: RoundState, action: RoundAction): RoundState {
    switch (action.type) {
        case 'INCREMENT':       return { ...state, count: state.count + 1 };
        case 'SET_COUNT':       return { ...state, count: action.value };
        case 'SET_LIMIT':       return { ...state, isLimitReached: true, limitReason: action.reason };
        case 'CLEAR_LIMIT':     return { ...state, isLimitReached: false, limitReason: null };
        case 'SET_START_TIME':  return { ...state, startTime: action.time };
        case 'RESET':           return INITIAL_ROUND_STATE;
        default:                return state;
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Reducer: voice / VAD state
// Consolidates 6 useState calls so that a single voice-layer event (e.g.
// VAD probability tick) doesn't cascade through many individual setters.
// ──────────────────────────────────────────────────────────────────────────
type VoiceState = {
    error: Error | null;
    micActivating: boolean;
    vadFailed: boolean;
    vadSpeechProbability: number;
    emptyTranscriptFeedback: boolean;
    ttsError: boolean;
};

type VoiceAction =
    | { type: 'SET_ERROR'; error: Error | null }
    | { type: 'CLEAR_ERROR' }
    | { type: 'SET_MIC_ACTIVATING'; value: boolean }
    | { type: 'SET_VAD_FAILED'; value: boolean }
    | { type: 'SET_VAD_PROBABILITY'; value: number }
    | { type: 'SET_EMPTY_FEEDBACK'; value: boolean }
    | { type: 'SET_TTS_ERROR'; value: boolean };

const INITIAL_VOICE_STATE: VoiceState = {
    error: null,
    micActivating: false,
    vadFailed: false,
    vadSpeechProbability: 0,
    emptyTranscriptFeedback: false,
    ttsError: false,
};

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
    switch (action.type) {
        case 'SET_ERROR':           return { ...state, error: action.error };
        case 'CLEAR_ERROR':         return { ...state, error: null };
        case 'SET_MIC_ACTIVATING':  return { ...state, micActivating: action.value };
        case 'SET_VAD_FAILED':      return { ...state, vadFailed: action.value };
        case 'SET_VAD_PROBABILITY': return { ...state, vadSpeechProbability: action.value };
        case 'SET_EMPTY_FEEDBACK':  return { ...state, emptyTranscriptFeedback: action.value };
        case 'SET_TTS_ERROR':       return { ...state, ttsError: action.value };
        default:                    return state;
    }
}
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
import { toast } from 'sonner';

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
    status?: 'streaming' | 'complete' | 'interrupted' | 'cancelled';
    /** What the AI said before the user interrupted (subset of content). */
    partialContent?: string;
    /** Unix timestamp of when the interruption occurred. */
    interruptedAt?: number;
}

// Phase 2a: micIntent state machine replaces boolean isMicEnabled
export type MicIntent = 'user-on' | 'auto-on' | 'paused-for-ai' | 'off';

export interface ProblemContext {
    problemTitle: string;
    problemContent: string;
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

export interface UseInterviewOptions {
    config: InterviewConfig;
    isTimeUp?: boolean;
    turnsRemaining?: number;
    timeRemaining?: number;
    voicePrefs?: { name: string | null; rate: number; pitch: number };
    userTtsProvider?: 'auto' | 'polly' | 'browser';
    isReviewMode?: boolean;
    apiEndpoint?: string;
    sessionToken?: string;
    onUserMessage?: (msg: Message, count: number) => void;
    isGuest?: boolean;
}

export function useInterview(options: UseInterviewOptions) {
    const optionsRef = useRef(options);
    useEffect(() => { optionsRef.current = options; },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options.config, options.isTimeUp, options.turnsRemaining, options.timeRemaining, options.voicePrefs, options.userTtsProvider, options.isReviewMode, options.apiEndpoint, options.sessionToken, options.onUserMessage, options.isGuest]
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

    const vadLastUpdateRef = useRef<number>(0);

    // Interview limits — consolidated into a single reducer.
    const [roundState, dispatchRound] = useReducer(roundReducer, INITIAL_ROUND_STATE);
    const roundCount = roundState.count;
    const interviewStartTime = roundState.startTime;
    const isLimitReached = roundState.isLimitReached;
    const limitReason = roundState.limitReason;

    const INTERVIEW_MAX_ROUNDS = options.config.maxTurnsPerProblem;
    const INTERVIEW_MAX_MS = options.config.maxDurationMs;

    // Problem Context helper ref
    const currentProblemRef = useRef<ProblemContext | null>(null);

    // Logic Refs
    const stateMachine = useRef(new InterviewStateMachine());
    const conversationHistoryRef = useRef<Message[]>([]);

    // ── Phase 2a: micIntent state machine ──────────────────────────
    const [micIntent, setMicIntent] = useState<MicIntent>('off');
    const [micStoppedManually, setMicStoppedManually] = useState(false);
    const [sendCountdown, setSendCountdown] = useState<number | null>(null);

    // Voice / VAD state — consolidated into a single reducer (see voiceReducer above).
    const [voiceState, dispatchVoice] = useReducer(voiceReducer, INITIAL_VOICE_STATE);
    const voiceError = voiceState.error;
    const micActivating = voiceState.micActivating;
    const vadFailed = voiceState.vadFailed;
    const vadSpeechProbability = voiceState.vadSpeechProbability;
    const emptyTranscriptFeedback = voiceState.emptyTranscriptFeedback;
    const ttsError = voiceState.ttsError;

    // Smart pause: refs for interruption detection during AI speech
    const smartPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const smartPauseActiveRef = useRef(false);
    const currentAiTextRef = useRef('');
    // A1: Tracks whether onSpeechStart interrupted TTS for this segment.
    // When true, onSpeechEnd must NOT discard the audio — the echo guard
    // only applies when AI audio is still playing AND we didn't stop it for the user.
    const speechInterruptedTTSRef = useRef(false);
    // A2/A4/A7: micActivating, emptyTranscriptFeedback, vadSpeechProbability
    // are now part of voiceState above (voiceReducer). The aliases defined
    // alongside voiceState preserve read-site compatibility.

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
    // (`vadFailed` alias is declared above alongside voiceState).

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
        userTtsProvider: optionsRef.current.userTtsProvider ?? 'auto',
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
        onSilenceTimeout: () => { },
        onError: (err) => dispatchVoice({ type: 'SET_ERROR', error: new Error(err) }),
        // A4: Show brief "Didn't catch that" feedback on empty transcription.
        onEmpty: () => {
            dispatchVoice({ type: 'SET_EMPTY_FEEDBACK', value: true });
            setTimeout(() => dispatchVoice({ type: 'SET_EMPTY_FEEDBACK', value: false }), 2500);
        },
    });

    // Phase 3c: VAD enabled based on sttProvider, not guest mode or difficultyMode
    const vad = useVAD({
        enabled: sttProvider === 'whisper',
        onSpeechStart: () => {
            // Smart pause: if AI is speaking and VAD detects human voice → interrupt
            if (isSpeakingRef.current) {
                tts.stop();
                // A1: Mark that we stopped TTS for this speech segment so onSpeechEnd
                // knows not to discard the audio (isSpeakingRef may still be stale-true).
                speechInterruptedTTSRef.current = true;
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
            // A1 fix: Echo guard — reject VAD audio only if AI is STILL speaking AND
            // we did NOT interrupt TTS for this speech segment. The stale-ref race
            // (isSpeakingRef still true a render cycle after tts.stop()) is resolved
            // by speechInterruptedTTSRef which is set synchronously in onSpeechStart.
            if (isSpeakingRef.current && !speechInterruptedTTSRef.current) {
                return;
            }
            speechInterruptedTTSRef.current = false; // Reset for next segment
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
        onFrameProcessed: (prob: number) => {
            const now = Date.now();
            if (now - vadLastUpdateRef.current > 66) { // ~15 fps
                dispatchVoice({ type: 'SET_VAD_PROBABILITY', value: prob });
                vadLastUpdateRef.current = now;
            }
        },
        onFallback: () => {
            console.warn('[useInterview] VAD failed, cascading to browser STT');
            dispatchVoice({ type: 'SET_VAD_FAILED', value: true });
            // A3: Notify user that voice detection degraded — they need to click mic.
            toast.warning('Voice detection unavailable', {
                description: 'Click the mic button to speak instead.',
                duration: 5000,
            });
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
    //  -- automated unused local suppression
    const _abortListening = stt.stopListening;
    const resetTranscript = useCallback(() => {
        transcriptRef.current = ''; // Imperative sync — no render lag
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

    // Sync ref so in-flight async code can read time-up state synchronously
    const timeUpRef = useRef(false);
    timeUpRef.current = !!options.isTimeUp;

    // Ref to break forward-reference cycle: submitUserResponse is defined later
    const submitUserResponseRef = useRef<((text: string, ctx: ProblemContext) => Promise<void>) | null>(null);
    // Prevent concurrent submit paths (manual send + auto-send + time-up) from racing.
    const submitInFlightRef = useRef(false);
    // AbortController for the in-flight /api/chat request — lets handleInterruption cancel it.
    const chatAbortRef = useRef<AbortController | null>(null);

    // Time limit enforcement: tied strictly to global UI hook
    useEffect(() => {
        if (!options.isTimeUp) return;
        if (isLimitReached || state === 'idle' || state === 'completed') return;

        // If there's unsent voice transcript, auto-send it before ending.
        // submitUserResponse will detect timeUpRef and skip TTS after AI replies.
        const pendingText = transcriptRef.current.trim();
        if (pendingText && currentProblemRef.current && !isProcessingRef.current && !submitInFlightRef.current && submitUserResponseRef.current) {
            // Auto-send the pending transcript — the post-turn check will end the session
            void submitUserResponseRef.current(pendingText, currentProblemRef.current);
            return; // submitUserResponse will handle limit after AI responds
        }

        dispatchRound({ type: 'SET_LIMIT', reason: 'time' });
        setMicIntent('off');
        stopListening();
        stateMachine.current.transition('SUBMIT_SOLUTION');
        setState(stateMachine.current.getState());
    }, [options.isTimeUp, isLimitReached, state, stopListening]);

    //  -- automated unused local suppression
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
                // Never retry an aborted request — user cancelled it intentionally.
                if (error instanceof Error && error.name === 'AbortError') throw error;
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

    /**
     * Call /api/chat with SSE streaming (Accept: text/event-stream).
     * When `streamingMessageId` is provided, incrementally updates the message
     * with `id === streamingMessageId` in `messages[]` as chunks arrive.
     * Falls back to JSON if server returns non-SSE content type.
     */
    const callChatApi = useCallback(async (
        prompt: string,
        _systemPrompt: string,
        _problemContext: ProblemContext,
        streamingMessageId?: string,
    ): Promise<string> => {
        const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
        const requestBody = JSON.stringify({
            messages: [
                ...conversationHistoryRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: prompt }
            ],
            problemContext: {
                title: currentProblemRef.current?.problemTitle ?? '',
                content: currentProblemRef.current?.problemContent ?? '',
                ragContext: optionsRef.current.config.ragContext,
                tags: (currentProblemRef.current as any)?.tags ?? [],
            },
            sessionToken: optionsRef.current.sessionToken,
            guestMode: optionsRef.current.isGuest ?? false,
            interviewState: stateMachine.current.getState(),
        });

        // Abort any prior in-flight chat request before starting a new one.
        chatAbortRef.current?.abort();
        const controller = new AbortController();
        chatAbortRef.current = controller;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: requestBody,
                signal: controller.signal,
            });

            if (!response.ok) {
                const err = (await response.json().catch(() => ({ error: 'Failed to fetch chat response' }))) as { error?: string };
                throw new Error(err.error || `Request failed with status ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';

            // --- SSE path ---
            if (contentType.includes('text/event-stream') && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';
                let sseLastUpdate = 0;

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        let separatorIdx: number;
                        while ((separatorIdx = buffer.indexOf('\n\n')) !== -1) {
                            const rawEvent = buffer.slice(0, separatorIdx);
                            buffer = buffer.slice(separatorIdx + 2);

                            const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'));
                            if (!dataLine) continue;
                            const payload = dataLine.slice(5).trim();
                            if (!payload || payload === '[DONE]') continue;

                            let parsed: { delta?: string; done?: boolean; error?: string; fullText?: string };
                            try {
                                parsed = JSON.parse(payload);
                            } catch {
                                continue;
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            if (typeof parsed.delta === 'string' && parsed.delta.length > 0) {
                                fullText += parsed.delta;
                                if (streamingMessageId) {
                                    const now = Date.now();
                                    if (now - sseLastUpdate > 50) { // ~20fps max updates
                                        const snapshot = fullText;
                                        setMessages(prev => prev.map(m =>
                                            m.id === streamingMessageId ? { ...m, content: snapshot } : m
                                        ));
                                        sseLastUpdate = now;
                                    }
                                }
                            }
                            if (parsed.done && typeof parsed.fullText === 'string' && parsed.fullText.length > 0) {
                                fullText = parsed.fullText;
                            }
                        }
                    }
                } finally {
                    try { reader.releaseLock(); } catch { /* noop */ }
                }

                return fullText;
            }

            // --- JSON fallback path (server didn't return SSE) ---
            const data = await response.json();
            return data.response as string;
        } catch (error) {
            if ((error as Error)?.name === 'AbortError') {
                throw error;
            }
            console.error('API Call Failed:', error);
            throw error;
        } finally {
            if (chatAbortRef.current === controller) {
                chatAbortRef.current = null;
            }
        }
    }, []);

    const addMessage = useCallback((msg: Message) => {
        setMessages(prev => [...prev, msg]);
        conversationHistoryRef.current.push(msg);
    }, []);

    // A1 fix: message deduplication — track last user message for 3s window
    const lastUserMsgRef = useRef<{ text: string; time: number } | null>(null);

    const submitUserResponse = useCallback(async (userText: string, problemContext: ProblemContext) => {
        if (stateMachine.current.getState() === 'completed') return;
        if (!userText.trim()) return;
        if (submitInFlightRef.current) {
            console.log('[useInterview] Submission ignored: submit already in flight');
            return;
        }
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
        submitInFlightRef.current = true;

        try {

        // A1 fix: Reset ttsError at start of each submission
        dispatchVoice({ type: 'SET_TTS_ERROR', value: false });
        // Reset VAD failure state to allow retry on this turn
        dispatchVoice({ type: 'SET_VAD_FAILED', value: false });

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
            problemTitle: problemContext.problemTitle,
            problemContent: problemContext.problemContent,
            transcript: safeUserText,
            interruptionContext: interruptionCtx,
            turnsRemaining: optionsRef.current.turnsRemaining,
            timeRemaining: optionsRef.current.timeRemaining,
        });

        // Rebuild system prompt every turn so turnsRemaining / timeRemaining are current
        const currentSysPrompt = generateSystemPrompt({
            problem: {
                id: currentProblemRef.current?.problemId ?? '',
                title: currentProblemRef.current?.problemTitle ?? '',
                content: currentProblemRef.current?.problemContent ?? '',
                description: currentProblemRef.current?.problemContent ?? '',
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

        // Create a placeholder streaming assistant message up-front so the UI can
        // render incremental tokens as they arrive from SSE. callChatApi will
        // update this message in place when `streamingMessageId` is passed.
        const streamingMsgId = generateMessageId();
        const placeholderMsg: Message = {
            id: streamingMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming',
        };
        addMessage(placeholderMsg);

        try {
            const responseText = await callChatApi(prompt, currentSysPrompt, problemContext, streamingMsgId);

            // Step 1i: TERMINATE_INTERVIEW token detection
            if (typeof responseText === 'string' && responseText.includes('TERMINATE_INTERVIEW')) {
                const cleanResponse = responseText.replace('TERMINATE_INTERVIEW', '').trim();
                // Finalize the streaming placeholder with the cleaned text
                setMessages(prev => prev.map(m =>
                    m.id === streamingMsgId
                        ? { ...m, content: cleanResponse, status: 'complete' as const }
                        : m
                ));
                const refIdx = conversationHistoryRef.current.findIndex(m => m.id === streamingMsgId);
                if (refIdx !== -1) {
                    conversationHistoryRef.current[refIdx] = {
                        ...conversationHistoryRef.current[refIdx],
                        content: cleanResponse,
                        status: 'complete',
                    };
                }
                setIsProcessing(false);
                setMicIntent('off');
                stopListening();
                stateMachine.current.transition('TERMINATE_INTERVIEW' as any);
                setState(stateMachine.current.getState());
                return;
            }

            // Finalize the streaming placeholder → complete
            setMessages(prev => prev.map(m =>
                m.id === streamingMsgId
                    ? { ...m, content: responseText, status: 'complete' as const }
                    : m
            ));
            const refIdx = conversationHistoryRef.current.findIndex(m => m.id === streamingMsgId);
            if (refIdx !== -1) {
                conversationHistoryRef.current[refIdx] = {
                    ...conversationHistoryRef.current[refIdx],
                    content: responseText,
                    status: 'complete',
                };
            }

            const newRoundCount = roundCount + 1;
            dispatchRound({ type: 'INCREMENT' });

            const elapsedMs = interviewStartTime ? Date.now() - interviewStartTime : 0;
            const roundLimitHit = newRoundCount >= INTERVIEW_MAX_ROUNDS;
            const timeLimitHit = elapsedMs >= INTERVIEW_MAX_MS || timeUpRef.current;

            // If time/turn limit hit: skip TTS, end immediately so analysis includes this last AI reply
            if (roundLimitHit || timeLimitHit) {
                setIsProcessing(false);
                dispatchRound({ type: 'SET_LIMIT', reason: roundLimitHit ? 'rounds' : 'time' });
                setMicIntent('off');
                stopListening();
                stateMachine.current.transition('SUBMIT_SOLUTION');
                setState(stateMachine.current.getState());
                return; // Skip TTS — go straight to auto-submit in InterviewSession
            }

            // A1 fix: setIsProcessing(false) MOVED to after speakAndWait
            // Previously fired here before TTS, allowing auto-submit during playback

            // Serial TTS: await full speech completion, then activate mic
            console.log(`[submitUserResponse] Speaking AI reply (parallel), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;
            
            // Fire-and-forget TTS to unblock UI immediately
            speak(responseText).catch(err => {
                dispatchVoice({ type: 'SET_TTS_ERROR', value: true });
                console.error('[submitUserResponse] TTS failed', err);
            });

            // Cancel smartPauseTimer since TTS is async now
            if (smartPauseTimerRef.current) {
                clearTimeout(smartPauseTimerRef.current);
                smartPauseTimerRef.current = null;
            }

            // Unlock UI immediately so user can respond or interrupt
            setIsProcessing(false);
            setMicStoppedManually(false);
            setMicIntent('auto-on');

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch (e) {
            // AbortError = user intentionally cancelled via handleInterruption.
            // Keep whatever partial tokens streamed into the placeholder, mark cancelled,
            // but don't append an apology — the user already saw Kai stop.
            if ((e as Error)?.name === 'AbortError') {
                setMessages(prev => prev.map(m =>
                    m.id === streamingMsgId ? { ...m, status: 'cancelled' as const } : m
                ));
                setIsProcessing(false);
                setMicStoppedManually(false);
                setMicIntent('auto-on');
                return;
            }

            console.error('❌ [ERROR] Failed to process user response:', e);
            // Repurpose the streaming placeholder as the error message so we don't
            // leave a stale empty bubble hanging around.
            const errorText = "Something went wrong. Could you repeat that?";
            setMessages(prev => {
                const hasPlaceholder = prev.some(m => m.id === streamingMsgId);
                if (hasPlaceholder) {
                    return prev.map(m =>
                        m.id === streamingMsgId
                            ? { ...m, content: errorText, status: 'complete' as const }
                            : m
                    );
                }
                return [...prev, { id: generateMessageId(), role: 'assistant', content: errorText, timestamp: new Date(), status: 'complete' }];
            });
            setIsProcessing(false);
            // Even on error, activate mic so user can try again
            setMicStoppedManually(false);
            setMicIntent('auto-on');
        }
        } finally {
            submitInFlightRef.current = false;
        }
    }, [stopListening, addMessage, resetTranscript, callChatApi, speakAndWait, roundCount, interviewStartTime]);

    // Keep ref in sync so the isTimeUp effect can call submitUserResponse without forward-ref issues
    submitUserResponseRef.current = submitUserResponse;

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
        dispatchVoice({ type: 'SET_VAD_FAILED', value: false });
        currentProblemRef.current = {
            problemTitle,
            problemContent,
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

        dispatchRound({ type: 'RESET' });
        dispatchRound({ type: 'SET_START_TIME', time: Date.now() });

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
            let introMsgId: string | null = null;
            if (optionsRef.current.isReviewMode) {
                responseText = `Let's review ${problemTitle} which you've seen before. Without looking at your previous solution, explain your approach to this problem.`;
                const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };
                addMessage(aiMsg);
            } else {
                // Create streaming placeholder before the SSE call so tokens appear as they stream in.
                introMsgId = generateMessageId();
                const placeholder: Message = {
                    id: introMsgId,
                    role: 'assistant',
                    content: '',
                    timestamp: new Date(),
                    status: 'streaming',
                };
                addMessage(placeholder);

                responseText = await callChatApi(introTrigger, sysPrompt, currentProblemRef.current!, introMsgId);

                // Finalize placeholder
                setMessages(prev => prev.map(m =>
                    m.id === introMsgId
                        ? { ...m, content: responseText, status: 'complete' as const }
                        : m
                ));
                const refIdx = conversationHistoryRef.current.findIndex(m => m.id === introMsgId);
                if (refIdx !== -1) {
                    conversationHistoryRef.current[refIdx] = {
                        ...conversationHistoryRef.current[refIdx],
                        content: responseText,
                        status: 'complete',
                    };
                }
            }
            // A1 fix: setIsProcessing(false) MOVED to after speakAndWait

            // Serial TTS: await full speech completion, then activate mic
            console.log(`[startInterview] Speaking intro (parallel), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;
            
            // Fire-and-forget TTS to unblock UI
            speak(responseText).catch(err => {
                dispatchVoice({ type: 'SET_TTS_ERROR', value: true });
                console.error('[startInterview] TTS failed', err);
            });

            // Unlock UI immediately
            setIsProcessing(false);
            setMicStoppedManually(false);
            setMicIntent('auto-on');

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch (e) {
            // Aborted intro = user navigated away / cancelled; stay silent.
            if ((e as Error)?.name === 'AbortError') {
                setIsProcessing(false);
                return;
            }
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
                submitUserResponse(safeMsg, currentProblemRef.current || { problemTitle: 'Test', problemContent: 'Test' });
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
            // A2: Reduced from 350ms → 50ms for near-instant mic activation.
            // setMicActivating(true) gives the UI a visual cue during this window.
            dispatchVoice({ type: 'SET_MIC_ACTIVATING', value: true });
            const timer = setTimeout(() => {
                dispatchVoice({ type: 'SET_MIC_ACTIVATING', value: false });
                // Re-check conditions inside the timeout
                if (!isSpeakingRef.current && !isProcessingRef.current && !isListeningRef.current) {
                    console.log(`[Mic Sync] Starting mic. sttProvider=${sttProvider}, resolvedSTT=${stt.resolvedProvider}`);
                    // NOTE: Don't call resetTranscript() here — it clears valid accumulated
                    // transcript on every mic restart. Transcript is correctly reset in
                    // submitUserResponse() and startInterview() when appropriate.
                    startListening();
                    if (sttProvider === 'whisper') vad.startListening();
                }
            }, 50);
            return () => { clearTimeout(timer); dispatchVoice({ type: 'SET_MIC_ACTIVATING', value: false }); };
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
        dispatchVoice({ type: 'SET_TTS_ERROR', value: false });
        stopListening();
        dispatchRound({ type: 'RESET' });
        dispatchVoice({ type: 'SET_VAD_FAILED', value: false });
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
    //  -- automated unused local suppression
    const _sessionIdRef = useRef<string>(generateMessageId());

    // ── Handle interruption: capture partial content ─────────────
    const handleInterruption = useCallback((spokenContent?: string) => {
        // Cancel any in-flight SSE chat request so tokens stop streaming mid-response.
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;
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

    //  -- automated unused local suppression
    const shareCode = useCallback((code: string) => {
        stateMachine.current.transition('USER_SHARED_CODE');
        setState(stateMachine.current.getState());
        // Resume mic after sharing
        setMicIntent('user-on');
        setMicStoppedManually(false);
    }, []);

    const endInterview = useCallback(() => {
        if (roundCount < 1 && !timeUpRef.current) return;
        // Abort any in-flight SSE chat request
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;
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
        micActivating,
        emptyTranscriptFeedback,
        vadSpeechProbability,
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
            isReady: vad.isReady,
            transcript,
            interimTranscript,
            isTranscribing: stt.isTranscribing,
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
