/**
 * @codesage
 * @file      src/hooks/useInterviewControl.ts
 * @purpose   Controller hook managing interview orchestration, prompt generation, turn limits, and user submissions.
 * @tech      React
 * @connects  Composes useInterviewVoice, useInterviewMessages, useInterviewApi
 * @apis      none
 * @db        none
 * @state     Interview state machine state, round counts, and system prompt caching
 * @env       NODE_ENV, NEXT_PUBLIC_ENABLE_TEST_HOOKS
 * @issues    Large orchestration file, potential overlap with monolithic useInterview.ts
 * @audit     CODESAGE-v1
 * 
 * @section   Prompt Generation
 * Handles dynamic updates to the system prompt based on limits and session state.
 * 
 * @section   Turn Orchestration
 * Handles starting, submitting turns, interrupts, and coding mode transitions.
 */
// @ts-nocheck

// 

import { useState, useRef, useEffect, useCallback } from 'react';
import { generateTurnPrompt, generateSystemPrompt, generateInterviewOpeningTrigger, GUEST_INTRO_TEXT, MAX_USER_INPUT, type SystemPromptOptions } from '@/lib/interview/prompts';
import { buildInterruptionContext } from '@/lib/interview/interruption-context';
import type { Message } from './useInterviewMessages';
import type { UseInterviewVoiceReturn } from './useInterviewVoice';
import type { UseInterviewMessagesReturn } from './useInterviewMessages';
import type { UseInterviewApiReturn } from './useInterviewApi';
import type { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import type { UseInterviewOptions, ProblemContext } from './useInterview';
import type { Problem } from '@/types/problem';

export interface UseInterviewControlOptions {
    voice: UseInterviewVoiceReturn;
    messages: UseInterviewMessagesReturn;
    api: UseInterviewApiReturn;
    stateMachineRef: React.MutableRefObject<InterviewStateMachine>;
    currentProblemRef: React.MutableRefObject<ProblemContext | null>;
    optionsRef: React.MutableRefObject<UseInterviewOptions>;
    timeUpRef: React.MutableRefObject<boolean>;
}

export interface UseInterviewControlReturn {
    state: InterviewState;
    setState: React.Dispatch<React.SetStateAction<InterviewState>>;
    isProcessing: boolean;
    startInterview: (ctx: ProblemContext) => Promise<void>;
    submitUserResponse: (text: string, ctx: ProblemContext) => Promise<void>;
    endInterview: () => void;
    handleInterruption: (spokenContent?: string) => void;
    enterCodingMode: () => void;
    exitCodingMode: () => void;
    shareCode: (code: string) => void;
    resetInterview: () => void;
    roundCount: number;
    interviewStartTime: number | null;
    isLimitReached: boolean;
    limitReason: 'rounds' | 'time' | null;
}

/**
 * Updates only the dynamic <session_state> block in a cached system prompt.
 * This avoids re-running the full generateSystemPrompt() on every turn.
 */
export function updateSystemPromptForTurn(
    cachedPrompt: string,
    turnsRemaining: number | undefined,
    timeRemaining: number | undefined,
    sessionMinutes: number = 30
): string {
    if (!cachedPrompt) return cachedPrompt;

    const lines: string[] = [];
    if (turnsRemaining !== undefined) {
        const note =
            turnsRemaining <= 1 ? ' - FINAL TURN: deliver feedback after this exchange' :
                turnsRemaining <= 3 ? ' - session ending soon' : '';
        lines.push(`Turns remaining: ${turnsRemaining}${note}`);
    }
    if (timeRemaining !== undefined) {
        const mins = Math.floor(timeRemaining / 60);
        const secs = (timeRemaining % 60).toString().padStart(2, '0');
        const pct = (timeRemaining / 60 / sessionMinutes) * 100;
        const note =
            pct <= 10 ? ' - FINAL MINUTES: wrap up now' :
                pct <= 25 ? ' - approaching end' : '';
        lines.push(`Time remaining: ${mins}:${secs}${note}`);
    }

    if (lines.length === 0) return cachedPrompt;

    const newBlock = `<session_state>\n${lines.join('\n')}\n</session_state>`;
    const sessionStateRegex = /<session_state>[\s\S]*?<\/session_state>/;
    if (sessionStateRegex.test(cachedPrompt)) {
        return cachedPrompt.replace(sessionStateRegex, newBlock);
    }

    return `${cachedPrompt}\n\n${newBlock}`;
}

function generateMessageId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useInterviewControl({
    voice,
    messages: msgs,
    api,
    stateMachineRef,
    currentProblemRef,
    optionsRef,
        timeUpRef,
    }: UseInterviewControlOptions): UseInterviewControlReturn {
        const { 
            smartPauseTimerRef, 
            smartPauseActiveRef, 
            sendCountdownIntervalRef, 
            isSpeakingRef,
            mediaStreamRef
        } = voice;

        // Wire API streaming refs to real setMessages/addMessage/tts
        const apiAny = api as any;
        // eslint-disable-next-line react-hooks/immutability
        if (apiAny._setMessagesRef) apiAny._setMessagesRef.current = msgs.setMessages;
        // eslint-disable-next-line react-hooks/immutability
        if (apiAny._addMessageRef) apiAny._addMessageRef.current = msgs.addMessage;
        // eslint-disable-next-line react-hooks/immutability
        if (apiAny._ttsRef) apiAny._ttsRef.current = { speak: voice.speak, isSpeaking: voice.isSpeaking };

        const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [roundCount, setRoundCount] = useState(0);
    const [interviewStartTime, setInterviewStartTime] = useState<number | null>(null);
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [limitReason, setLimitReason] = useState<'rounds' | 'time' | null>(null);

    const isProcessingRef = useRef(false);
    useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    const INTERVIEW_MAX_ROUNDS = optionsRef.current.config?.maxTurnsPerProblem ?? 20;
    const INTERVIEW_MAX_MS = optionsRef.current.config?.maxDurationMs ?? 1200000;

    const currentAiTextRef = useRef('');
    const cachedSystemPromptRef = useRef<string>('');

    const submitUserResponseRef = useRef<((text: string, ctx: ProblemContext) => Promise<void>) | null>(null);

    // Time limit enforcement: tied strictly to global UI hook
    useEffect(() => {
        if (!optionsRef.current.isTimeUp) return;
        if (isLimitReached || state === 'idle' || state === 'completed') return;

        const pendingText = voice.transcript.trim();
        if (pendingText && currentProblemRef.current && !isProcessingRef.current && submitUserResponseRef.current) {
            submitUserResponseRef.current(pendingText, currentProblemRef.current);
            return;
        }

        setIsLimitReached(true);
        setLimitReason('time');
        voice.setMicIntent('off');
        voice.stopListening();
        stateMachineRef.current.transition('SUBMIT_SOLUTION');
        setState(stateMachineRef.current.getState());
    }, [optionsRef.current.isTimeUp, isLimitReached, state, voice, stateMachineRef, currentProblemRef]);

    const submitUserResponse = useCallback(async (userText: string, problemContext: ProblemContext) => {
        if (stateMachineRef.current.getState() === 'completed') return;
        if (!userText.trim()) return;
        const safeUserText = userText.slice(0, MAX_USER_INPUT);

        const now = Date.now();
        const { lastUserMsgRef } = msgs;
        if (lastUserMsgRef.current &&
            lastUserMsgRef.current.text === safeUserText.trim() &&
            now - lastUserMsgRef.current.time < 3000) {
            console.log('[useInterviewControl] Duplicate message blocked (within 3s window)');
            return;
        }
        lastUserMsgRef.current = { text: safeUserText.trim(), time: now };

        // Guard against concurrent invocations — isProcessingRef is synchronous
        // so this check is safe even in concurrent scenarios
        if (isProcessingRef.current) {
            console.warn('[useInterviewControl] Concurrent submission blocked — already processing');
            return;
        }

        voice.setTtsError(false);

        if (smartPauseTimerRef.current) {
            clearTimeout(smartPauseTimerRef.current);
            smartPauseTimerRef.current = null;
        }
        smartPauseActiveRef.current = false;

        voice.stopListening();
        voice.setMicIntent('paused-for-ai');
        voice.setMicStoppedManually(false);
        voice.setSendCountdown(null);

        const userMsg: Message = { id: generateMessageId(), role: 'user', content: safeUserText, timestamp: new Date(), status: 'complete' };
        msgs.addMessage(userMsg);

        if (optionsRef.current.onUserMessage) {
            optionsRef.current.onUserMessage(userMsg, msgs.conversationHistoryRef.current.length);
        }
        voice.resetTranscript();

        setIsProcessing(true);
        stateMachineRef.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachineRef.current.getState());

        const lastInterrupted = msgs.conversationHistoryRef.current
            .slice()
            .reverse()
            .find(m => m.role === 'assistant' && m.status === 'interrupted' && m.partialContent);

        const interruptionCtx = lastInterrupted
            ? buildInterruptionContext(lastInterrupted.partialContent!, lastInterrupted.interruptedAt ?? Date.now())
            : undefined;

        const prompt = generateTurnPrompt({
            state: stateMachineRef.current.getState(),
            problemTitle: problemContext.problemTitle,
            problemContent: problemContext.problemContent,
            transcript: safeUserText,
            interruptionContext: interruptionCtx,
            turnsRemaining: optionsRef.current.turnsRemaining,
            timeRemaining: optionsRef.current.timeRemaining,
        });

        //  -- automated unused local suppression
        const detectedLang = 'english'; // Hinglish support removed

        const currentProblemTitle = currentProblemRef.current?.problemTitle ?? '';
        const currentProblemContent = currentProblemRef.current?.problemContent ?? '';

        let currentSysPrompt: string;

        if (!cachedSystemPromptRef.current) {
            currentSysPrompt = generateSystemPrompt({
                problem: {
                    id: currentProblemRef.current?.problemId ?? '',
                    title: currentProblemTitle,
                    content: currentProblemContent,
                    description: currentProblemContent,
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
            cachedSystemPromptRef.current = currentSysPrompt;
        } else {
            const modeSessionMinutes = (() => {
                const mode = currentProblemRef.current?.difficultyMode ?? 'practice';
                const minutes: Record<string, number> = {
                    'warm-up': 20,
                    'practice': 30,
                    'crunch': 25,
                    'sprint': 45,
                    'employer': 45,
                };
                return minutes[mode] ?? 30;
            })();

            currentSysPrompt = updateSystemPromptForTurn(
                cachedSystemPromptRef.current,
                optionsRef.current.turnsRemaining,
                optionsRef.current.timeRemaining,
                modeSessionMinutes
            );
        }

        try {
            const responseText = await api.callChatApi(prompt, currentSysPrompt, problemContext);

            if (typeof responseText === 'string' && responseText.includes('TERMINATE_INTERVIEW')) {
                const cleanResponse = responseText.replace('TERMINATE_INTERVIEW', '').trim();
                // If streaming added a message, update it; otherwise create a new one
                const streamMsgId = (api as any).currentStreamMsgIdRef?.current;
                if (!streamMsgId) {
                    const aiMsg: Message = {
                        id: generateMessageId(),
                        role: 'assistant',
                        content: cleanResponse,
                        timestamp: new Date(),
                        status: 'complete',
                    };
                    msgs.addMessage(aiMsg);
                }
                setIsProcessing(false);
                voice.setMicIntent('off');
                voice.stopListening();
                stateMachineRef.current.transition('TERMINATE_INTERVIEW' as any);
                setState(stateMachineRef.current.getState());
                return;
            }

            // If streaming already added and finalized the message, skip addMessage
            const wasStreaming = (api as any).currentStreamMsgIdRef?.current === null 
                && msgs.conversationHistoryRef.current.length > 0
                && msgs.conversationHistoryRef.current[msgs.conversationHistoryRef.current.length - 1].role === 'assistant'
                && msgs.conversationHistoryRef.current[msgs.conversationHistoryRef.current.length - 1].status === 'complete';

            if (!wasStreaming) {
                const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };
                msgs.addMessage(aiMsg);
            }

            const newRoundCount = roundCount + 1;
            setRoundCount(newRoundCount);

            const elapsedMs = interviewStartTime ? Date.now() - interviewStartTime : 0;
            const roundLimitHit = newRoundCount >= INTERVIEW_MAX_ROUNDS;
            const timeLimitHit = elapsedMs >= INTERVIEW_MAX_MS || timeUpRef.current;

            if (roundLimitHit || timeLimitHit) {
                setIsProcessing(false);
                setIsLimitReached(true);
                setLimitReason(roundLimitHit ? 'rounds' : 'time');
                voice.setMicIntent('off');
                voice.stopListening();
                stateMachineRef.current.transition('SUBMIT_SOLUTION');
                setState(stateMachineRef.current.getState());
                return;
            }

            console.log(`[submitUserResponse] Speaking AI reply (parallel), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;

            try {
                voice.speak(responseText);
            } catch (err: any) {
                voice.setTtsError(true);
                console.error('[submitUserResponse] TTS failed', err);
            }

            if (smartPauseTimerRef.current) {
                clearTimeout(smartPauseTimerRef.current);
                smartPauseTimerRef.current = null;
            }

            setIsProcessing(false);

            voice.setMicStoppedManually(false);
            voice.setMicIntent('auto-on');

            stateMachineRef.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachineRef.current.getState());
        } catch (e) {
            console.error('❌ [ERROR] Failed to process user response:', e);
            msgs.addMessage({ id: generateMessageId(), role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date(), status: 'complete' });
            setIsProcessing(false);
            voice.setMicStoppedManually(false);
            voice.setMicIntent('auto-on');
        }
    }, [voice, msgs, api, stateMachineRef, optionsRef, INTERVIEW_MAX_ROUNDS, INTERVIEW_MAX_MS, roundCount, interviewStartTime, timeUpRef]);

    submitUserResponseRef.current = submitUserResponse;

    // Auto-submit on silence
    useEffect(() => {
        if (!voice.transcript.trim()) return;
        if (state === 'idle' || state === 'completed') return;
        if (isProcessing || voice.isSpeaking) return;
        if (voice.micStoppedManually) return;

        const timer = setTimeout(() => {
            const text = voice.transcript.trim();
            if (text && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                console.log(`[useInterviewControl] Auto-submit after 2.5s silence: "${text.substring(0, 60)}..."`);
                submitUserResponse(text, currentProblemRef.current);
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, [voice.transcript, state, isProcessing, voice.isSpeaking, voice.micStoppedManually, submitUserResponse, currentProblemRef, voice.isSpeakingRef]);

    // Send countdown
    useEffect(() => {
        if (sendCountdownIntervalRef.current) {
            clearInterval(sendCountdownIntervalRef.current);
            sendCountdownIntervalRef.current = null;
        }

        if (!voice.micStoppedManually || !voice.transcript.trim() || state === 'idle' || state === 'completed' || isProcessing || voice.isSpeaking) {
            voice.setSendCountdown(null);
            return;
        }

        voice.setSendCountdown(3);
        sendCountdownIntervalRef.current = setInterval(() => {
            voice.setSendCountdown(prev => {
                if (prev === null || prev <= 1) {
                    if (sendCountdownIntervalRef.current) {
                        clearInterval(sendCountdownIntervalRef.current);
                        sendCountdownIntervalRef.current = null;
                    }
                    const text = voice.transcript.trim();
                    if (text && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                        console.log(`[useInterviewControl] Send countdown expired, auto-submitting: "${text.substring(0, 60)}..."`);
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
    }, [voice.micStoppedManually, voice.transcript, state, isProcessing, voice.isSpeaking, submitUserResponse, currentProblemRef, voice, voice.isSpeakingRef]);


    // Core Logic
    const startInterview = useCallback(async (opts: ProblemContext) => {
        const { ragContext, kaiMemory, problemId, difficultyMode, difficulty, kaiMemoryStructured } = opts as any;
        const problemTitle = opts.problemTitle ?? '';
        const problemContent = opts.problemContent ?? '';

        if (stateMachineRef.current.getState() === 'completed') {
            stateMachineRef.current.reset();
        }
        const { resetMessages } = msgs;
        resetMessages();
        voice.resetTranscript();
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
        } as any;
        stateMachineRef.current.transition('START');
        setState(stateMachineRef.current.getState());

        voice.setMicIntent('paused-for-ai');

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

        // Cache for reuse across turns - only <session_state> block changes per turn
        cachedSystemPromptRef.current = sysPrompt;

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
            if (optionsRef.current.isGuest) {
                const guestIntroMsg: Message = {
                    id: generateMessageId(),
                    role: 'assistant',
                    content: GUEST_INTRO_TEXT,
                    timestamp: new Date(),
                    status: 'complete',
                };
                msgs.addMessage(guestIntroMsg);
                const guestTtsOk = await voice.speakAndWait(GUEST_INTRO_TEXT, 3);
                if (!guestTtsOk) {
                    console.warn('[startInterview] Guest intro TTS failed — message shown in chat.');
                }
                await new Promise(resolve => setTimeout(resolve, 600));
            }

            let responseText = '';
            if (optionsRef.current.isReviewMode) {
                responseText = `Let's review ${problemTitle} which you've seen before. Without looking at your previous solution, explain your approach to this problem.`;
            } else {
                responseText = await api.callChatApi(introTrigger, sysPrompt, currentProblemRef.current!);
            }
            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            msgs.addMessage(aiMsg);

            console.log(`[startInterview] Speaking intro (parallel), textLen=${responseText.length}`);
            currentAiTextRef.current = responseText;
            
            try {
                voice.speak(responseText);
            } catch (err: any) {
                voice.setTtsError(true);
                console.error('[startInterview] TTS failed', err);
            }

            setIsProcessing(false);

            voice.setMicStoppedManually(false);
            voice.setMicIntent('auto-on');

            stateMachineRef.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachineRef.current.getState());
        } catch {
            msgs.addMessage({ id: generateMessageId(), role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date(), status: 'complete' });
            setIsProcessing(false);
            voice.setMicStoppedManually(false);
            voice.setMicIntent('auto-on');
        }
    }, [api, msgs, voice, stateMachineRef, optionsRef, currentProblemRef]);


    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                voice.stopSpeaking();
                voice.setMicIntent('paused-for-ai');
            } else {
                if (state !== 'idle' && state !== 'completed' && state !== 'solution-review') {
                    voice.setMicIntent('auto-on');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            voice.stopSpeaking();
            voice.stopListening();
        };
    }, [voice, state]);

    useEffect(() => {
        const testHooksEnabled =
            process.env.NODE_ENV !== 'production' &&
            process.env.NEXT_PUBLIC_ENABLE_TEST_HOOKS === 'true';

        if (typeof window !== 'undefined' && testHooksEnabled) {
            (window as any).__TRIGGER_AI_CALL__ = (message: string) => {
                const safeMsg = message.slice(0, MAX_USER_INPUT);
                submitUserResponse(safeMsg, currentProblemRef.current || { problemTitle: 'Test', problemContent: 'Test' } as any);
            };
            return () => {
                delete (window as any).__TRIGGER_AI_CALL__;
            };
        }
    }, [submitUserResponse, currentProblemRef]);

    const resetInterview = useCallback(() => {
        const { resetMessages } = msgs;
        resetMessages();
        cachedSystemPromptRef.current = '';
        setState('idle');
        stateMachineRef.current.reset();
        voice.resetTranscript();
        setIsProcessing(false);
        voice.setMicIntent('off');
        voice.setMicStoppedManually(false);
        voice.setSendCountdown(null);
        voice.setTtsError(false);
        voice.stopListening();
        setRoundCount(0);
        setInterviewStartTime(null);
        setIsLimitReached(false);
        setLimitReason(null);
        if (smartPauseTimerRef.current) { clearTimeout(smartPauseTimerRef.current); smartPauseTimerRef.current = null; }
        smartPauseActiveRef.current = false;
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
    }, [msgs, voice, stateMachineRef]);

    const handleInterruption = useCallback((spokenContent?: string) => {
        voice.setMicStoppedManually(false);
        voice.setMicIntent('auto-on');
        msgs.setMessages(prev => {
            const lastAiIdx = prev.length - 1;
            if (lastAiIdx < 0 || prev[lastAiIdx].role !== 'assistant') return prev;

            const lastAiMsg = prev[lastAiIdx];
            if (lastAiMsg.status === 'interrupted') return prev;

            const now = Date.now();
            const partial = spokenContent || lastAiMsg.content;

            voice.stopSpeaking();

            const updated: Message = {
                ...lastAiMsg,
                status: 'interrupted',
                partialContent: partial,
                interruptedAt: now,
            };

            const newMessages = [...prev];
            newMessages[lastAiIdx] = updated;

            if (msgs.conversationHistoryRef.current.length > 0) {
                const refIdx = msgs.conversationHistoryRef.current.length - 1;
                if (msgs.conversationHistoryRef.current[refIdx].id === lastAiMsg.id) {
                    msgs.conversationHistoryRef.current[refIdx] = updated;
                }
            }

            return newMessages;
        });
    }, [voice, msgs]);

    const enterCodingMode = useCallback(() => {
        stateMachineRef.current.transition('USER_STARTED_CODING');
        setState(stateMachineRef.current.getState());
        voice.setMicIntent('off');
        voice.stopListening();
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
        voice.setSendCountdown(null);
    }, [stateMachineRef, voice]);

    const exitCodingMode = useCallback(() => {
        const currentState = stateMachineRef.current.getState();
        if (currentState === 'completed' || currentState === 'solution-review' || currentState === 'idle') return;
        stateMachineRef.current.transition('USER_STOPPED_CODING');
        setState(stateMachineRef.current.getState());
        voice.setMicIntent('user-on');
        voice.setMicStoppedManually(false);
    }, [stateMachineRef, voice]);

    //  -- automated unused local suppression
    const shareCode = useCallback((code: string) => {
        stateMachineRef.current.transition('USER_SHARED_CODE');
        setState(stateMachineRef.current.getState());
        voice.setMicIntent('user-on');
        voice.setMicStoppedManually(false);
    }, [stateMachineRef, voice]);

    const endInterview = useCallback(() => {
        if (state === 'idle') return;
        voice.setVadEnabled(false);
        voice.resetTranscript();
        voice.setMicIntent('off');
        voice.setMicStoppedManually(false);
        voice.setSendCountdown(null);
        voice.stopListening();
        voice.stopSpeaking();
        if (mediaStreamRef?.current) {
            mediaStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            mediaStreamRef.current = null;
        }
        if (smartPauseTimerRef.current) { clearTimeout(smartPauseTimerRef.current); smartPauseTimerRef.current = null; }
        if (sendCountdownIntervalRef.current) { clearInterval(sendCountdownIntervalRef.current); sendCountdownIntervalRef.current = null; }
        stateMachineRef.current.transition('SUBMIT_SOLUTION');
        setState(stateMachineRef.current.getState());
    }, [state, voice, stateMachineRef]);

    return {
        state,
        setState,
        isProcessing,
        startInterview,
        submitUserResponse,
        endInterview,
        handleInterruption,
        enterCodingMode,
        exitCodingMode,
        shareCode,
        resetInterview,
        roundCount,
        interviewStartTime,
        isLimitReached,
        limitReason,
    };
}
