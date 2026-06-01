/**
 * @codesage
 * @file      src/lib/api/__tests__/voice-adapter.test.ts
 * @purpose   Tests for voice API adapter
 * @tech      vitest
 * @connects  imports getVoiceRuntimeFlags, transcribeVoiceAudio from '@/lib/api/adapters/voice-adapter'
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetVoiceFlagsCacheForTests, getVoiceRuntimeFlags, transcribeVoiceAudio } from '@/lib/api/adapters/voice-adapter';

describe('voice adapter runtime flags', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetVoiceFlagsCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetVoiceFlagsCacheForTests();
  });

  it('returns API-derived values when /api/flags succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ENABLE_AWS_POLLY_TTS: { value: true },
          ENABLE_WHISPER_STT: { value: false },
        }),
      })
    );

    const flags = await getVoiceRuntimeFlags({ pollyEnabled: false, whisperEnabled: true });

    expect(flags).toEqual({
      pollyEnabled: true,
      whisperEnabled: false,
      source: 'api',
    });
  });

  it('falls back when /api/flags fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const flags = await getVoiceRuntimeFlags({ pollyEnabled: false, whisperEnabled: true });

    expect(flags).toEqual({
      pollyEnabled: false,
      whisperEnabled: true,
      source: 'fallback',
    });
  });

  it('uses cached API value for subsequent calls within TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ENABLE_AWS_POLLY_TTS: { value: true },
        ENABLE_WHISPER_STT: { value: true },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const first = await getVoiceRuntimeFlags();
    const second = await getVoiceRuntimeFlags();

    expect(first.source).toBe('api');
    expect(second.source).toBe('api');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('transcribes voice form data through voice adapter endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ text: 'hello world' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const form = new FormData();
    form.append('audio', new Blob(['x'], { type: 'audio/wav' }), 'audio.wav');

    const data = await transcribeVoiceAudio(form);

    expect(data).toEqual({ text: 'hello world' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/voice/transcribe',
      expect.objectContaining({ method: 'POST', body: form })
    );
  });
});
