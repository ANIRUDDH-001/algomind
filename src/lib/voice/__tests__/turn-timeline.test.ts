/**
 * @codesage
 * @file      src/lib/voice/__tests__/turn-timeline.test.ts
 * @purpose   TurnTimeline — stage offsets, derived latencies, merged details, batched beacon sending.
 * @tech      Vitest
 * @connects  ../turn-timeline
 * @apis      /api/voice/telemetry (sendBeacon mocked)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TurnTimeline, sendVoiceTelemetry, flush } from '../turn-timeline';

describe('TurnTimeline', () => {
    let t = 0;
    beforeEach(() => { t = 1_000; vi.spyOn(performance, 'now').mockImplementation(() => t); });
    afterEach(() => vi.restoreAllMocks());

    const at = (ms: number) => { t = 1_000 + ms; };

    it('reports stage offsets from vad_end and the derived latencies', () => {
        const tl = new TurnTimeline('s1', 3);
        at(0); tl.mark('vad_end');
        at(100); tl.mark('stt_start');
        at(600); tl.mark('stt_done', { sttModel: 'whisper-large-v3-turbo', sttServerTiming: 'pre;dur=40, groq;dur=380' });
        at(1_500); tl.mark('commit', { commitRule: 900 });
        at(1_510); tl.mark('chat_request');
        at(2_110); tl.mark('first_token', { llmModel: 'openai/gpt-oss-120b', llmProvider: 'groq' });
        at(2_400); tl.mark('first_sentence');
        at(2_700); tl.mark('first_audio', { ttsVoice: 'Google US English' });
        at(6_000); tl.mark('speech_done');
        const p = tl.finish('spoken');
        expect(p).toMatchObject({ sessionId: 's1', turn: 3, outcome: 'spoken' });
        expect(p.stages).toMatchObject({ vad_end: 0, stt_start: 100, stt_done: 600, commit: 1_500, first_audio: 2_700, speech_done: 6_000 });
        expect(p.derived).toEqual({ turnGapMs: 2_700, sttMs: 500, commitWaitMs: 900, ttftMs: 600, ttfaMs: 300 });
        expect(p.details).toEqual({
            sttModel: 'whisper-large-v3-turbo', sttServerTiming: 'pre;dur=40, groq;dur=380', commitRule: 900,
            llmModel: 'openai/gpt-oss-120b', llmProvider: 'groq', ttsVoice: 'Google US English',
        });
    });

    it('a turn with no audio has turnGapMs null (text-only / TTS failure)', () => {
        const tl = new TurnTimeline(null, 1);
        at(0); tl.mark('commit');
        at(10); tl.mark('chat_request');
        at(500); tl.mark('first_token');
        const p = tl.finish('text-only');
        expect(p.derived.turnGapMs).toBeNull();
        expect(p.derived.ttftMs).toBe(490);
        expect(p.stages.commit).toBe(0); // offsets fall back to commit when there was no vad_end
    });

    it('keeps the first time a stage is marked', () => {
        const tl = new TurnTimeline('s', 1);
        at(0); tl.mark('vad_end');
        at(50); tl.mark('first_audio');
        at(900); tl.mark('first_audio');
        expect(tl.finish('spoken').stages.first_audio).toBe(50);
    });
});

describe('sendVoiceTelemetry', () => {
    afterEach(() => { flush(); vi.restoreAllMocks(); });

    const payload = (turn: number) => new TurnTimeline('s', turn).finish('spoken');

    it('batches and beacons to /api/voice/telemetry', async () => {
        const beacon = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
        sendVoiceTelemetry([payload(1)]);
        expect(beacon).not.toHaveBeenCalled();          // waits for a batch / the flush timer
        sendVoiceTelemetry([payload(2), payload(3), payload(4), payload(5)]);
        expect(beacon).toHaveBeenCalledTimes(1);
        const [url, blob] = beacon.mock.calls[0] as [string, Blob];
        expect(url).toBe('/api/voice/telemetry');
        expect(JSON.parse(await blob.text()).events).toHaveLength(5);
    });

    it('falls back to fetch keepalive when the beacon is refused', () => {
        Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn().mockReturnValue(false), configurable: true });
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
        vi.stubGlobal('fetch', fetchMock);
        sendVoiceTelemetry([payload(1)]);
        flush();
        expect(fetchMock).toHaveBeenCalledWith('/api/voice/telemetry', expect.objectContaining({ method: 'POST', keepalive: true }));
        vi.unstubAllGlobals();
    });
});
