import { logSystemEvent } from '@/lib/monitoring/events';

export function logVoiceSessionStart(opts: {
    tts: 'polly' | 'browser';
    stt: 'whisper' | 'browser';
    vad: 'onnx' | 'push-to-talk';
    userId: string | null;
}) {
    logSystemEvent({
        type: 'voice_session_start',
        userId: opts.userId ?? undefined,
        metadata: { tts: opts.tts, stt: opts.stt, vad: opts.vad },
    }).catch(() => { });
}

export function logTTSFallback(reason: string) {
    logSystemEvent({
        type: 'tts_fallback',
        metadata: { from: 'polly', to: 'browser', reason },
    }).catch(() => { });
}

export function logSTTFallback(reason: string) {
    logSystemEvent({
        type: 'stt_fallback',
        metadata: { from: 'whisper', to: 'browser', reason },
    }).catch(() => { });
}

export function logVADFallback(reason: string) {
    logSystemEvent({
        type: 'vad_fallback',
        metadata: { from: 'onnx', to: 'push-to-talk', reason },
    }).catch(() => { });
}
