import { useState, useRef, useEffect, useCallback } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import { generateSystemPrompt, generateTurnPrompt } from '@/lib/interview/prompts';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
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
}

export function useInterview(options: {
    vadEnabled?: boolean;
    onUserMessage?: (msg: Message, messageCount: number) => void;
} = {}) {
    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);

    // Problem Context helper ref
    const currentProblemRef = useRef<ProblemContext | null>(null);

    // Logic Refs
    const stateMachine = useRef(new InterviewStateMachine());
    const conversationHistoryRef = useRef<Message[]>([]);

    // Voice Hooks
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        abortListening,
        resetTranscript,
        error: voiceError,
        lastResultTime
    } = useVoiceInput();

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
            const data = await fetchWithRetry('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // The API route takes 'messages', systemPrompt, and problemContext.
                    // We send the full conversation history plus the latest turn merged.
                    messages: [
                        ...conversationHistoryRef.current.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: prompt }
                    ],
                    systemPrompt,
                    problemContext,
                    companyPersona: problemContext.companyPersona
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
        if (!userText.trim()) return;


        // Don't disable intent, just stop listening momentarily for processing
        stopListening();

        const userMsg: Message = { id: generateMessageId(), role: 'user', content: userText, timestamp: new Date(), status: 'complete' };
        addMessage(userMsg);

        if (options.onUserMessage) {
            // Pass the count INCLUDING the newly added message
            options.onUserMessage(userMsg, conversationHistoryRef.current.length);
        }
        resetTranscript();

        setIsProcessing(true);
        stateMachine.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachine.current.getState());

        const methodHistory = conversationHistoryRef.current
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n');

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
            ragContext: "RETRIVE_VIA_API", // Flag for API to do its magic
            interruptionContext: interruptionCtx,
        });

        try {
            const responseText = await callChatApi(prompt, generateSystemPrompt(), problemContext);
            const aiMsg: Message = { id: generateMessageId(), role: 'assistant', content: responseText, timestamp: new Date(), status: 'complete' };

            addMessage(aiMsg);
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch (e) {
            console.error('❌ [ERROR] Failed to process user response:', e);
            addMessage({ id: generateMessageId(), role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    }, [stopListening, addMessage, resetTranscript, callChatApi, speak, options]);

    // Mic Intent State
    const [isMicEnabled, setIsMicEnabled] = useState(false);

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
                if (isListening && transcript && currentProblemRef.current) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }, AUTO_SUBMIT_DELAY - timeSinceLastResult);
            return () => clearTimeout(timer);
        }
    }, [transcript, lastResultTime, isListening, autoSubmitEnabled, isProcessing, submitUserResponse]);

    // Core Logic
    const startInterview = useCallback(async (problemTitle: string, problemContent: string, ragContext?: string, companyPersona?: string) => {
        currentProblemRef.current = { title: problemTitle, content: problemContent, ragContext, companyPersona };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        // Auto-enable mic on start if desired
        setIsMicEnabled(true);

        const sysPrompt = generateSystemPrompt();
        const introPrompt = generateTurnPrompt({
            state: 'problem-intro',
            problemTitle,
            problemContent,
            transcript: '',
            conversationHistory: '',
            ragContext: ragContext || ''
        });

        setIsProcessing(true);
        try {
            const responseText = await callChatApi(introPrompt, sysPrompt, currentProblemRef.current);
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
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__TRIGGER_AI_CALL__ = (message: string) => {
                submitUserResponse(message, currentProblemRef.current || { title: 'Test', content: 'Test' });
            };
        }
    }, [submitUserResponse]);

    // INTELLIGENT MIC SYNC: Stop listening when AI speaks, Resume when done
    // Controlled by isMicEnabled
    // Use a ref to track if we've already attempted to resume in this "AI finished" cycle
    const micResumeAttemptedRef = useRef(false);

    useEffect(() => {
        if ((state as string) === 'idle') {
            if (isListening) stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        // If User Manually Disabled Mic -> Ensure Stopped
        if (!isMicEnabled) {
            if (isListening) stopListening();
            micResumeAttemptedRef.current = false;
            return;
        }

        // CRITICAL: Stop mic when AI is processing (waiting for API)
        // OR when AI is speaking AND VAD is disabled (to prevent echo)
        const shouldStopForSpeaking = isSpeaking && !options.vadEnabled;

        if (shouldStopForSpeaking || isProcessing) {
            if (isListening) {
                // Use abort to immediately cut off stream and discard partial inputs
                abortListening();
            }
            // Reset the resume flag when AI starts speaking/processing
            micResumeAttemptedRef.current = false;
            micResumeAttemptedRef.current = false;
            return; // Don't proceed to start logic
        }

        // If already listening, reset the resume flag so we can restart if it drops later
        if (isListening) {
            micResumeAttemptedRef.current = false;
            return;
        }

        // Mic is Enabled (Intent) AND (AI is silent OR VAD is enabled): Resume Mic
        // CRITICAL: Only attempt once per "AI finished" cycle to prevent loop
        if (!isListening && !micResumeAttemptedRef.current) {
            micResumeAttemptedRef.current = true; // Mark that we're attempting

            // Delay to ensure audio is fully cleared and prevent "Self-Hearing" loops
            // If VAD is enabled, we might want a shorter delay or no delay, but 
            // for now sticking to safe defaults to prevent immediate echo of previous output
            const timer = setTimeout(() => {
                // Double-check conditions haven't changed during timeout
                const stillShouldStop = (isSpeaking && !options.vadEnabled) || isProcessing;
                if (isMicEnabled && !stillShouldStop) {
                    // CRITICAL: Reset transcript before resuming to prevent carryover
                    resetTranscript();
                    startListening();
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isSpeaking, isProcessing, startListening, stopListening, abortListening, state, isMicEnabled, resetTranscript, options.vadEnabled, isListening]);


    // 7-SECOND SILENCE TIMEOUT: Auto-stop mic if no voice detected for 7 seconds
    // DISBLED IF VAD IS ACTIVE: We want continuous listening for interruptions
    useEffect(() => {
        if (!isListening || !isMicEnabled || options.vadEnabled) return;

        const SILENCE_TIMEOUT = 7000; // 7 seconds

        const checkSilence = setInterval(() => {
            const timeSinceLastResult = Date.now() - lastResultTime;
            if (timeSinceLastResult >= SILENCE_TIMEOUT && !transcript && !interimTranscript) {
                setIsMicEnabled(false); // Disable intent, stops cycling
            }
        }, 1000);

        return () => clearInterval(checkSilence);
    }, [isListening, isMicEnabled, lastResultTime, transcript, interimTranscript, options.vadEnabled]);

    const resetInterview = useCallback(() => {
        setMessages([]);
        setState('idle');
        stateMachine.current.reset();
        conversationHistoryRef.current = [];
        resetTranscript();
        setIsProcessing(false);
        setIsMicEnabled(false); // Disable mic on reset
        stopListening();
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

    return {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        handleInterruption,
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
            pauseSpeaking,
            resumeSpeaking,
            stopSpeaking,
            error: voiceError
        }
    };
}

