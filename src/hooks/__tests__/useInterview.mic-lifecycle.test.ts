/**
 * @codesage
 * @file      src/hooks/__tests__/useInterview.mic-lifecycle.test.ts
 * @purpose   Mic sync survives a new useVAD object on status changes (no render loop); tab-visible pokes the mic.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useInterview (mic sync effect, visibility handler) with mocked useVAD/useSTT/useTTS
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

const m = vi.hoisted(() => {
    const vad = { mode: 'onnx', isListening: false, isReady: true, status: 'off', startListening: vi.fn(), stopListening: vi.fn(), poke: vi.fn() };
    return {
        vad,
        renders: 0,
        tts: { speak: vi.fn(), speakAndWait: vi.fn().mockResolvedValue(true), enqueue: vi.fn(), whenIdle: () => Promise.resolve(), stop: vi.fn(), unlock: vi.fn(), isSpeaking: false, blocked: false, provider: 'browser' },
        stt: {
            isListening: false, isTranscribing: false, transcript: '', interimTranscript: '',
            startListening: vi.fn(), stopListening: vi.fn(), resetTranscript: vi.fn(), transcribeAudio: vi.fn(),
            permissionState: 'granted', resolvedProvider: 'whisper', mediaStreamRef: { current: null },
        },
    };
});

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? true : def),
}));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => m.tts }));
vi.mock('@/hooks/useSTT', () => ({ useSTT: () => m.stt }));
// Like the real hook, the returned object changes identity (here: on every render), functions stay stable.
vi.mock('@/hooks/useVAD', () => ({
    useVAD: () => {
        if (++m.renders > 400) throw new Error('render loop: useVAD rendered > 400 times');
        return { ...m.vad };
    },
}));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useInterview } from '../useInterview';

const baseConfig = { mode: 'practice', difficultyMode: 'practice', maxDurationMs: 60000, maxTurnsPerProblem: 5 } as never;
const sseResponse = (text: string) => {
    const enc = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(c) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
            c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, fullText: text })}\n\n`));
            c.close();
        },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function startActiveInterview() {
    const hook = renderHook(() => useInterview({ config: baseConfig }));
    await act(async () => {
        await hook.result.current.startInterview({ problemTitle: 'Two Sum', problemContent: 'Find two numbers.' });
    });
    return hook;
}

describe('useInterview mic lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.renders = 0;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => sseResponse('Hi, I am Kai. Let us look at Two Sum.')));
        vi.stubGlobal('MediaRecorder', class {}); // jsdom lacks it; without it sttProvider falls back to 'browser' (no VAD)
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it('starts the mic after Kai finishes even though useVAD returns a new object each render', async () => {
        await startActiveInterview();
        await act(async () => { await wait(150); });
        expect(m.vad.startListening).toHaveBeenCalled();
        expect(m.renders).toBeLessThan(100);
    });

    it('pokes the mic when the tab becomes visible again', async () => {
        await startActiveInterview();
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await wait(0); });
        expect(m.vad.poke).toHaveBeenCalledWith('visible');
    });
});
