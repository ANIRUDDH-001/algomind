# Microphone Fix — Full Implementation Plan

> **Created**: March 3, 2026
> **Scope**: Fix all mic/recording functionality across every browser and device
> **Outcome**: Working TTS, STT, and VAD cascades with universal fallbacks

---

## Table of Contents

1. [Root Cause Analysis](#root-cause-analysis)
2. [Target Architecture](#target-architecture)
3. [Phase 0 — Emergency Chrome Fix](#phase-0--emergency-chrome-fix-day-1)
4. [Phase 1 — Cross-Browser STT Rewrite](#phase-1--cross-browser-stt-rewrite-day-2-3)
5. [Phase 2 — Mic Lifecycle Rewrite](#phase-2--mic-lifecycle-rewrite-in-useinterview-day-3-4)
6. [Phase 3 — Enable Whisper + VAD as Default](#phase-3--enable-whisper--vad-as-default-day-4-5)
7. [Phase 4 — ConversationView VAD Integration](#phase-4--uncomment-and-implement-conversationview-vad-day-5-6)
8. [Phase 5 — UX Resilience Layer](#phase-5--ux-resilience-layer-day-6-7)
9. [Execution Order & Dependencies](#execution-order--dependencies)
10. [Files Touched Summary](#files-touched-summary)
11. [Verification Checklist](#verification-checklist)

---

## Root Cause Analysis

### Critical Issues (Breaking mic entirely)

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| **RC-1** | `ENABLE_WHISPER_STT` defaults to `false` — Whisper path is dead on arrival | `src/lib/feature-flags.ts` | 56-63 | STT provider resolves to `'browser'`, all Whisper/VAD audio paths skipped |
| **RC-2** | Browser `SpeechRecognition` is Chrome/Edge only | `src/hooks/useSTT.ts` | 62-63 | Firefox, Safari, Brave, mobile browsers have zero STT — no fallback exists |
| **RC-3** | `useVoiceActivityDetection` hook in `ConversationView` is **entirely commented out** | `src/components/interview/ConversationView.tsx` | 107-145 | VAD interruptions, `onSpeechEnd`, `onUserSpeaking` callbacks are all dead. The referenced hook was **never implemented** as a file |
| **RC-4** | `useVAD` silently fakes `isListening: true` when ONNX fails | `src/hooks/useVAD.ts` | 53-58 | UI shows "Listening..." but zero audio is captured |

### High-Severity Issues (Block mic under specific conditions)

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| **RC-5** | VAD disabled for guest mode and when `difficultyMode` is undefined | `src/hooks/useInterview.ts` | 141 | Guest users get no VAD; any config missing `difficultyMode` breaks VAD |
| **RC-6** | VAD mic capture only starts when `sttProvider === 'whisper'` | `src/hooks/useInterview.ts` | 688-689 | Since Whisper defaults off (RC-1), VAD never activates |
| **RC-7** | 5-second silence timer permanently kills mic | `src/hooks/useInterview.ts` | 136-140 | `onSilenceTimeout` → `setIsMicEnabled(false)` — user pauses to think and mic dies |
| **RC-8** | TTS `onSpeakStart` disables mic; `onSpeakEnd` has race condition | `src/hooks/useInterview.ts` | 108-117 | 400ms `setTimeout` with closure over `hasPendingRef` — if stale, mic never re-enables |

### Medium-Severity Issues

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| **RC-9** | Two conflicting VAD systems (npm dynamic import vs script-tag singleton) | `useVAD.ts` vs `vad-manager.ts` | — | Duplicate init paths; only one is robust, the other is unused |
| **RC-10** | Tab visibility change kills mic with no recovery | `src/hooks/useInterview.ts` | 465-470 | Switching tabs permanently kills mic |
| **RC-11** | `push-to-talk` fallback does nothing | `src/hooks/useVAD.ts` | 38-39 | `startListening` just sets state, no actual audio capture |
| **RC-12** | `rec.onend` fires on benign Chrome re-starts, killing `isListening` | `src/hooks/useSTT.ts` | 90 | Chrome's `SpeechRecognition` auto-ends periodically even with `continuous: true` |
| **RC-13** | `no-speech` error followed by `onend` → dead mic | `src/hooks/useSTT.ts` | 84-90 | Error is ignored but `onend` still fires and sets `isListening(false)` |

---

## Target Architecture

### TTS Cascade (Already working — no changes needed)

```
1. AWS Polly (Kajal, en-IN) — if ENABLE_AWS_POLLY_TTS=true AND AWS keys configured
2. Browser Web Speech API — always available, no config needed
```

### STT Cascade (Broken — Phases 0, 1, 3 fix this)

```
1. Groq Whisper (whisper-large-v3-turbo / whisper-large-v3)
   — if ENABLE_WHISPER_STT=true (server flag)
   — VAD captures audio → Float32Array → WAV → POST /api/voice/transcribe → Groq API

2. Browser SpeechRecognition (Chrome/Edge)
   — Uses Web Speech API with continuous mode + auto-restart loop

3. MediaRecorder + Whisper API (NEW — Firefox/Safari/Brave fallback)
   — getUserMedia → MediaRecorder → WAV blob → POST /api/voice/transcribe
   — Activates when SpeechRecognition unavailable AND Whisper flag is on
```

### VAD Cascade (Broken — Phases 3, 4 fix this)

```
1. ONNX Silero VAD — if device supports WASM + SharedArrayBuffer + AudioWorklet
   — Loaded via /public/vad/ script tags (vad-manager.ts singleton)
   — Detects speech start/end, feeds audio to STT

2. Simple mic toggle (push-to-talk) — universal fallback
   — No VAD processing, user manually controls mic via button
   — isListening accurately reflects actual state (no faking)
```

---

## Phase 0 — Emergency Chrome Fix (Day 1)

> **Goal**: Make the basic Chrome `SpeechRecognition` flow work reliably.
> **Fixes**: RC-7, RC-8, RC-12, RC-13
> **Files**: `src/hooks/useSTT.ts`, `src/hooks/useInterview.ts`

### 0a. Auto-restart SpeechRecognition on `onend`

**File**: `src/hooks/useSTT.ts`
**Problem**: `rec.onend = () => setIsListening(false)` fires even during benign Chrome re-starts (network hiccups, `no-speech` timeout after ~10-20s). With `continuous: true`, Chrome still periodically ends the recognition session.

**Fix**:
- Add a `listeningIntentRef = useRef(false)` — stays `true` until `stopListening()` is explicitly called
- `startListening()` → sets `listeningIntentRef.current = true`
- `stopListening()` → sets `listeningIntentRef.current = false`, then calls `rec.stop()`
- `rec.onend` → check `listeningIntentRef.current`:
  - If `true` → create a new `SpeechRecognition` instance and `.start()` again (with 300ms debounce to avoid tight restart loops)
  - If `false` → `setIsListening(false)` as before

```typescript
// Pseudocode for the new onend handler:
rec.onend = () => {
    if (listeningIntentRef.current) {
        // Chrome ended session but we still want to listen — restart
        setTimeout(() => {
            if (listeningIntentRef.current) {
                startListening(); // Recursive restart
            }
        }, 300);
    } else {
        setIsListening(false);
    }
};
```

### 0b. Handle `no-speech` → `onend` chain

**File**: `src/hooks/useSTT.ts`
**Problem**: `onerror` ignores `no-speech` (correct) but `onend` fires immediately after → `setIsListening(false)` → mic dies.

**Fix**: Already handled by 0a. The `listeningIntentRef` check in `onend` will auto-restart after `no-speech` errors.

### 0c. Increase silence timeout from 5s to 15s

**File**: `src/hooks/useInterview.ts`
**Problem**: `silenceMs: 5000` is too aggressive. Users pause to think.

**Fix**: Change the `useSTT` options:
```typescript
// Before:
const stt = useSTT({ provider: sttProvider, silenceMs: 5000, ... });

// After:
const stt = useSTT({ provider: sttProvider, silenceMs: 15000, ... });
```

### 0d. Stop `onSilenceTimeout` from permanently disabling mic

**File**: `src/hooks/useInterview.ts` (line 136-140)
**Problem**: `onSilenceTimeout` calls `setIsMicEnabled(false)` — this permanently kills mic intent.

**Fix**: Remove `setIsMicEnabled(false)`. Only surface the pending-send prompt:
```typescript
// Before:
onSilenceTimeout: () => {
    stt.stopListening();
    setHasPendingSend(transcriptRef.current.length > 0);
    setIsMicEnabled(false);  // ← REMOVE THIS
},

// After:
onSilenceTimeout: () => {
    // Don't stop listening or disable mic — just prompt user to send
    setHasPendingSend(transcriptRef.current.length > 0);
},
```

### 0e. Fix `onSpeakEnd` race condition

**File**: `src/hooks/useInterview.ts` (line 113-118)
**Problem**: The 400ms `setTimeout` in `onSpeakEnd` depends on `hasPendingRef.current` which may be stale.

**Fix**: Replace the fragile timeout with a reactive effect:
```typescript
// Before (in TTS options):
onSpeakEnd: () => {
    setTimeout(() => {
        if (!tts.isSpeaking && !hasPendingRef.current) {
            setIsMicEnabled(true);
            stt.startListening();
            if (sttProvider === 'whisper') vad.startListening();
        }
    }, 400);
},

// After:
onSpeakEnd: () => {
    // Let the mic sync effect handle mic resumption reactively
    // Just signal that AI is done speaking (isSpeaking will become false)
},
```

Then add/modify the mic sync effect to handle the `isSpeaking: true → false` transition:
```typescript
// In the mic sync useEffect:
// When isSpeaking transitions to false AND micIntent is not 'off',
// automatically resume listening after a short delay.
```

---

## Phase 1 — Cross-Browser STT Rewrite (Day 2-3)

> **Goal**: STT works on every browser and device.
> **Fixes**: RC-2
> **Files**: `src/hooks/useSTT.ts`

### 1a. Add auto-restart loop for browser mode

Already described in Phase 0a — the `listeningIntentRef` + auto-restart in `onend`.

### 1b. Add `MediaRecorder` fallback for non-Chrome browsers

**File**: `src/hooks/useSTT.ts`

When `SpeechRecognition` is unavailable AND Whisper is enabled, use `getUserMedia` + `MediaRecorder` to capture audio chunks and send them to the Whisper API:

```typescript
// New function inside useSTT:
const startRecorderFallback = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
        });
        const recorder = new MediaRecorder(stream, {
            mimeType: getSupportedMimeType()
        });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: recorder.mimeType });
            if (blob.size < 1000) return; // Too small — skip
            const form = new FormData();
            form.append('audio', blob, 'audio.webm');
            try {
                const res = await fetch('/api/voice/transcribe', {
                    method: 'POST',
                    body: form
                });
                if (!res.ok) return;
                const { text } = await res.json();
                if (text?.trim()) {
                    setTranscript(p => p ? `${p} ${text}` : text);
                    optsRef.current.onTranscript(text, true);
                }
            } catch (err) {
                console.error('[STT] Recorder transcription failed:', err);
            }
        };

        recorder.start();
        recorderRef.current = recorder;
        setIsListening(true);
    } catch (err) {
        optsRef.current.onError?.('Microphone access denied or unavailable.');
    }
}, []);
```

### 1c. Three-tier provider cascade

**File**: `src/hooks/useSTT.ts`

Add provider resolution logic at the top of the hook:

```typescript
// Provider resolution (run once on mount):
const resolvedProvider = useMemo(() => {
    if (provider === 'whisper') return 'whisper';

    const w = window as AnyW;
    const hasSR = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    if (hasSR) return 'browser';

    // No SpeechRecognition — fall back to MediaRecorder + Whisper?
    const hasRecorder = !!(
        window.MediaRecorder && navigator.mediaDevices?.getUserMedia
    );
    if (hasRecorder) return 'recorder';

    return 'none';  // No STT possible
}, [provider]);
```

Then in `startListening()`:
```typescript
switch (resolvedProvider) {
    case 'whisper':   /* existing whisper path */       break;
    case 'browser':   /* existing SpeechRecognition */  break;
    case 'recorder':  startRecorderFallback();          break;
    case 'none':
        optsRef.current.onError?.('No speech recognition available.');
        break;
}
```

### 1d. Expose mic permission state

**File**: `src/hooks/useSTT.ts`

```typescript
const [permissionState, setPermissionState] =
    useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then(status => {
            setPermissionState(status.state as any);
            status.onchange = () =>
                setPermissionState(status.state as any);
        })
        .catch(() => setPermissionState('unknown'));
}, []);
```

Return `permissionState` from the hook for UI consumption.

---

## Phase 2 — Mic Lifecycle Rewrite in `useInterview` (Day 3-4)

> **Goal**: Eliminate state management races that kill the mic.
> **Fixes**: RC-7, RC-8, RC-10
> **Files**: `src/hooks/useInterview.ts`

### 2a. Replace `isMicEnabled` with `micIntent` state machine

**Problem**: `isMicEnabled` is a boolean written from 8+ places, creating races.

**Fix**: Replace with an enum:

```typescript
type MicIntent = 'user-on' | 'auto-on' | 'paused-for-ai' | 'off';
const [micIntent, setMicIntent] = useState<MicIntent>('off');
```

| Current call site | New call |
|---|---|
| `setIsMicEnabled(true)` after interview start | `setMicIntent('auto-on')` |
| `voice.startListening()` (user click) | `setMicIntent('user-on')` |
| `onSpeakStart` → `setIsMicEnabled(false)` | `setMicIntent('paused-for-ai')` |
| `onSpeakEnd` | `setMicIntent(prev => prev === 'paused-for-ai' ? 'auto-on' : prev)` |
| `onSilenceTimeout` | **No longer changes intent** |
| `voice.stopListening()` (user click) | `setMicIntent('off')` |
| `endInterview` / `resetInterview` | `setMicIntent('off')` |
| `visibilitychange` hidden | `setMicIntent('paused-for-ai')` |
| `visibilitychange` visible | `setMicIntent(prev => prev === 'paused-for-ai' ? 'auto-on' : prev)` |

### 2b. Remove `optimisticListening` hack

**Problem**: Exists to paper over async gap between click and `SpeechRecognition.onstart`.

**Fix**: With the auto-restart loop (1a) and intent tracking (2a), remove:
- `const [optimisticListening, setOptimisticListening] = useState<boolean | null>(null);`
- The effect that syncs `optimisticListening` with `isListening`
- Replace `voice.isListening: optimisticListening ?? isListening` with just `isListening`

### 2c. Simplify mic sync effect

**Problem**: The ~60-line `useEffect` at line 500-558 with 8 dependencies, refs, and nested timeouts.

**Fix**: Replace with a clean reactive effect:

```typescript
useEffect(() => {
    // Gate on interview being active
    if (state === 'idle' || state === 'completed') {
        if (isListeningRef.current) stopListening();
        return;
    }

    // Derive desired mic state from intent + AI state
    const shouldListen =
        (micIntent === 'user-on' || micIntent === 'auto-on') &&
        !isSpeaking &&
        !isProcessing;

    if (shouldListen && !isListeningRef.current) {
        resetTranscript();
        startListening();
        if (sttProvider === 'whisper') vad.startListening();
    } else if (!shouldListen && isListeningRef.current) {
        stopListening();
        if (sttProvider === 'whisper') vad.stopListening();
    }
}, [micIntent, isSpeaking, isProcessing, state]);
```

### 2d. Fix tab visibility recovery

**File**: `src/hooks/useInterview.ts` (line 465-470)

**Before**:
```typescript
const handleVisibilityChange = () => {
    if (document.hidden) {
        stopSpeaking();
        setIsMicEnabled(false);
        stopListening();
    }
};
```

**After**:
```typescript
const handleVisibilityChange = () => {
    if (document.hidden) {
        stopSpeaking();
        setMicIntent('paused-for-ai');
    } else {
        // Resume mic when tab becomes visible again
        if (state !== 'idle' && state !== 'completed') {
            setMicIntent('auto-on');
        }
    }
};
```

### 2e. Remove auto-submit on silence (or make opt-in)

**Problem**: `AUTO_SUBMIT_DELAY` (2.5s) timer fires `submitUserResponse` while user is still thinking.

**Fix**: Remove the `useEffect` at line 370-385 that auto-submits. Keep the `hasPendingSend` state and the Send button so the user can submit when ready. If auto-submit behavior is desired later, gate it behind a user preference toggle.

---

## Phase 3 — Enable Whisper + VAD as Default (Day 4-5)

> **Goal**: The high-quality Whisper path works by default for all users.
> **Fixes**: RC-1, RC-4, RC-5, RC-6
> **Files**: `src/lib/feature-flags.ts`, `src/hooks/useVAD.ts`, `src/hooks/useInterview.ts`, `src/app/api/voice/transcribe/route.ts`

### 3a. Flip `ENABLE_WHISPER_STT` default to `true`

**File**: `src/lib/feature-flags.ts` (line 58)

```typescript
// Before:
ENABLE_WHISPER_STT: {
    storageKey: 'feature_ENABLE_WHISPER_STT',
    defaultValue: false,  // ← Change this
    ...
},

// After:
ENABLE_WHISPER_STT: {
    storageKey: 'feature_ENABLE_WHISPER_STT',
    defaultValue: true,
    ...
},
```

Also ensure the server-side flag API (`/api/flags`) returns `true` for this flag by default, and verify the Supabase `feature_flags` table has it set to `true`.

### 3b. Stop lying about `isListening` in push-to-talk fallback

**File**: `src/hooks/useVAD.ts` (line 39 and 57)

**Before**:
```typescript
if (mode === 'push-to-talk') { setIsListening(true); return; }
// ...catch block:
setMode('push-to-talk');
setIsListening(true);  // ← LIE
```

**After**:
```typescript
if (mode === 'push-to-talk') {
    // Push-to-talk has no real mic capture — don't claim we're listening
    setIsListening(false);
    return;
}
// ...catch block:
setMode('push-to-talk');
setIsListening(false);  // ← Honest
setIsReady(true);
```

The UI should check `vad.mode` to display the correct state for push-to-talk users.

### 3c. Remove guest mode VAD restriction

**File**: `src/hooks/useInterview.ts` (line 141)

**Before**:
```typescript
const vad = useVAD({
    enabled: options.config.mode !== 'guest' &&
             options.config.difficultyMode !== undefined,
    onSpeechEnd: (audio) => stt.transcribeAudio(audio),
});
```

**After**:
```typescript
const vad = useVAD({
    enabled: sttProvider === 'whisper',
    onSpeechEnd: (audio) => stt.transcribeAudio(audio),
});
```

Guest restrictions stay on turn count and duration (already enforced elsewhere), not on mic capability.

### 3d. Wire VAD onSpeechEnd → STT for all modes

**File**: `src/hooks/useSTT.ts`

```typescript
// Before:
const transcribeAudio = useCallback(async (audio: Float32Array) => {
    if (provider !== 'whisper') return;
    ...
});

// After:
const transcribeAudio = useCallback(async (audio: Float32Array) => {
    if (resolvedProvider !== 'whisper' && resolvedProvider !== 'recorder') return;
    ...
});
```

### 3e. Allow guest users for transcription API

**File**: `src/app/api/voice/transcribe/route.ts` (line 12-15)

**Before**:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**After**:
```typescript
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    // Allow guest usage but enforce rate limiting by IP
    const ip = req.headers.get('x-forwarded-for') ||
               req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `whisper_guest_${ip}`;
    const isRateLimited = await checkGuestRateLimit(rateLimitKey, 20, 60);
    if (isRateLimited) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
}
```

Add a simple in-memory rate limiter or use the existing `rate-limit` utility for guest IP tracking.

---

## Phase 4 — Uncomment and Implement ConversationView VAD (Day 5-6)

> **Goal**: VAD-based interruptions work in the interview UI.
> **Fixes**: RC-3, RC-9
> **Files**: `src/components/interview/ConversationView.tsx`, `src/hooks/useVAD.ts`
> **New files**: `src/hooks/useVoiceActivityDetection.ts`

### 4a. Create the `useVoiceActivityDetection` hook

**New file**: `src/hooks/useVoiceActivityDetection.ts`

This hook wraps the existing `VADManager` singleton from `src/lib/voice/vad-manager.ts`:

```typescript
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getVADManager } from '@/lib/voice/vad-manager';
import { VADState } from '@/lib/voice/types';

interface UseVoiceActivityDetectionOptions {
    enabled: boolean;
    autoStart?: boolean;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onError?: (err: Error) => void;
}

export function useVoiceActivityDetection(opts: UseVoiceActivityDetectionOptions) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    useEffect(() => {
        if (!opts.enabled) return;

        const manager = getVADManager();
        let unsubs: (() => void)[] = [];

        (async () => {
            try {
                if (manager.state === VADState.IDLE) {
                    await manager.init();
                }

                unsubs.push(manager.onSpeechStart(() => {
                    optsRef.current.onSpeechStart?.();
                }));

                unsubs.push(manager.onSpeechEnd((audio) => {
                    optsRef.current.onSpeechEnd?.(audio);
                }));

                if (opts.autoStart && manager.state === VADState.PAUSED) {
                    await manager.start();
                    setIsListening(true);
                }
            } catch (err) {
                const e = err instanceof Error ? err : new Error('VAD init failed');
                setError(e);
                optsRef.current.onError?.(e);
            }
        })();

        return () => {
            unsubs.forEach(fn => fn());
        };
    }, [opts.enabled, opts.autoStart]);

    const start = useCallback(async () => {
        try {
            const manager = getVADManager();
            await manager.start();
            setIsListening(true);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('VAD start failed'));
        }
    }, []);

    const stop = useCallback(async () => {
        try {
            const manager = getVADManager();
            await manager.stop();
            setIsListening(false);
        } catch { /* ignore */ }
    }, []);

    return { isListening, error, start, stop };
}
```

### 4b. Uncomment the VAD integration in ConversationView

**File**: `src/components/interview/ConversationView.tsx` (line 107-145)

Remove the `/* */` comment block and wire to the new hook:

```typescript
import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';

// Inside the component:
const {
    isListening: isVadListening,
    error: vadError,
} = useVoiceActivityDetection({
    enabled: isVadEnabled,
    autoStart: isVadEnabled,
    onSpeechStart: () => {
        if (isVadEnabled && interruptionManagerRef.current) {
            const decision = interruptionManagerRef.current.handleUserSpeechStart();
            if (decision === 'INTERRUPT_IMMEDIATELY') {
                handleInterruption();
            } else if (decision === 'ALLOW_INPUT') {
                if (onUserSpeaking) onUserSpeaking();
            }
        }
    },
    onSpeechEnd: (audio) => {
        if (isVadEnabled && interruptionManagerRef.current) {
            interruptionManagerRef.current.handleUserSpeechEnd();
        }
        if (onSpeechEnd) onSpeechEnd(audio);
    },
    onError: (err) => {
        debugLog('vad_error', { error: err.message });
        if (onVadError) onVadError(err);
    }
});
```

### 4c. Pick one VAD implementation — deprecate `useVAD.ts`

**Decision**: Use `vad-manager.ts` (script-tag singleton) as the canonical VAD.

**Rationale**:
- Avoids Turbopack compilation of `onnxruntime-web` (120+ seconds in dev)
- Singleton pattern — single mic stream shared across components
- Proper state machine (`IDLE → INITIALIZING → PAUSED → LISTENING → DESTROYED`)
- Already has subscriber patterns (`onSpeechStart`, `onSpeechEnd`, `onFrameProcessed`)

**Action**:
1. `useVAD.ts` becomes a thin wrapper around `getVADManager()` for backward compatibility
2. Remove the `await import('@ricky0123/vad-web')` dynamic import from `useVAD.ts`
3. `useVAD.startListening()` → calls `getVADManager().init()` + `.start()`
4. `useVAD.stopListening()` → calls `getVADManager().stop()`
5. `useVAD.onSpeechEnd` callback → registered via `getVADManager().onSpeechEnd()`

---

## Phase 5 — UX Resilience Layer (Day 6-7)

> **Goal**: Users always know what's happening with their mic and always have a working fallback.
> **Files**: `src/components/interview/InterviewSession.tsx`, `src/components/voice/MicrophoneButton.tsx`

### 5a. Pre-interview microphone permission check

**File**: `src/components/interview/InterviewSession.tsx`

Before `handleStart()`:
```typescript
const handleStart = async () => {
    // Check mic permission first
    try {
        const perm = await navigator.permissions.query({
            name: 'microphone' as PermissionName
        });
        if (perm.state === 'denied') {
            setError(
                'Microphone access is blocked. ' +
                'Please enable it in your browser settings.'
            );
            return;
        }
        if (perm.state === 'prompt') {
            // Trigger permission request before starting interview
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop()); // Release immediately
        }
    } catch {
        // permissions API not available — proceed, mic will prompt on use
    }

    // ... existing start logic ...
};
```

### 5b. Auto-detect mic failure → promote text input

**File**: `src/components/interview/InterviewSession.tsx`

```typescript
// Monitor for no transcript within 10s of mic being active
useEffect(() => {
    if (!voice.isListening || voice.transcript || voice.interimTranscript) return;

    const timer = setTimeout(() => {
        if (voice.isListening && !voice.transcript && !voice.interimTranscript) {
            setShowTextInput(true);
            toast('Mic may not be working — you can type your response instead', {
                icon: '⌨️',
                duration: 5000,
            });
        }
    }, 10_000);

    return () => clearTimeout(timer);
}, [voice.isListening, voice.transcript, voice.interimTranscript]);
```

### 5c. Add mic health indicator (audio level visualization)

**File**: `src/components/voice/MicrophoneButton.tsx`

Add an `audioLevel` prop (0-1 float) that displays a real-time volume meter ring:

```tsx
interface MicrophoneButtonProps {
    isListening: boolean;
    audioLevel?: number;  // NEW: 0.0 to 1.0, real-time mic volume
    onClick: () => void;
    disabled?: boolean;
    error?: string | null;
}
```

The level comes from an `AudioContext.createAnalyser()` node reading the mic stream — wired up in `useSTT.ts` or `useVAD.ts`.

Visual behavior:
- `isListening && audioLevel > 0.1` → green ring scaling with volume
- `isListening && audioLevel === 0` for > 3s → amber ring + "No sound detected" tooltip

### 5d. Surface voice errors prominently

**File**: `src/components/interview/InterviewSession.tsx`

```tsx
{/* Above the mic button */}
{voice.error && !voiceErrorDismissed && (
    <ErrorBanner
        message={voice.error.message}
        onDismiss={() => setVoiceErrorDismissed(true)}
    />
)}

{/* Pass error to MicrophoneButton */}
<MicrophoneButton
    isListening={voice.isListening}
    error={voice.error?.message}
    onClick={...}
    disabled={...}
/>
```

### 5e. Add tap-to-retry on mic error

**File**: `src/components/voice/MicrophoneButton.tsx`

```tsx
// When error is set, clicking retries mic access
onClick={error ? onRetry : onClick}

// New prop:
onRetry?: () => void;
```

In `InterviewSession`:
```typescript
onRetry={() => {
    setVoiceError(null);
    setVoiceErrorDismissed(false);
    voice.startListening();
}}
```

---

## Execution Order & Dependencies

```
Phase 0  ──→  Phase 1  ──→  Phase 2  ──→  Phase 3  ──→  Phase 4  ──→  Phase 5
(Chrome     (Cross-       (State        (Enable        (VAD           (UX
 emergency)  browser)      cleanup)      Whisper)       integration)   polish)
```

| Dependency | Reason |
|-----------|--------|
| Phase 0 is standalone | Pure bug fixes, no API changes, no new files |
| Phase 1 depends on Phase 0 | Builds on the fixed `useSTT` auto-restart |
| Phase 2 depends on Phase 0 | Mic lifecycle rewrite references fixed STT behavior |
| Phase 3 depends on Phases 1+2 | Whisper needs the new provider cascade and fixed lifecycle |
| Phase 4 depends on Phase 3 | VAD hook wraps the manager, feeds into Whisper |
| Phase 5 is independent | Can be parallelized with Phases 3-4 |

---

## Files Touched Summary

| Phase | Files Modified | Files Created |
|-------|---------------|---------------|
| 0 | `src/hooks/useSTT.ts`, `src/hooks/useInterview.ts` | — |
| 1 | `src/hooks/useSTT.ts` | — |
| 2 | `src/hooks/useInterview.ts` | — |
| 3 | `src/lib/feature-flags.ts`, `src/hooks/useVAD.ts`, `src/hooks/useInterview.ts`, `src/app/api/voice/transcribe/route.ts` | — |
| 4 | `src/components/interview/ConversationView.tsx`, `src/hooks/useVAD.ts` | `src/hooks/useVoiceActivityDetection.ts` |
| 5 | `src/components/interview/InterviewSession.tsx`, `src/components/voice/MicrophoneButton.tsx` | — |

**Total**: 8 files modified, 1 file created.

---

## Verification Checklist

After all phases are complete, verify each scenario:

- [ ] **Chrome desktop**: Click mic → speaks → transcript appears → auto-restarts after silence → Send works
- [ ] **Chrome mobile (Android)**: Same as above + no permission issues
- [ ] **Firefox desktop**: MediaRecorder fallback activates → Whisper transcribes accurately
- [ ] **Safari desktop**: MediaRecorder fallback activates → Whisper transcribes accurately
- [ ] **Safari iOS**: getUserMedia works → audio captured → transcription works
- [ ] **Brave**: Works despite shields (may need recorder fallback)
- [ ] **Edge**: SpeechRecognition works (same engine as Chrome)
- [ ] **Guest mode**: Mic works, VAD works, rate-limited transcription works
- [ ] **Tab switch**: Mic pauses on hide → resumes on show
- [ ] **AI speaking**: Mic pauses during TTS → resumes when TTS ends
- [ ] **15s+ silence**: Mic stays alive, Send button appears
- [ ] **Permission denied**: Clear error message, text input auto-shown
- [ ] **VAD interruption**: User speaks during AI → AI stops → "Interrupted" badge shows
- [ ] **ONNX unavailable**: Falls back to push-to-talk, UI shows correct state
- [ ] **No errors in console**: No unhandled promise rejections, no silent failures
