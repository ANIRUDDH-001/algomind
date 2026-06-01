/**
 * @codesage
 * @file      src/hooks/useInterviewVoice.ts
 * @purpose   React hook coordinating Text-to-Speech (TTS), Speech-to-Text (STT), Voice Activity Detection (VAD), and mic intents for the interview.
 * @tech      React
 * @connects  Composes useTTS, useSTT, useVAD; Used by useInterviewControl or InterviewSession
 * @apis      none
 * @db        none
 * @state     React component state for mic intent, VAD status, TTS status, and timers
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { useSTT } from '@/hooks/useSTT';
import { useVAD } from '@/hooks/useVAD';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import type { MicIntent } from './useInterview';
import { InterruptionManager, InterruptionDecision } from '@/lib/voice/interruption-manager';
import type { TTSProvider } from '@/lib/voice/tts-engine';
import { getVoiceRuntimeFlags } from '@/lib/api/adapters/voice-adapter';

export interface UseInterviewVoiceOptions {
    sttProvider?: 'whisper' | 'browser';
    voicePrefs?: { name: string | null; rate: number; pitch: number };
    onVADFallback: () => void;
    userTtsProvider?: 'auto' | 'polly' | 'browser';
}

export interface UseInterviewVoiceReturn {
    // TTS
    isSpeaking: boolean;
    speak: (text: string) => void;
    speakAndWait: (text: string, maxRetries?: number) => Promise<boolean>;
    stopSpeaking: () => void;
    ttsProvider: TTSProvider;
    ttsError: boolean;
    setTtsError: React.Dispatch<React.SetStateAction<boolean>>;
    voiceError: Error | null;

    // STT / VAD
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    transcript: string;
    interimTranscript: string;
    isTranscribing: boolean;
    permissionState: PermissionState | 'unknown' | null;
    sttResolvedProvider: string;
    resetTranscript: () => void;
    vadFailed: boolean;
    setVadFailed: React.Dispatch<React.SetStateAction<boolean>>;
    isPushToTalk: boolean;
    sttProvider: 'whisper' | 'browser';
    setVadEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    // Mic intent
    micIntent: MicIntent;
    setMicIntent: React.Dispatch<React.SetStateAction<MicIntent>>;
    isMicEnabled: boolean;
    micStoppedManually: boolean;
    setMicStoppedManually: React.Dispatch<React.SetStateAction<boolean>>;
    toggleMic: () => void;

    // Countdown
    sendCountdown: number | null;
    setSendCountdown: React.Dispatch<React.SetStateAction<number | null>>;

    // Refs (for use in control hook)
    isSpeakingRef: React.MutableRefObject<boolean>;
    isListeningRef: React.MutableRefObject<boolean>;
    smartPauseActiveRef: React.MutableRefObject<boolean>;
    smartPauseTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    sendCountdownIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
    mediaStreamRef: React.MutableRefObject<MediaStream | null> | undefined;
    ttsRef: any; // Using any for ttsRef to avoid brittle typings internally
    interruptionManager: InterruptionManager;
}

export function useInterviewVoice({
    voicePrefs,
    onVADFallback,
    userTtsProvider
}: UseInterviewVoiceOptions): UseInterviewVoiceReturn {
    // -- Mic Intent & State --
    const [micIntent, setMicIntent] = useState<MicIntent>('off');
    const [voiceError, setVoiceError] = useState<Error | null>(null);
    const [micStoppedManually, setMicStoppedManually] = useState(false);
    const [sendCountdown, setSendCountdown] = useState<number | null>(null);
    const [ttsError, setTtsError] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [vadFailed, setVadFailed] = useState(false);
    const [vadEnabled, setVadEnabled] = useState(true);

    // -- Smart Pause Refs --
    const smartPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const smartPauseActiveRef = useRef(false);
    const sendCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTranscriptTimeRef = useRef<number>(0);
    const transcriptRef = useRef('');

    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

    const isMicEnabled = micIntent === 'user-on' || micIntent === 'auto-on';

    const whisperEnabledFromHook = useGlobalFeatureFlag('ENABLE_WHISPER_STT', true);
    const [whisperEnabled, setWhisperEnabled] = useState(whisperEnabledFromHook);

    useEffect(() => {
        // Compatibility mode: local hook value remains baseline while adapter path rolls out.
        setWhisperEnabled(whisperEnabledFromHook);
    }, [whisperEnabledFromHook]);

    useEffect(() => {
        let cancelled = false;
        getVoiceRuntimeFlags({
            pollyEnabled: false,
            whisperEnabled: whisperEnabledFromHook,
        })
            .then(flags => {
                if (!cancelled) {
                    setWhisperEnabled(flags.whisperEnabled);
                }
            })
            .catch(() => {
                // Keep compatibility fallback on adapter/read failure.
            });
        return () => {
            cancelled = true;
        };
    }, [whisperEnabledFromHook]);

    const provider: 'whisper' | 'browser' = (
        whisperEnabled &&
        !vadFailed &&
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined'
    ) ? 'whisper' : 'browser';

    const tts = useTTS({
        onSpeakStart: () => {},
        onSpeakEnd: () => {},
        voiceName: voicePrefs?.name ?? null,
        voiceRate: voicePrefs?.rate ?? 1.0,
        voicePitch: voicePrefs?.pitch ?? 1.0,
        userTtsProvider,
    });

    const isSpeakingRef = useRef(false);
    useEffect(() => {
        isSpeakingRef.current = tts.isSpeaking;
    }, [tts.isSpeaking]);

    // -- InterruptionManager --
    const [im] = useState(() => new InterruptionManager({ graceMs: 500, debounceMs: 1000 }));

    // Wire TTS lifecycle to IM
    useEffect(() => {
        if (tts.isSpeaking) {
            im.handleAIResponseStart();
        } else {
            im.handleAIResponseComplete();
        }
    }, [tts.isSpeaking, im]);

    const stt = useSTT({
        provider: provider,
        silenceMs: 15000,
        onTranscript: (text: string, isFinal: boolean) => {
            if (isFinal) {
                setTranscript(prev => prev ? `${prev} ${text}` : text);
            } else {
                setInterimTranscript(text);
            }
            lastTranscriptTimeRef.current = Date.now();
        },
        onSilenceTimeout: () => { },
        onError: (err) => setVoiceError(new Error(err)),
    });

    const isListeningRef = useRef(false);
    useEffect(() => {
        isListeningRef.current = stt.isListening;
    }, [stt.isListening]);

    useVAD({
        enabled: vadEnabled && provider === 'whisper',
        onSpeechStart: () => {
            // Delegate to InterruptionManager with confidence filtering
            const decision = im.handleUserSpeechStartWithConfidence(0.85);
            if (decision === InterruptionDecision.INTERRUPT_IMMEDIATELY) {
                tts.stop();
                smartPauseActiveRef.current = false;
            } else if (decision === InterruptionDecision.WAIT || decision === InterruptionDecision.ALLOW_INPUT) {
                // IM handles the grace timer internally
                if (isSpeakingRef.current) {
                    tts.stop();
                    smartPauseActiveRef.current = true;
                    if (smartPauseTimerRef.current) clearTimeout(smartPauseTimerRef.current);
                    smartPauseTimerRef.current = setTimeout(() => {
                        if (smartPauseActiveRef.current) {
                            smartPauseActiveRef.current = false;
                            setMicStoppedManually(false);
                            setMicIntent('auto-on');
                        }
                    }, 1500);
                }
            }
            // IGNORE decision: do nothing (noise spike)
        },
        onSpeechEnd: (audio) => {
            if (isSpeakingRef.current) return; // echo guard
            im.handleUserSpeechEnd();
            smartPauseActiveRef.current = false;
            if (smartPauseTimerRef.current) {
                clearTimeout(smartPauseTimerRef.current);
                smartPauseTimerRef.current = null;
            }
            stt.transcribeAudio(audio);
        },
        onFallback: () => {
            console.warn('[useInterviewVoice] VAD failed, cascading to browser STT');
            setVadFailed(true);
            onVADFallback();
        },
    });

    const { resetTranscript: sttResetTranscript } = stt;
    const resetTranscript = useCallback(() => {
        transcriptRef.current = '';
        sttResetTranscript();
        setTranscript('');
        setInterimTranscript('');
        lastTranscriptTimeRef.current = 0;
    }, [sttResetTranscript]); // Make sure dependencies are correct here

    const toggleMic = useCallback(() => {
        setMicIntent(prev => {
            if (prev === 'user-on' || prev === 'auto-on') {
                setMicStoppedManually(true);
                return 'off';
            }
            setMicStoppedManually(false);
            setSendCountdown(null);
            return 'user-on';
        });
    }, []);

    return {
        isSpeaking: tts.isSpeaking,
        speak: tts.speak,
        speakAndWait: tts.speakAndWait,
        stopSpeaking: tts.stop,
        ttsProvider: tts.provider as TTSProvider,
        ttsError,
        setTtsError,
        voiceError,

        isListening: stt.isListening,
        startListening: stt.startListening,
        stopListening: stt.stopListening,
        transcript,
        interimTranscript,
        isTranscribing: stt.isTranscribing,
        permissionState: stt.permissionState,
        sttResolvedProvider: stt.resolvedProvider,
        resetTranscript,
        vadFailed,
        setVadFailed,
        isPushToTalk: vadFailed || provider === 'browser',
        sttProvider: provider,
        setVadEnabled,

        micIntent,
        setMicIntent,
        isMicEnabled,
        micStoppedManually,
        setMicStoppedManually,
        toggleMic,

        sendCountdown,
        setSendCountdown,

        isSpeakingRef,
        isListeningRef,
        smartPauseActiveRef,
        smartPauseTimerRef,
        sendCountdownIntervalRef,
        mediaStreamRef: stt.mediaStreamRef,
        ttsRef: { current: tts },
        interruptionManager: im,
    };
}
