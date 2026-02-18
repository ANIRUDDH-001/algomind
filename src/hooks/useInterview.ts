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

export function useInterview() {
    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [state, setState] = useState<InterviewState>('idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);

    // Problem Context helper ref
    const currentProblemRef = useRef<any>(null);

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

    // Voice Hooks
    const voiceOutputOptions = useRef({}).current; // Or useMemo(() => ({}), [])

    const {
        speak,
        pause: pauseSpeaking,
        resume: resumeSpeaking,
        stop: stopSpeaking,
        isSpeaking,
        isPaused
    } = useVoiceOutput(voiceOutputOptions);

    // Helper to call API with Retry Logic
    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<any> => {
        try {
            const response = await fetch(url, options);

            // Retry on 429 (Too Many Requests) or 5xx (Server Errors)
            if (response.status === 429 || response.status >= 500) {
                if (retries > 0) {
                    console.log(`[Retry] Request failed with ${response.status}. Retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
            }

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Failed to fetch chat response' }));
                throw new Error(err.error || `Request failed with status ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            // Retry on Network Errors (fetch throws)
            if (retries > 0) {
                console.log(`[Retry] Network error. Retrying in ${backoff}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw error;
        }
    };

    const callChatApi = async (prompt: string, systemPrompt: string, problemContext: any) => {
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
                    problemContext
                })
            });

            return data.response; // string
        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    };

    const addMessage = (msg: Message) => {
        setMessages(prev => [...prev, msg]);
        conversationHistoryRef.current.push(msg);
    };

    // Mic Intent State
    const [isMicEnabled, setIsMicEnabled] = useState(false);

    // Initial Start: Enable Mic
    // (Optional: If you want it to start automatically when interview starts)

    // Auto-Submit Logic
    useEffect(() => {
        if (!autoSubmitEnabled || !isListening || !transcript || isProcessing) return;

        const timeSinceLastResult = Date.now() - lastResultTime;
        if (timeSinceLastResult >= AUTO_SUBMIT_DELAY) {
            submitUserResponse(transcript, currentProblemRef.current);
        } else {
            const timer = setTimeout(() => {
                if (isListening && transcript) {
                    submitUserResponse(transcript, currentProblemRef.current);
                }
            }, AUTO_SUBMIT_DELAY - timeSinceLastResult);
            return () => clearTimeout(timer);
        }
    }, [transcript, lastResultTime, isListening, autoSubmitEnabled, isProcessing]);

    // Core Logic
    const startInterview = async (problemTitle: string, problemContent: string, ragContext?: string) => {
        currentProblemRef.current = { title: problemTitle, content: problemContent, ragContext };
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
        } catch (e) {
            addMessage({ id: generateMessageId(), role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date(), status: 'complete' });
        } finally {
            setIsProcessing(false);
        }
    };

    const submitUserResponse = async (userText: string, problemContext: any) => {
        if (!userText.trim()) return;


        // Don't disable intent, just stop listening momentarily for processing
        stopListening();

        const userMsg: Message = { id: generateMessageId(), role: 'user', content: userText, timestamp: new Date(), status: 'complete' };
        addMessage(userMsg);
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
    };

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

        // CRITICAL: Always stop mic immediately when AI is speaking OR processing
        if (isSpeaking || isProcessing) {
            if (isListening) {
                // Use abort to immediately cut off stream and discard partial inputs (prevent echo)
                abortListening();
            }
            // Reset the resume flag when AI starts speaking/processing
            micResumeAttemptedRef.current = false;
            return; // Don't proceed to start logic
        }

        // Mic is Enabled (Intent) AND AI is not speaking/processing: Resume Mic
        // CRITICAL: Only attempt once per "AI finished" cycle to prevent loop
        if (!isListening && !micResumeAttemptedRef.current) {
            micResumeAttemptedRef.current = true; // Mark that we're attempting

            // Delay to ensure audio is fully cleared and prevent "Self-Hearing" loops
            const timer = setTimeout(() => {
                // Double-check conditions haven't changed during timeout
                if (isMicEnabled && !isSpeaking && !isProcessing) {
                    // CRITICAL: Reset transcript before resuming to prevent carryover
                    // from speech captured during AI processing phase
                    resetTranscript();
                    startListening();
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isSpeaking, isProcessing, startListening, stopListening, state, isMicEnabled, resetTranscript]);


    // 7-SECOND SILENCE TIMEOUT: Auto-stop mic if no voice detected for 7 seconds
    useEffect(() => {
        if (!isListening || !isMicEnabled) return;

        const SILENCE_TIMEOUT = 7000; // 7 seconds

        const checkSilence = setInterval(() => {
            const timeSinceLastResult = Date.now() - lastResultTime;
            if (timeSinceLastResult >= SILENCE_TIMEOUT && !transcript && !interimTranscript) {
                setIsMicEnabled(false); // Disable intent, stops cycling
            }
        }, 1000);

        return () => clearInterval(checkSilence);
    }, [isListening, isMicEnabled, lastResultTime, transcript, interimTranscript]);

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
            isListening,
            transcript,
            interimTranscript,
            startListening: () => setIsMicEnabled(true), // Override to set intent
            stopListening: () => setIsMicEnabled(false), // Override to set intent
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

