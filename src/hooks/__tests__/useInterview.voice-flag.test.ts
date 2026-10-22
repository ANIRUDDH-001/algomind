/**
 * @codesage
 * @file      src/hooks/__tests__/useInterview.voice-flag.test.ts
 * @purpose   ENABLE_VOICE_MODE master switch: off → no TTS/VAD, on → normal voice.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useInterview
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const speak = vi.fn().mockResolvedValue(undefined);
const speakAndWait = vi.fn().mockResolvedValue(true);
const vadStart = vi.fn();
let voiceFlag = false;

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? voiceFlag : def),
}));
vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => ({ speak, speakAndWait, stop: vi.fn(), isSpeaking: false, provider: 'browser', enqueue: vi.fn(), whenIdle: () => Promise.resolve() }),
}));
vi.mock('@/hooks/useSTT', () => ({
    useSTT: () => ({
        isListening: false, isTranscribing: false, transcript: '', interimTranscript: '',
        startListening: vi.fn(), stopListening: vi.fn(), resetTranscript: vi.fn(), transcribeAudio: vi.fn(),
        permissionState: 'granted', resolvedProvider: 'whisper', mediaStreamRef: { current: null },
    }),
}));
vi.mock('@/hooks/useVAD', () => ({
    useVAD: (o: { enabled: boolean }) => ({
        mode: 'onnx', isListening: false, isReady: true, status: 'off',
        startListening: o.enabled ? vadStart : vi.fn(), stopListening: vi.fn(), poke: vi.fn(),
    }),
}));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import { useInterview } from '../useInterview';

const baseConfig = { mode: 'practice', difficultyMode: 'practice', maxDurationMs: 60000, maxTurnsPerProblem: 5 } as never;

describe('useInterview + ENABLE_VOICE_MODE', () => {
    beforeEach(() => { speak.mockClear(); speakAndWait.mockClear(); vadStart.mockClear(); });

    it('exposes voiceEnabled=false and never speaks when the flag is off', async () => {
        voiceFlag = false;
        const { result } = renderHook(() => useInterview({ config: baseConfig }));
        expect(result.current.voiceEnabled).toBe(false);
        await act(async () => { await result.current.voice.speak('hello'); });
        expect(speak).not.toHaveBeenCalled();
    });

    it('exposes voiceEnabled=true and speaks when the flag is on', async () => {
        voiceFlag = true;
        const { result } = renderHook(() => useInterview({ config: baseConfig }));
        expect(result.current.voiceEnabled).toBe(true);
        await act(async () => { await result.current.voice.speak('hello'); });
        expect(speak).toHaveBeenCalledWith('hello');
    });
});
