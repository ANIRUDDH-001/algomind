import { useRef, useEffect, useCallback } from 'react';
import { InterviewStateMachine, InterviewState } from '@/lib/interview/state-machine';
import type { Message } from './useInterviewMessages';
import type { InterviewConfig } from '@/lib/interview/interview-config';
import type { KaiMemoryStructured } from '@/types/kai-memory';
import type { Problem } from '@/types/problem';

import { useInterviewMessages } from './useInterviewMessages';
export type { Message } from './useInterviewMessages';
import { useInterviewVoice } from './useInterviewVoice';
import { useInterviewApi } from './useInterviewApi';
import { useInterviewControl } from './useInterviewControl';

export type MicIntent = 'user-on' | 'auto-on' | 'paused-for-ai' | 'off';

export interface ProblemContext {
    title: string;
    content: string;
    ragContext?: string;
    kaiMemory?: string;
    kaiMemoryStructured?: KaiMemoryStructured | null;
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
    isReviewMode?: boolean;
    apiEndpoint?: string;
    sessionToken?: string;
    onUserMessage?: (msg: Message, count: number) => void;
    isGuest?: boolean;
}

export function useInterview(options: UseInterviewOptions) {
    const optionsRef = useRef(options);
    
     
    useEffect(() => { optionsRef.current = options; },
        // We explicitly break exhaustive-deps to match the pre-refactor behavior where we manually watch nested dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options.config, options.isTimeUp, options.turnsRemaining, options.timeRemaining, options.voicePrefs, options.isReviewMode, options.apiEndpoint, options.sessionToken, options.onUserMessage, options.isGuest]
    );

    // Shared state / refs
    const stateMachineRef = useRef(new InterviewStateMachine());
    const currentProblemRef = useRef<ProblemContext | null>(null);
    const timeUpRef = useRef(false);
    timeUpRef.current = !!options.isTimeUp;

    // 1. Messages hook
    const msgs = useInterviewMessages();

    // 2. Voice hook
    const voice = useInterviewVoice({
        voicePrefs: options.voicePrefs,
        onVADFallback: () => {},
    });

    // 3. API hook
    const api = useInterviewApi({
        conversationHistoryRef: msgs.conversationHistoryRef,
        currentProblemRef,
        stateMachineRef,
        optionsRef,
    });

    // 4. Removed unused limits hook

    const stableStartListening = useCallback(() => {
        voice.startListening();
        voice.setMicIntent('user-on');
        voice.setMicStoppedManually(false);
    }, [voice]);

    const stableStopListening = useCallback(() => {
        voice.stopListening();
        voice.setMicIntent('off');
        voice.setMicStoppedManually(true);
    }, [voice]);

    // 5. Control hook
    const control = useInterviewControl({
        voice: {
            ...voice,
            startListening: stableStartListening,
            stopListening: stableStopListening,
            isMicEnabled: voice.micIntent === 'user-on' || voice.micIntent === 'auto-on' || voice.micIntent === 'paused-for-ai',
        },
        messages: msgs,
        api,
        stateMachineRef,
        currentProblemRef,
        optionsRef,
        timeUpRef,
    });

    const stableSubmitUserResponseRef = useRef<typeof control.submitUserResponse>(control.submitUserResponse);
    useEffect(() => {
        stableSubmitUserResponseRef.current = control.submitUserResponse;
    }, [control.submitUserResponse]);

    const stableSubmitUserResponse = useCallback(
        async (userText: string, problemContext: ProblemContext) => {
            return stableSubmitUserResponseRef.current(userText, problemContext);
        },
        [] 
    );

    return {
        state: control.state,
        setState: control.setState,
        messages: msgs.messages,
        isProcessing: control.isProcessing,
        startInterview: control.startInterview,
        resetInterview: control.resetInterview,
        submitUserResponse: stableSubmitUserResponse,
        handleInterruption: control.handleInterruption,
        endInterview: control.endInterview,
        roundCount: control.roundCount,
        interviewStartTime: control.interviewStartTime,
        isLimitReached: control.isLimitReached,
        limitReason: control.limitReason,
        isMicEnabled: voice.isMicEnabled,
        micIntent: voice.micIntent,
        micStoppedManually: voice.micStoppedManually,
        sendCountdown: voice.sendCountdown,
        ttsError: voice.ttsError,
        vadFailed: voice.vadFailed,
        isPushToTalk: voice.isPushToTalk,
        enterCodingMode: control.enterCodingMode,
        exitCodingMode: control.exitCodingMode,
        shareCode: control.shareCode,
        ttsProvider: voice.ttsProvider,
        sttProvider: voice.sttProvider,
        loadTranscript: msgs.loadTranscript,
        voice: {
            isListening: voice.isListening,
            transcript: voice.transcript,
            interimTranscript: voice.interimTranscript,
            isTranscribing: voice.isTranscribing,
            startListening: stableStartListening,
            stopListening: stableStopListening,
            toggleMic: voice.toggleMic,
            isMicEnabled: voice.micIntent === 'user-on' || voice.micIntent === 'auto-on' || voice.micIntent === 'paused-for-ai',
            isSpeaking: voice.isSpeaking,
            speak: voice.speak,
            stopSpeaking: voice.stopSpeaking,
            error: voice.voiceError,
            permissionState: voice.permissionState,
            sttResolvedProvider: voice.sttResolvedProvider,
            setVadEnabled: voice.setVadEnabled,
            resetTranscript: voice.resetTranscript,
        },
        interruptionManager: voice.interruptionManager,
    };
}
