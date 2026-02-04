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

const AUTO_SUBMIT_DELAY = 3500; // 3.5 seconds of silence

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

    // Auto-Submit Logic
    useEffect(() => {
        if (!autoSubmitEnabled || !isListening || !transcript || isProcessing) return;

        const timeSinceLastResult = Date.now() - lastResultTime;
        if (timeSinceLastResult >= AUTO_SUBMIT_DELAY) {
            console.log('Auto-submitting due to silence...');
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
    const startInterview = async (problemTitle: string, problemContent: string) => {
        currentProblemRef.current = { title: problemTitle, content: problemContent };
        stateMachine.current.transition('START');
        setState(stateMachine.current.getState());

        const sysPrompt = generateSystemPrompt();
        const introPrompt = generateTurnPrompt({
            state: 'problem-intro',
            problemTitle,
            problemContent,
            transcript: '',
            conversationHistory: '',
            ragContext: ''
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
            addMessage({ role: 'assistant', content: "Something went wrong. Could you repeat that?", timestamp: new Date() });
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        state,
        messages,
        isProcessing,
        startInterview,
        submitUserResponse,
        autoSubmitEnabled,
        setAutoSubmitEnabled,
        voice: {
            isListening,
            transcript,
            interimTranscript,
            startListening,
            stopListening,
            isSpeaking,
            pauseSpeaking,
            resumeSpeaking,
            stopSpeaking,
            error: voiceError
        }
    };
}
