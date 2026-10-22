/**
 * @codesage
 * @file      src/hooks/__tests__/useInterview.timeline.test.ts
 * @purpose   Every turn ships a timeline (VAD→STT→commit→LLM→TTS) to /api/voice/telemetry; mic failures too.
 * @tech      Vitest (fake timers), React Testing Library
 * @connects  Tests useInterview marks + TurnTimeline (real) with sendVoiceTelemetry captured
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
import type { TurnTimelinePayload } from '@/lib/voice/turn-timeline';

type Opts = Record<string, (...a: never[]) => unknown>;

const m = vi.hoisted(() => {
    const m = {
        voiceOn: true,
        // audio: first sentence plays · fails: engine error · blocked: autoplay policy · silent: still waiting for audio
        ttsMode: 'audio' as 'audio' | 'fails' | 'blocked' | 'silent',
        idleResolvers: [] as Array<() => void>,
        sent: [] as TurnTimelinePayload[],
        ttsOpts: {} as Opts, sttOpts: {} as Opts, vadOpts: {} as Opts,
        audioAnnounced: false,
        tts: null as unknown as Record<string, unknown>,
        stt: {
            isListening: false, isTranscribing: false, transcript: '', interimTranscript: '',
            startListening: vi.fn(), stopListening: vi.fn(), resetTranscript: vi.fn(), transcribeAudio: vi.fn(),
            permissionState: 'granted', resolvedProvider: 'whisper', mediaStreamRef: { current: null },
        },
        vad: { mode: 'onnx', isListening: false, isReady: true, status: 'off', startListening: vi.fn(), stopListening: vi.fn(), poke: vi.fn() },
    };
    m.tts = {
        speak: vi.fn(), speakAndWait: vi.fn().mockResolvedValue(true), unlock: vi.fn(),
        isSpeaking: false, blocked: false, provider: 'browser',
        // 'silent' = Kai is still waiting for the engine to start; only stop() makes the queue idle.
        whenIdle: () => (m.ttsMode === 'silent' ? new Promise<void>(r => m.idleResolvers.push(r)) : Promise.resolve()),
        stop: vi.fn(() => { m.idleResolvers.splice(0).forEach(r => r()); }),
        // Simulates the SpeechQueue: the first queued sentence produces audio (or an engine error / block).
        enqueue: vi.fn(() => {
            if (m.audioAnnounced || m.ttsMode === 'silent') return;
            m.audioAnnounced = true;
            const onEvent = m.ttsOpts.onEvent as (e: unknown) => void;
            if (m.ttsMode === 'fails') onEvent?.({ type: 'error', code: 'synthesis-failed' });
            else if (m.ttsMode === 'blocked') onEvent?.({ type: 'blocked' });
            else onEvent?.({ type: 'first-audio', latencyMs: 150, voice: 'Google US English' });
        }),
    };
    return m;
});

vi.mock('@/lib/voice/turn-timeline', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/voice/turn-timeline')>()),
    sendVoiceTelemetry: (p: TurnTimelinePayload[]) => { m.sent.push(...p); },
}));
vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? m.voiceOn : def),
}));
vi.mock('@/hooks/useTTS', () => ({ useTTS: (o: Opts) => { m.ttsOpts = o; return m.tts; } }));
vi.mock('@/hooks/useSTT', () => ({ useSTT: (o: Opts) => { m.sttOpts = o; return m.stt; } }));
vi.mock('@/hooks/useVAD', () => ({ useVAD: (o: Opts) => { m.vadOpts = o; return m.vad; } }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useInterview } from '../useInterview';

const baseConfig = { mode: 'practice', difficultyMode: 'practice', maxDurationMs: 600000, maxTurnsPerProblem: 20 } as never;
const sse = (text: string) => {
    const enc = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(c) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
            c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, fullText: text, modelUsed: 'openai/gpt-oss-120b', provider: 'groq' })}\n\n`));
            c.close();
        },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
const call = (o: Opts, name: string, ...args: unknown[]) => (o[name] as (...a: unknown[]) => unknown)(...args);

async function activeInterview() {
    const hook = renderHook(() => useInterview({ config: baseConfig }));
    await act(async () => { await hook.result.current.startInterview({ problemTitle: 'Two Sum', problemContent: 'Find two numbers.' }); });
    m.sent.length = 0;          // the intro's own timeline (turn 0) is not under test here
    m.audioAnnounced = false;
    return hook;
}
const candidateTurns = () => m.sent.filter(p => p.turn >= 1 && p.details.micStatus === undefined);

describe('useInterview turn timeline', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        m.voiceOn = true; m.ttsMode = 'audio'; m.idleResolvers.length = 0; m.sent.length = 0; m.audioAnnounced = false;
        m.tts.isSpeaking = false;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => sse('Good. What are the constraints?')));
        vi.stubGlobal('MediaRecorder', class {});
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('a spoken turn reports every stage from speech end to Kai going quiet', async () => {
        await activeInterview();
        await act(async () => { call(m.vadOpts, 'onSpeechStart'); call(m.vadOpts, 'onSpeechEnd', new Float32Array(160)); });
        await act(async () => { call(m.sttOpts, 'onTiming', { phase: 'start', audioMs: 1200 }); });
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        await act(async () => {
            call(m.sttOpts, 'onTiming', { phase: 'done', ms: 100, model: 'whisper-large-v3-turbo', serverTiming: { preMs: 20, groqMs: 70 } });
            call(m.sttOpts, 'onTranscript', 'I would use a hash map.', true);
        });
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });

        const turns = candidateTurns();
        expect(turns).toHaveLength(1);
        const p = turns[0];
        expect(p.outcome).toBe('spoken');
        expect(p.turn).toBe(1);
        expect(Object.keys(p.stages).sort()).toEqual(
            ['chat_request', 'commit', 'first_audio', 'first_sentence', 'first_token', 'speech_done', 'stt_done', 'stt_start', 'vad_end'],
        );
        expect(p.stages.vad_end).toBe(0);
        expect(p.derived.turnGapMs).not.toBeNull();
        expect(p.details).toMatchObject({
            sttModel: 'whisper-large-v3-turbo', commitRule: 900,
            llmModel: 'openai/gpt-oss-120b', llmProvider: 'groq', ttsVoice: 'Google US English',
        });
    });

    it('a typed turn in text-only mode is timed from commit and reported as text-only', async () => {
        m.voiceOn = false;
        const hook = await activeInterview();
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        const turns = candidateTurns();
        expect(turns).toHaveLength(1);
        expect(turns[0].outcome).toBe('text-only');
        expect(turns[0].stages.commit).toBe(0);
        expect(turns[0].stages).toHaveProperty('first_token');
        expect(turns[0].stages).not.toHaveProperty('vad_end');
    });

    it('reports mic recovery / failure as an error event with micStatus', async () => {
        await activeInterview();
        await act(async () => { call(m.vadOpts, 'onStatus', 'failed', 'NotReadableError'); call(m.vadOpts, 'onStatus', 'listening'); });
        const mic = m.sent.filter(p => p.details.micStatus !== undefined);
        expect(mic).toHaveLength(1);
        expect(mic[0]).toMatchObject({ outcome: 'error', details: { micStatus: 'failed', micDetail: 'NotReadableError' } });
    });

    it('a reply the speech engine could not play is reported as an error with the engine code', async () => {
        const hook = await activeInterview();
        m.ttsMode = 'fails';
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        const [turn] = candidateTurns();
        expect(turn.outcome).toBe('error');
        expect(turn.details).toMatchObject({ ttsError: 'synthesis-failed' });
        expect(turn.derived.turnGapMs).toBeNull();
    });

    it('a reply the browser refused to play (autoplay policy) is an error that says why', async () => {
        const hook = await activeInterview();
        m.ttsMode = 'blocked';
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        const [turn] = candidateTurns();
        expect(turn.outcome).toBe('error');
        expect(turn.details).toMatchObject({ ttsError: 'not-allowed' });
    });

    it('a reply the candidate stopped (Esc / stop) before any audio is aborted, not an engine error', async () => {
        const hook = await activeInterview();
        m.ttsMode = 'silent';
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        expect(candidateTurns()).toHaveLength(0); // Kai has not spoken yet — the turn is still open
        // InterviewSession's Esc handler: stopKai() then handleInterruption().
        await act(async () => { (m.tts.stop as () => void)(); hook.result.current.handleInterruption(); });
        const turns = candidateTurns();
        expect(turns).toHaveLength(1);
        expect(turns[0].outcome).toBe('aborted');
        expect(turns[0].details).toMatchObject({ kaiInterrupted: 'user' });
    });

    it('a reply the candidate talked over (barge-in) before any audio is aborted, not an engine error', async () => {
        const hook = await activeInterview();
        m.ttsMode = 'silent';
        m.tts.isSpeaking = true;
        await act(async () => { await hook.result.current.submitUserResponse('Use a hash map.', { problemTitle: 'Two Sum', problemContent: 'x' }); });
        await act(async () => { call(m.vadOpts, 'onSpeechStart'); });
        const turns = candidateTurns();
        expect(turns).toHaveLength(1);
        expect(turns[0].outcome).toBe('aborted');
        expect(turns[0].details).toMatchObject({ kaiInterrupted: 'barge-in' });
    });
});
