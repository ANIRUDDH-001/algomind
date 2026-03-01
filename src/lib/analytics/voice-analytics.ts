import { logSystemEvent } from '@/lib/monitoring/events';

export function logVoiceSession(opts: {
    tts: 'polly' | 'browser';
    stt: 'whisper' | 'browser';
    vad: 'onnx' | 'push-to-talk';
    userId: string | null;
}) {
    logSystemEvent({ type: 'voice_session_start', userId: opts.userId ?? undefined, metadata: opts })
        .catch(() => { });
}
