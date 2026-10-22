/**
 * @codesage
 * @file      src/hooks/__tests__/useInterview.turns.test.ts
 * @purpose   Turn commit: fast on complete sentences, patient on trailing speech, never mid-speech / mid-transcription; real mute.
 * @tech      Vitest (fake timers), React Testing Library
 * @connects  Tests useInterview (turn-commit scheduler, VAD callbacks, toggleMute) with mocked useVAD/useSTT/useTTS
 * @apis      /api/chat (mocked SSE)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type VadOpts = { onSpeechStart?(): void; onSpeechEnd?(a: Float32Array): void; onMisfire?(): void };
type SttOpts = { onTranscript(text: string, isFinal: boolean): void };

const m = vi.hoisted(() => ({
    vadOpts: null as null | VadOpts,
    sttOpts: null as null | SttOpts,
    vad: { mode: 'onnx', isListening: false, isReady: true, status: 'off', startListening: vi.fn(), stopListening: vi.fn(), poke: vi.fn() },
    tts: { speak: vi.fn(), speakAndWait: vi.fn().mockResolvedValue(true), enqueue: vi.fn(), whenIdle: () => Promise.resolve(), stop: vi.fn(), unlock: vi.fn(), isSpeaking: false, blocked: false, provider: 'browser' },
    stt: {
        isListening: false, isTranscribing: false, transcript: '', interimTranscript: '',
        startListening: vi.fn(), stopListening: vi.fn(), resetTranscript: vi.fn(), transcribeAudio: vi.fn(),
        permissionState: 'granted', resolvedProvider: 'whisper', mediaStreamRef: { current: null },
    },
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? true : def),
}));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => m.tts }));
vi.mock('@/hooks/useSTT', () => ({ useSTT: (o: SttOpts) => { m.sttOpts = o; return m.stt; } }));
vi.mock('@/hooks/useVAD', () => ({ useVAD: (o: VadOpts) => { m.vadOpts = o; return m.vad; } }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useInterview } from '../useInterview';

const baseConfig = { mode: 'practice', difficultyMode: 'practice', maxDurationMs: 600000, maxTurnsPerProblem: 20 } as never;
const sse = (text: string) => {
    const enc = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(c) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
            c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, fullText: text })}\n\n`));
            c.close();
        },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

let fetchMock: ReturnType<typeof vi.fn>;
const chatCalls = () => fetchMock.mock.calls.length;

async function activeInterview() {
    const hook = renderHook(() => useInterview({ config: baseConfig }));
    await act(async () => {
        await hook.result.current.startInterview({ problemTitle: 'Two Sum', problemContent: 'Find two numbers.' });
    });
    return hook;
}

/** The candidate stops talking now; Whisper answers `latencyMs` later with `text`. */
async function speak(text: string, latencyMs = 100) {
    await act(async () => { m.vadOpts!.onSpeechStart?.(); m.vadOpts!.onSpeechEnd?.(new Float32Array(160)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(latencyMs); m.sttOpts!.onTranscript(text, true); });
}
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useInterview turn commit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        m.stt.isTranscribing = false;
        fetchMock = vi.fn().mockImplementation(async () => sse('Good. What next?'));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('MediaRecorder', class {});
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('commits a complete sentence as soon as ~900ms of silence has passed', async () => {
        await activeInterview();
        const before = chatCalls();
        await speak('What are the constraints?', 100); // 800ms VAD window + 100ms Whisper = 900ms silence
        await advance(0);
        expect(chatCalls()).toBe(before + 1);
    });

    it('waits 2.8s of total silence when the candidate trails off mid-thought', async () => {
        await activeInterview();
        const before = chatCalls();
        await speak('So the approach would be', 100);
        await advance(1_800); // 2,700ms total
        expect(chatCalls()).toBe(before);
        await advance(150);   // 2,850ms total
        expect(chatCalls()).toBe(before + 1);
    });

    it('does not commit when the candidate resumes speaking before the silence elapses', async () => {
        await activeInterview();
        const before = chatCalls();
        await speak('So the approach would be', 100);
        await advance(1_000);
        await act(async () => { m.vadOpts!.onSpeechStart?.(); });
        await advance(10_000);
        expect(chatCalls()).toBe(before);
    });

    it('a VAD misfire (cough) after resuming does not strand the turn', async () => {
        await activeInterview();
        const before = chatCalls();
        await speak('So the approach would be', 100);
        await advance(1_000);
        await act(async () => { m.vadOpts!.onSpeechStart?.(); m.vadOpts!.onMisfire?.(); });
        await advance(3_000);
        expect(chatCalls()).toBe(before + 1);
    });

    it('never commits while a transcription is still in flight', async () => {
        const hook = await activeInterview();
        const before = chatCalls();
        m.stt.isTranscribing = true;       // a later segment is still with Whisper
        hook.rerender();
        await speak('What are the constraints?', 100);
        await advance(5_000);
        expect(chatCalls()).toBe(before);
        m.stt.isTranscribing = false;      // Whisper finished (returned nothing new)
        hook.rerender();
        await advance(0);
        expect(chatCalls()).toBe(before + 1);
    });

    it('mute stays muted after Kai replies (no auto re-arm)', async () => {
        const hook = await activeInterview();
        await act(async () => { hook.result.current.voice.toggleMute(); });
        expect(hook.result.current.voice.isMuted).toBe(true);
        expect(hook.result.current.micIntent).toBe('off');
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        expect(hook.result.current.isMicEnabled).toBe(false); // not re-armed to 'auto-on' after Kai's reply
        await act(async () => { hook.result.current.voice.toggleMute(); });
        expect(hook.result.current.voice.isMuted).toBe(false);
        expect(hook.result.current.micIntent).toBe('auto-on');
    });
});
