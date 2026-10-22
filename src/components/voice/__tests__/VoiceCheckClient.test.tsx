/**
 * @codesage
 * @file      src/components/voice/__tests__/VoiceCheckClient.test.tsx
 * @purpose   /voice-check self-test: four rows (mic, speech detection, transcription, speaker) + copyable report.
 * @tech      Vitest, React Testing Library
 * @connects  ../VoiceCheckClient with MicController, getSpeechQueue and fetch mocked
 * @apis      /api/voice/transcribe (mocked)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Listener = (e: unknown) => void;
type MicOpts = { onStatus?(s: string, d?: string): void; onSpeechEnd?(a: Float32Array): void };

const h = vi.hoisted(() => ({
    mic: null as null | { o: MicOpts; intents: string[]; disposed: boolean },
    listeners: new Set<(e: unknown) => void>(),
    enqueued: [] as string[],
    unlock: vi.fn(),
}));

vi.mock('@/lib/voice/mic-controller', () => ({
    createBrowserVad: vi.fn(),
    MicController: class {
        constructor(o: MicOpts) { h.mic = { o, intents: [], disposed: false }; }
        async setIntent(i: string) { h.mic!.intents.push(i); if (i === 'listen') h.mic!.o.onStatus?.('listening'); }
        async dispose() { h.mic!.disposed = true; }
    },
}));
vi.mock('@/lib/voice/speech-queue', () => ({
    getSpeechQueue: () => ({
        unlock: h.unlock,
        on: (fn: Listener) => { h.listeners.add(fn); return () => { h.listeners.delete(fn); }; },
        enqueue: (t: string) => { h.enqueued.push(t); },
        stop: () => {},
    }),
}));

import { VoiceCheckClient } from '../VoiceCheckClient';

const emit = (e: unknown) => act(() => { h.listeners.forEach(fn => fn(e)); });
const status = (id: string) => screen.getByTestId(`check-${id}`).getAttribute('data-status');
const KAI_LINE = "This is Kai. If you can hear me, you're all set.";

describe('VoiceCheckClient', () => {
    let writeText: ReturnType<typeof vi.fn>;
    let getUserMedia: () => Promise<unknown>;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        h.mic = null; h.listeners.clear(); h.enqueued = []; h.unlock.mockClear();
        getUserMedia = async () => ({
            getAudioTracks: () => [{ label: 'Built-in Microphone', stop() {} }],
            getTracks: () => [{ stop() {} }],
        });
        Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => getUserMedia() }, configurable: true });
        writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        fetchMock = vi.fn(async () => new Response(
            JSON.stringify({ text: 'testing one two three', model: 'whisper-large-v3-turbo', timing: { preMs: 12, groqMs: 340 } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
        ));
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it('runs all four checks in order, passes each, and copies a report with the transcript', async () => {
        render(<VoiceCheckClient />);
        fireEvent.click(screen.getByRole('button', { name: /run check/i }));
        // Chrome only lets speech play after a gesture: unlock must happen inside the click itself.
        expect(h.unlock).toHaveBeenCalledTimes(1);

        await waitFor(() => expect(status('mic')).toBe('pass'));
        expect(screen.getByText(/Built-in Microphone/)).toBeTruthy();
        await waitFor(() => expect(status('speech')).toBe('running'));
        expect(h.mic!.intents).toEqual(['listen']);

        act(() => h.mic!.o.onSpeechEnd!(new Float32Array(16000)));
        await waitFor(() => expect(status('transcription')).toBe('pass'));
        expect(status('speech')).toBe('pass');
        expect(fetchMock.mock.calls[0][0]).toBe('/api/voice/transcribe');
        expect(screen.getByText(/testing one two three/)).toBeTruthy();
        expect(h.mic!.disposed).toBe(true); // the check never leaves the mic open

        await waitFor(() => expect(h.enqueued).toEqual([KAI_LINE]));
        emit({ type: 'first-audio', latencyMs: 180, voice: 'Google US English' });
        await waitFor(() => expect(status('speaker')).toBe('pass'));
        expect(screen.getByText(/Google US English/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /copy report/i }));
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        const report = writeText.mock.calls[0][0] as string;
        expect(report).toContain('"transcript":"testing one two three"');
        expect(JSON.parse(report).rows.map((r: { status: string }) => r.status)).toEqual(['pass', 'pass', 'pass', 'pass']);
    });

    it('a blocked microphone fails row 1 with the fix hint, skips the mic rows, and still tests the speaker', async () => {
        getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
        render(<VoiceCheckClient />);
        fireEvent.click(screen.getByRole('button', { name: /run check/i }));

        await waitFor(() => expect(status('mic')).toBe('fail'));
        expect(screen.getByText(/Allow microphone in the address bar/)).toBeTruthy();
        await waitFor(() => expect(h.enqueued).toEqual([KAI_LINE]));
        expect(status('speech')).toBe('skipped');
        expect(status('transcription')).toBe('skipped');
        expect(h.mic).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('"No, I did not hear it" fails the speaker row with the sound-output hint', async () => {
        getUserMedia = async () => { throw new DOMException('Requested device not found', 'NotFoundError'); };
        render(<VoiceCheckClient />);
        fireEvent.click(screen.getByRole('button', { name: /run check/i }));
        await waitFor(() => expect(h.enqueued).toHaveLength(1));
        expect(screen.getByText(/No microphone found/)).toBeTruthy();
        emit({ type: 'first-audio', latencyMs: 90, voice: 'Microsoft Zira' });
        await waitFor(() => expect(status('speaker')).toBe('pass'));

        fireEvent.click(screen.getByRole('button', { name: /^no/i }));
        expect(status('speaker')).toBe('fail');
        expect(screen.getByText(/Sound → Output/)).toBeTruthy();
    });
});
