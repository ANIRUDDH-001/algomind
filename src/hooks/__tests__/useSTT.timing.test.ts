/**
 * @codesage
 * @file      src/hooks/__tests__/useSTT.timing.test.ts
 * @purpose   useSTT reports STT timing (start / done with model + server timing / error) for the voice turn timeline.
 * @tech      Vitest, React Testing Library
 * @connects  ../useSTT (voice-adapter mocked)
 * @apis      /api/voice/transcribe (mocked)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// A plain swappable function, not vi.fn(): a Vitest 4 spy whose async implementation rejects
// fails the test even when the code under test handles the rejection.
const adapter = vi.hoisted(() => ({ transcribe: async (): Promise<unknown> => ({ text: '' }) }));
vi.mock('@/lib/api/adapters/voice-adapter', () => ({ transcribeVoiceAudio: () => adapter.transcribe() }));

import { useSTT } from '../useSTT';

describe('useSTT onTiming', () => {
    afterEach(cleanup);

    it('reports start and done with the model and server timing', async () => {
        adapter.transcribe = async () => ({ text: 'use a hash map', model: 'whisper-large-v3-turbo', timing: { preMs: 30, groqMs: 400 } });
        const onTiming = vi.fn(); const onTranscript = vi.fn();
        const { result } = renderHook(() => useSTT({ provider: 'whisper', onTranscript, onTiming }));
        await act(async () => { await result.current.transcribeAudio(new Float32Array(8000)); });
        expect(onTiming.mock.calls.map(c => c[0].phase)).toEqual(['start', 'done']);
        expect(onTiming.mock.calls[0][0]).toMatchObject({ phase: 'start', audioMs: 500 });
        expect(onTiming.mock.calls[1][0]).toMatchObject({ phase: 'done', model: 'whisper-large-v3-turbo', serverTiming: { preMs: 30, groqMs: 400 } });
        expect(onTranscript).toHaveBeenCalledWith('use a hash map', true);
    });

    it('reports error when transcription fails', async () => {
        adapter.transcribe = async () => { throw new Error('Groq API Error (429)'); };
        const onTiming = vi.fn();
        const { result } = renderHook(() => useSTT({ provider: 'whisper', onTranscript: vi.fn(), onTiming }));
        await act(async () => { await result.current.transcribeAudio(new Float32Array(8000)); });
        expect(onTiming.mock.calls.map(c => c[0].phase)).toEqual(['start', 'error']);
        expect(onTiming.mock.calls[1][0].error).toMatch(/429/);
    });
});
