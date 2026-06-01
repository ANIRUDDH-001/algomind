/**
 * @codesage
 * @file      src/lib/api/adapters/voice-adapter.ts
 * @purpose   API adapter for retrieving voice runtime flags and transcribing audio
 * @tech      fetch
 * @connects  imports requestJson from '@/lib/api/client'
 * @apis      GET /api/flags, POST /api/voice/transcribe
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { requestJson } from '@/lib/api/client';

type FlagEntry = { value: boolean; description?: string };
type FlagsResponse = Record<string, FlagEntry>;

export interface VoiceRuntimeFlags {
  pollyEnabled: boolean;
  whisperEnabled: boolean;
  source: 'api' | 'fallback';
}

export interface VoiceTranscriptionResponse {
  text: string;
}

const FLAG_CACHE_TTL_MS = 30_000;

let _flagsCache: { expiresAt: number; value: VoiceRuntimeFlags } | null = null;

export function __resetVoiceFlagsCacheForTests(): void {
  _flagsCache = null;
}

function readFlag(flags: FlagsResponse, key: 'ENABLE_AWS_POLLY_TTS' | 'ENABLE_WHISPER_STT', fallback: boolean): boolean {
  return typeof flags[key]?.value === 'boolean' ? flags[key].value : fallback;
}

export async function getVoiceRuntimeFlags(fallbacks?: { pollyEnabled?: boolean; whisperEnabled?: boolean }): Promise<VoiceRuntimeFlags> {
  const now = Date.now();
  if (_flagsCache && _flagsCache.expiresAt > now) {
    return _flagsCache.value;
  }

  const fallbackPolly = fallbacks?.pollyEnabled ?? false;
  const fallbackWhisper = fallbacks?.whisperEnabled ?? true;

  try {
    const flags = await requestJson<FlagsResponse>('/api/flags', {
      signal: AbortSignal.timeout(3000),
    });

    const value: VoiceRuntimeFlags = {
      pollyEnabled: readFlag(flags, 'ENABLE_AWS_POLLY_TTS', fallbackPolly),
      whisperEnabled: readFlag(flags, 'ENABLE_WHISPER_STT', fallbackWhisper),
      source: 'api',
    };

    _flagsCache = {
      value,
      expiresAt: now + FLAG_CACHE_TTL_MS,
    };

    return value;
  } catch {
    return {
      pollyEnabled: fallbackPolly,
      whisperEnabled: fallbackWhisper,
      source: 'fallback',
    };
  }
}

export function transcribeVoiceAudio(formData: FormData): Promise<VoiceTranscriptionResponse> {
  return requestJson<VoiceTranscriptionResponse>('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
}
