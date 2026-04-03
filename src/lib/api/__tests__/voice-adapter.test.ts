import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetVoiceFlagsCacheForTests, getVoiceRuntimeFlags } from '@/lib/api/adapters/voice-adapter';

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
});
