/**
 * @codesage
 * @file      src/hooks/__tests__/useInterview.streaming-speech.test.ts
 * @purpose   Kai speaks sentence-by-sentence while the reply is still streaming (not after it completes).
 * @tech      Vitest, React Testing Library
 * @connects  Tests useInterview (callChatApi SSE → SentenceStreamer → useTTS.enqueue)
 * @apis      /api/chat (mocked SSE)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stable mock objects: the real hooks return memoized callbacks, and fresh vi.fn()s per render
// would re-fire every effect that depends on them.
const { enqueue, speak, tts, stt, vad } = vi.hoisted(() => {
    const enqueue = vi.fn();
    const speak = vi.fn().mockResolvedValue(undefined);
    return {
        enqueue, speak,
        tts: { speak, speakAndWait: vi.fn().mockResolvedValue(true), enqueue, whenIdle: () => Promise.resolve(), stop: vi.fn(), unlock: vi.fn(), isSpeaking: false, blocked: false, provider: 'browser' },
        stt: {
            isListening: false, isTranscribing: false, transcript: '', interimTranscript: '',
            startListening: vi.fn(), stopListening: vi.fn(), resetTranscript: vi.fn(), transcribeAudio: vi.fn(),
            permissionState: 'granted', resolvedProvider: 'whisper', mediaStreamRef: { current: null },
        },
        vad: { mode: 'onnx', isListening: false, isReady: true, status: 'off', startListening: vi.fn(), stopListening: vi.fn(), poke: vi.fn() },
    };
});

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? true : def),
}));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => tts }));
vi.mock('@/hooks/useSTT', () => ({ useSTT: () => stt }));
vi.mock('@/hooks/useVAD', () => ({ useVAD: () => vad }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useInterview } from '../useInterview';

const baseConfig = { mode: 'practice', difficultyMode: 'practice', maxDurationMs: 60000, maxTurnsPerProblem: 5 } as never;

/** SSE body we control chunk-by-chunk, so we can observe speech BEFORE the stream ends. */
function controllableSse() {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(c) { ctrl = c; } });
    return {
        response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
        send: (delta: string) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`)),
        end: (fullText: string) => { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`)); ctrl.close(); },
    };
}

describe('useInterview streaming speech', () => {
    let sse: ReturnType<typeof controllableSse>;
    beforeEach(() => {
        enqueue.mockClear(); speak.mockClear();
        sse = controllableSse();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse.response));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('queues the first sentence while the reply is still streaming, and never speaks the full text at once', async () => {
        const { result } = renderHook(() => useInterview({ config: baseConfig }));
        let started!: Promise<void>;
        await act(async () => {
            started = result.current.startInterview({ problemTitle: 'Two Sum', problemContent: 'Find two numbers.' });
        });
        await act(async () => { sse.send('Hi, I am Kai, your interviewer today. '); await new Promise(r => setTimeout(r, 20)); });
        await act(async () => { sse.send('Let us look at Two Sum.'); await new Promise(r => setTimeout(r, 20)); });

        // Stream not finished yet — the first sentence must already be queued.
        expect(enqueue).toHaveBeenCalledWith('Hi, I am Kai, your interviewer today.');

        await act(async () => { sse.end('Hi, I am Kai, your interviewer today. Let us look at Two Sum.'); await started; });
        expect(enqueue.mock.calls.map(c => c[0])).toEqual(['Hi, I am Kai, your interviewer today.', 'Let us look at Two Sum.']);
        expect(speak).not.toHaveBeenCalled();
    });

    it('interview state changes never cancel Kai mid-reply — only leaving the interview does', async () => {
        tts.stop.mockClear();
        const { result, unmount } = renderHook(() => useInterview({ config: baseConfig }));
        const stateBefore = result.current.state;
        let started!: Promise<void>;
        await act(async () => { started = result.current.startInterview({ problemTitle: 'Two Sum', problemContent: 'Find two numbers.' }); });
        await act(async () => { sse.send('Hi, I am Kai. Let us look at Two Sum.'); sse.end('Hi, I am Kai. Let us look at Two Sum.'); await started; });

        // The intro is queued and the interview moved on (e.g. idle → listening) while Kai is still talking.
        expect(enqueue).toHaveBeenCalledWith('Hi, I am Kai.');
        expect(result.current.state).not.toBe(stateBefore);
        expect(tts.stop).not.toHaveBeenCalled();

        unmount();
        expect(tts.stop).toHaveBeenCalled(); // leaving the interview page silences Kai
    });
});
