import { useState, useRef, useEffect, useCallback } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import { generateSystemPrompt, generateTurnPrompt } from '@/lib/interview/prompts';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
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

    const {
        speak,
        pause: pauseSpeaking,
        resume: resumeSpeaking,
        stop: stopSpeaking,
        isSpeaking,
        isPaused
    } = useVoiceOutput();

    // Helper to call API
    const callChatApi = async (prompt: string, systemPrompt: string, problemContext: any) => {
        try {
            const response = await fetch('/api/chat', {
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

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch chat response');
            }

            const data = await response.json();
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
            const aiMsg: Message = { role: 'assistant', content: responseText, timestamp: new Date() };

            addMessage(aiMsg);
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch (e) {
            addMessage({ role: 'assistant', content: "I'm having trouble connecting. Let's try again.", timestamp: new Date() });
        } finally {
            setIsProcessing(false);
        }
    };

    const submitUserResponse = async (userText: string, problemContext: any) => {
        if (!userText.trim()) return;


        // Don't disable intent, just stop listening momentarily for processing
        stopListening();

        const userMsg: Message = { role: 'user', content: userText, timestamp: new Date() };
        addMessage(userMsg);
        resetTranscript();

        setIsProcessing(true);
        stateMachine.current.transition('USER_FINISHED_SPEAKING');
        setState(stateMachine.current.getState());

        const methodHistory = conversationHistoryRef.current
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n');

        const prompt = generateTurnPrompt({
            state: stateMachine.current.getState(),
            problemTitle: problemContext.title,
            problemContent: problemContext.content,
            transcript: userText,
            conversationHistory: methodHistory,
            ragContext: "RETRIVE_VIA_API" // Flag for API to do its magic
        });

        try {
            const responseText = await callChatApi(prompt, generateSystemPrompt(), problemContext);
            const aiMsg: Message = { role: 'assistant', content: responseText, timestamp: new Date() };

            addMessage(aiMsg);
            speak(responseText);

            stateMachine.current.transition('AI_FINISHED_SPEAKING');
            setState(stateMachine.current.getState());
        } catch (e) {
            console.error('❌ [ERROR] Failed to process user response:', e);
            addMessage({ role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date() });
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

    return {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        autoSubmitEnabled,
        setAutoSubmitEnabled,
        loadTranscript: (msgs: Message[]) => {
            setMessages(msgs);
            conversationHistoryRef.current = msgs;
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
