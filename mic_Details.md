# AlgoMind — End-to-End Microphone & Voice System

> **Last updated:** March 4, 2026  
> Covers the complete voice pipeline: TTS, STT, VAD, AWS Polly, mic state machine, smart pause, auto-submit, timers, race condition fixes, and all known edge cases.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [TTS — Text-to-Speech](#2-tts--text-to-speech)
3. [STT — Speech-to-Text](#3-stt--speech-to-text)
4. [VAD — Voice Activity Detection](#4-vad--voice-activity-detection)
5. [Mic State Machine](#5-mic-state-machine)
6. [Full Interview Turn Flow](#6-full-interview-turn-flow)
7. [Smart Pause (AI Interruption)](#7-smart-pause-ai-interruption)
8. [Auto-Submit & Send Countdown](#8-auto-submit--send-countdown)
9. [Mic Sync Effect](#9-mic-sync-effect)
10. [STT Provider Cascade](#10-stt-provider-cascade)
11. [Feature Flags](#11-feature-flags)
12. [Race Conditions & Fixes](#12-race-conditions--fixes)
13. [Bug History — What Was Fixed](#13-bug-history--what-was-fixed)
14. [File Map](#14-file-map)
15. [Console Log Reference](#15-console-log-reference)

---

## 1. Architecture Overview

```
User speaks
    │
    ▼
[Browser Mic] ──── getUserMedia ────►  [VADManager (Singleton)]
                                              │  Silero ONNX model
                                              │  runs 16kHz audio
                                  ┌───────────┴────────────┐
                              onSpeechStart            onSpeechEnd(Float32Array)
                                  │                         │
                            [Smart Pause]            [useSTT.transcribeAudio()]
                            logic in                       │
                            useInterview                   ▼
                                              [/api/voice/transcribe]
                                              Groq Whisper API
                                              whisper-large-v3-turbo
                                                   │ fallback
                                              whisper-large-v3
                                                   │
                                              transcript text
                                                   │
                                         [useInterview state]
                                         transcript, interimTranscript
                                                   │
                                           5s silence → auto-submit
                                           or manual Send button
                                                   │
                                        [/api/chat] → Groq LLM
                                                   │
                                              AI response text
                                                   │
                                        [useTTS.speakAndWait()]
                                               ┌───┴───┐
                                          Polly?    Browser
                                       /api/voice/  WebSpeech
                                       synthesize-  API
                                       polly        │
                                           │        │
                                         .mp3     SpeechSynthesis
                                           └───┬───┘
                                         await completion
                                               │
                                       setMicIntent('auto-on')
                                       [Mic restarts automatically]
```

---

## 2. TTS — Text-to-Speech

### Files
- `src/lib/voice/tts-engine.ts` — Core engine class
- `src/hooks/useTTS.ts` — React wrapper

### TTSEngine Class

**Cascade:** AWS Polly → Browser WebSpeech API

#### Key design decisions

| Decision | Reason |
|---|---|
| Single `<Audio>` element (not AudioContext) | iOS uses media volume correctly with `<Audio>`, not AudioContext |
| Invocation ID (`invId`) | Prevents race: new `speak()` auto-cancels any in-flight call |
| Engine created ONCE on mount, never destroyed | Destroying+recreating incremented `invId`, cancelling in-flight speech and firing spurious `onSpeakEnd` |
| 100ms delay after cancel (only when `wasSpeaking`) | Chrome bug: `cancel()` + immediate `speak()` = new utterance silently dropped |
| `stop()` only fires `onSpeakingChange(false)` if `wasSpeaking` | Prevents spurious `onSpeakEnd` callbacks when idle |
| 30s safety timeout on browser TTS | Prevents stuck Promise if `onend`/`onerror` never fires |
| `tryBrowser()` resolves `true` if utterance `started` even on `interrupted` error | Partial speech is still valid — don't retry if it played |

#### `speak(text, pollyEnabled)` return type

```typescript
Promise<{ provider: 'polly' | 'browser'; success: boolean }>
```

- `success: true` — speech was audibly played (full or partial)
- `success: false` — cancelled, never started, or fatal error

#### `speakAndWait(text, retries = 3)`

```typescript
async speakAndWait(text: string, retries = 3): Promise<boolean>
```

- Calls `engine.speak()` up to `retries` times
- 300ms delay between retries
- Returns `true` on first `success: true`
- Returns `false` after all retries fail
- Used exclusively in `startInterview` and `submitUserResponse` for serial flow

#### Text cleaning

Before any speak call, markdown is stripped:
```
text.replace(/[*_#`~]/g, '').trim()
```

### useTTS Hook

```typescript
const tts = useTTS({
    onSpeakStart: () => void,  // logging only — NOT used for mic gating
    onSpeakEnd: () => void,    // logging only — NOT used for mic gating
    voiceName: string | null,  // from user_preferences table
    voiceRate: number,         // 0.5–2.0
    voicePitch: number,        // 0.5–2.0
});
```

Returns: `{ speak, speakAndWait, stop, isSpeaking, provider, prefVoice, setPrefVoice }`

**Voice selection priority:**
1. User's saved `preferred_voice_name` from `user_preferences`
2. Any `en-IN` voice (Indian English — sounds natural for DSA interviews)
3. Any `en-*` voice
4. Default browser voice

**Polly flag:** Read from `/api/flags` exactly once on mount. If Polly is enabled (`ENABLE_AWS_POLLY_TTS = true`), it's tried first. On failure, falls back to browser.

### AWS Polly

- Endpoint: `POST /api/voice/synthesize-polly`
- Returns MP3 audio buffer
- 8 second timeout via `AbortSignal.timeout(8000)`
- Falls through to browser TTS on any failure (network, auth, timeout)
- Controlled by feature flag `ENABLE_AWS_POLLY_TTS`

---

## 3. STT — Speech-to-Text

### Files
- `src/hooks/useSTT.ts` — Three-tier STT hook
- `src/lib/voice/whisper-stt.ts` — Whisper client (low-level, used by transcribeAudio)
- `src/app/api/voice/transcribe/route.ts` — API route (Groq Whisper)

### Provider Cascade

```
provider prop = 'whisper'
    │
    ├── ENABLE_WHISPER_STT = true AND MediaRecorder available
    │        ▼
    │    resolvedProvider = 'whisper'
    │    (VAD owns microphone, sends Float32Array chunks)
    │
    └── ENABLE_WHISPER_STT = false OR MediaRecorder unavailable
             ▼
         provider prop = 'browser'
             │
             ├── SpeechRecognition API available (Chrome, Edge)
             │        ▼
             │    resolvedProvider = 'browser'
             │    (continuous recognition with auto-restart)
             │
             ├── No SpeechRecognition but MediaRecorder available (Firefox, Safari)
             │        ▼
             │    resolvedProvider = 'recorder'
             │    (records blob, POSTs to /api/voice/transcribe)
             │
             └── Nothing available
                      ▼
                  resolvedProvider = 'none'
```

### Whisper Mode (`resolvedProvider = 'whisper'`)

In whisper mode, `useSTT` does NOT own the microphone. VAD owns it. The flow is:

1. VAD captures audio → `onSpeechEnd(Float32Array)` fires
2. `useInterview` calls `stt.transcribeAudio(audio)`
3. `transcribeAudio` encodes Float32Array → WAV using built-in `float32ToWav()`
4. POSTs WAV to `/api/voice/transcribe`
5. Result appended to `transcript` state

**Minimum audio length check:** `< 4000 samples (~0.25s at 16kHz)` → skipped silently

### WAV Encoding (`float32ToWav`)

Hand-written PCM → WAV encoder in `useSTT.ts`. Critical offsets:
```
RIFF header:   offset 0–11
fmt chunk:     offset 12–35  (16 bytes, PCM format)
data sub-chunk: offset 36–43  ← "data" tag at 36, size at 40
PCM samples:   offset 44+
```
**Previously broken:** data tag was at offset 38 (wrong). Fixed to 36.

### Transcribe API (`/api/voice/transcribe`)

- **Model waterfall:** `whisper-large-v3-turbo` first, `whisper-large-v3` on 429
- **Prompt:** DSA vocabulary hint passed to every request:
  ```
  "Technical interview about data structures and algorithms. DSA vocabulary: 
   Big O notation, O(n log n), binary search, Dijkstra, BFS, DFS, dynamic 
   programming, memoization, recursion, hash map, linked list, binary tree, 
   heap, graph, two pointers."
  ```
- **Audio size limits:** min 1KB (noise filter), max 10MB
- **Language:** `en` forced
- **Response format:** `verbose_json` (includes `segments[].avg_logprob` for confidence)
- **Auth:** Authenticated users pass through. Guests get 20 requests/minute by IP.
- **Returns:**
  ```json
  { "text": "...", "model": "whisper-large-v3-turbo", "confidence": 0.85, "duration": 2.3 }
  ```

### Silence Timer

`useSTT` arms a silence timer after each `onTranscript` call:
- Duration: **15 seconds** (`silenceMs: 15000` in useInterview)
- On expiry: fires `onSilenceTimeout` → sets `hasPendingSend = true` (does NOT stop the mic)
- Timer is reset on every new transcript chunk

### Browser Mode (`resolvedProvider = 'browser'`)

- Language: `en-IN` (Indian English — better recognition for Indian accents)
- `continuous: true`, `interimResults: true`  
- Auto-restart: `onend` handler checks `listeningIntentRef.current` — if still true, restarts with 300ms debounce
- `no-speech` and `aborted` errors are ignored (benign Chrome behavior)
- `not-allowed` error sets `listeningIntentRef = false` (fatal, don't retry)

### Recorder Mode (`resolvedProvider = 'recorder'`)

- Used on Firefox, Safari, Brave
- Records `audio/webm;codecs=opus` (or best supported type)
- Full blob sent to `/api/voice/transcribe` on stop
- Silence timer triggers stopListening → sends blob

---

## 4. VAD — Voice Activity Detection

### Files
- `src/lib/voice/vad-manager.ts` — Singleton VADManager
- `src/hooks/useVAD.ts` — React hook wrapper
- `public/vad/ort.min.js` — ONNX Runtime (358KB)
- `public/vad/vad-bundle.min.js` — Silero VAD UMD bundle (69KB)
- `public/vad/silero_vad_v5.onnx` — VAD neural net weights
- `public/vad/silero_vad_legacy.onnx` — Legacy model weights

### Architecture

```
VADManager (window.__VAD_MGR__) ← Singleton, persists across React renders
    │
    ├── loadScript('/vad/ort.min.js')      ← ONNX Runtime
    ├── loadScript('/vad/vad-bundle.min.js') ← MicVAD UMD
    │
    └── MicVAD instance
            │
            ├── getUserMedia (16kHz, mono, echoCancellation, noiseSuppression)
            ├── AudioWorklet processes 512-sample frames at 16kHz
            ├── Silero ONNX model scores each frame: P(speech) ∈ [0,1]
            │
            ├── onSpeechStart — frame probability exceeds positiveSpeechThreshold
            ├── onSpeechEnd(Float32Array) — probability drops below negativeSpeechThreshold
            │                              for redemptionMs, segment returned
            └── onVADMisfire — segment shorter than minSpeechMs, discarded
```

### VAD Configuration (current values)

| Parameter | Value | Meaning |
|---|---|---|
| `positiveSpeechThreshold` | **0.7** | Frame must score ≥ 0.7 to be classified as speech. Filters most background noise. |
| `negativeSpeechThreshold` | **0.25** | Once in speech mode, stays in speech until score drops below 0.25. Tolerant of mid-sentence pauses. |
| `redemptionMs` | **1500ms** | Time to wait after speech dips before closing the segment. Allows pauses between sentences. |
| `preSpeechPadMs` | **300ms** | Audio captured 300ms before speech start — gives Whisper cleaner context. |
| `minSpeechMs` | **800ms** | Segments shorter than 800ms are discarded as noise/coughs. |
| `model` | `'legacy'` | Uses `silero_vad_legacy.onnx` (more compatible). |

**Effect of these settings:** A typical speech utterance returns 3–6 seconds of audio instead of 1–2 seconds. This dramatically improves Whisper accuracy since the model works better with longer context.

### State Machine

```
IDLE → INITIALIZING → PAUSED ↔ LISTENING
                          ↓
                        ERROR
                          ↓
                      DESTROYED
```

- `init()` only callable from `IDLE`
- `start()` transitions `PAUSED → LISTENING`
- `stop()` transitions `LISTENING → PAUSED` (calls `micVAD.pause()`, keeps mic stream alive)
- `destroy()` tears down the `MicVAD` instance and clears all callbacks

### Script Loading

Scripts are loaded via `<script>` tags (not Webpack imports) to bypass Turbopack compilation. Turbopack takes 120+ seconds to compile `onnxruntime-web`. The script tag approach is instant.

- Sequential: `ort.min.js` must load before `vad-bundle.min.js` (ONNX Runtime must be in `globalThis.ort`)
- Deduplication: checks `document.querySelector('script[src="..."]')` before injecting
- The `MicVAD` constructor is found by scanning `window.vad.MicVAD`, `window.MicVAD`, then any object on `window` with a `.MicVAD` property

### Singleton Pattern

```typescript
// Stored on window so it survives React hot-reloads
window.__VAD_MGR__ = new VADManager();
```

Only creates a new instance if `__VAD_MGR__` is missing or `DESTROYED`.

### Callback System

All callbacks are stored in `Set<Callback>` — multiple subscribers, each gets a cleanup function:

```typescript
const unsub = manager.onSpeechEnd((audio) => { ... });
// later:
unsub();
```

`useVAD` calls `registerCallback(manager)` which:
1. Unsubscribes any previous subscriptions
2. Subscribes both `onSpeechStart` and `onSpeechEnd`
3. Uses `optsRef.current` (synchronously updated) to always call the latest callbacks

### Browser Support Check

VAD requires:
- `AudioContext` (or `webkitAudioContext`)
- `navigator.mediaDevices.getUserMedia`
- `WebAssembly`

**SharedArrayBuffer is NOT required.** The UMD bundle handles its own polyfills.

If any of the above are missing, `useVAD` sets `mode = 'push-to-talk'`, calls `onFallback()`, and `useInterview` sets `vadFailed = true` → `sttProvider` changes to `'browser'`.

---

## 5. Mic State Machine

### `MicIntent` Type

```typescript
type MicIntent = 'user-on' | 'auto-on' | 'paused-for-ai' | 'off'
```

| State | Meaning |
|---|---|
| `'user-on'` | User explicitly pressed mic button to start listening |
| `'auto-on'` | System automatically activated mic (after TTS finished) |
| `'paused-for-ai'` | Mic muted because AI is speaking |
| `'off'` | Mic is off (initialstate, user manually stopped, or interview ended) |

### Additional State Variables

```typescript
const [micStoppedManually, setMicStoppedManually] = useState(false);
const [sendCountdown, setSendCountdown] = useState<number | null>(null);
const [ttsError, setTtsError] = useState(false);
```

- `micStoppedManually`: `true` when user explicitly stopped the mic. Triggers send countdown instead of 5s auto-submit.
- `sendCountdown`: 5 → 4 → 3 → 2 → 1 → 0 then auto-sends. `null` when inactive.
- `ttsError`: shows error banner when TTS failed after 3 retries

### Derived Value

```typescript
const isMicEnabled = micIntent === 'user-on' || micIntent === 'auto-on';
```

### State Transitions

```
Interview starts
    → setMicIntent('paused-for-ai')

TTS completes (speakAndWait resolves)
    → setMicStoppedManually(false)
    → setMicIntent('auto-on')

User presses mic button (currently listening)
    → setMicStoppedManually(true)
    → setMicIntent('off')

User presses mic button (currently off)
    → setMicStoppedManually(false)
    → setSendCountdown(null)
    → setMicIntent('user-on')

VAD detects speech DURING AI talking (smart pause)
    → tts.stop()
    → smartPauseActiveRef = true
    → start 1500ms grace timer

Grace timer expires (user went silent)
    → setMicStoppedManually(false)
    → setMicIntent('auto-on')

Grace timer + VAD onSpeechEnd fires (user kept talking)
    → smartPauseActiveRef = false
    → cancel grace timer
    → setMicStoppedManually(false)
    → setMicIntent('auto-on')

Tab hidden
    → stopSpeaking()
    → setMicIntent('paused-for-ai')

Tab becomes visible
    → if interview active: setMicIntent('auto-on')

Interview ends/resets
    → setMicIntent('off')
    → setMicStoppedManually(false)
    → setSendCountdown(null)
```

---

## 6. Full Interview Turn Flow

### Interview Start

```
handleStart() in InterviewSession.tsx
    │
    ├── Check mic permission (navigator.permissions.query)
    ├── Request mic permission if 'prompt'
    │
    └── startInterview({ problemTitle, ..., difficulty })
            │
            ├── Reset state — messages [], transcript '', stateMachine.reset()
            ├── setMicIntent('paused-for-ai')   ← mic stays OFF
            ├── setIsProcessing(true)
            │
            ├── callChatApi(introPrompt, sysPrompt)   ← Groq LLM API
            │       ├── POST /api/chat
            │       └── 3 retries with exponential backoff (1s, 2s, 4s)
            │
            ├── setIsProcessing(false)
            │
            ├── speakAndWait(aiResponse, retries=3)
            │       ├── TTSEngine.speak() × up to 3
            │       ├── Polly first (if enabled), browser fallback
            │       └── Awaits full audio playback completion
            │
            ├── [AUDIO PLAYING — mic is OFF]
            │
            └── TTS resolves
                    ├── setMicStoppedManually(false)
                    ├── setMicIntent('auto-on')
                    └── Mic sync effect sees 'auto-on' → starts STT + VAD after 350ms delay
```

### User Turn (speaking)

```
[Mic is ON — VAD listening]
    │
    ├── User speaks
    ├── VAD onSpeechStart → no action (AI not speaking)
    └── VAD onSpeechEnd(Float32Array)
            │
            ├── stt.transcribeAudio(audio)
            │       ├── float32ToWav(audio, 16000)
            │       ├── POST /api/voice/transcribe
            │       └── onTranscript(text, isFinal=true)
            │               └── setTranscript(prev => prev + ' ' + text)
            │
            └── 5s silence timer armed (resets on each new chunk)

[5 seconds of silence after last transcript chunk]
    └── Auto-submit: submitUserResponse(transcript, problemContext)
```

### AI Turn (response + speak)

```
submitUserResponse(userText, problemContext)
    │
    ├── stopListening()
    ├── setMicIntent('paused-for-ai')
    ├── setMicStoppedManually(false)
    ├── setSendCountdown(null)
    │
    ├── addMessage(userMsg)
    ├── resetTranscript()
    ├── setIsProcessing(true)
    ├── stateMachine.transition('USER_FINISHED_SPEAKING')
    │
    ├── callChatApi(prompt, sysPrompt)
    │
    ├── addMessage(aiMsg)
    ├── setIsProcessing(false)
    │
    ├── speakAndWait(aiResponse, retries=3)
    │       └── [AUDIO PLAYING — mic is OFF]
    │
    └── TTS resolves
            ├── if !ttsOk → setTtsError(true)
            ├── setMicStoppedManually(false)
            ├── setMicIntent('auto-on')
            ├── stateMachine.transition('AI_FINISHED_SPEAKING')
            └── Mic auto-activates after 350ms delay
```

---

## 7. Smart Pause (AI Interruption)

When the user speaks while the AI is speaking, the system pauses the AI and listens.

### Flow

```
[AI is speaking — tts.isSpeaking = true — mic is OFF]
    │
    └── User speaks (VAD onSpeechStart fires regardless of mic state)
            │
            ├── isSpeakingRef.current === true
            ├── tts.stop()                    ← AI stops immediately
            ├── smartPauseActiveRef = true
            └── setTimeout(1500ms) grace timer starts
                    │
            ┌───────┴────────────────────────┐
        Timer expires                  VAD onSpeechEnd fires
        (user went silent              (user kept talking)
        within 1.5s)                        │
            │                               ├── smartPauseActiveRef = false
            ├── smartPauseActiveRef = false  ├── cancel grace timer
            ├── setMicStoppedManually(false) ├── setMicStoppedManually(false)
            │── setMicIntent('auto-on')      ├── setMicIntent('auto-on')
                                            └── stt.transcribeAudio(audio)
                                                    └── whisper transcribes what user said
```

### What does NOT happen during smart pause

- Mic does NOT turn on during AI speech (no echo/feedback into VAD)
- VAD is always monitoring even when mic intent = 'paused-for-ai'
- The grace timer only activates mic when the user is finished speaking (or went silent)

---

## 8. Auto-Submit & Send Countdown

### Case 1: Mic is active (normal listening)

**5-second silence → auto-submit**

```typescript
// Fires when transcript changes
useEffect(() => {
    if (!autoSubmitEnabled || !transcript.trim()) return;
    if (state === 'idle' || state === 'completed') return;
    if (isProcessing || isSpeaking) return;
    if (micStoppedManually) return;  // ← NOT in countdown mode

    const timer = setTimeout(() => {
        submitUserResponse(transcript, currentProblemRef.current);
    }, 5000);

    return () => clearTimeout(timer);  // Reset on each new transcript chunk
}, [transcript, ...]);
```

The timer **restarts on every new transcript chunk**. If the user keeps talking (VAD keeps firing onSpeechEnd), the 5s counter resets each time. Auto-submit only fires after 5s with no new speech.

### Case 2: Mic stopped manually

**5-second countdown → auto-submit with visual countdown**

```typescript
useEffect(() => {
    if (!micStoppedManually || !transcript.trim()) return;

    setSendCountdown(5);
    const interval = setInterval(() => {
        setSendCountdown(prev => {
            if (prev <= 1) {
                submitUserResponse(transcript, currentProblemRef.current);
                return null;
            }
            return prev - 1;
        });
    }, 1000);
}, [micStoppedManually, transcript, ...]);
```

The Send button shows "Sending in 5s…" → "Sending in 4s…" etc. User can:
- Press the Send button immediately
- Press the mic button (cancels countdown, resumes listening)
- Wait for countdown to reach 0

Countdown is cancelled when:
- `micStoppedManually` becomes `false` (user pressed mic again)
- `transcript` becomes empty (after submit clears it)
- `isProcessing` becomes `true`

---

## 9. Mic Sync Effect

The mic sync effect in `useInterview.ts` is the **reactive bridge** between `micIntent` state and the actual `startListening()`/`stopListening()` calls.

```typescript
useEffect(() => {
    // Stop everything when interview is inactive
    if (state === 'idle' || state === 'completed') {
        if (isListeningRef.current) stopListening();
        if (sttProvider === 'whisper') vad.stopListening();
        return;
    }

    const shouldListen =
        (micIntent === 'user-on' || micIntent === 'auto-on') &&
        !isSpeaking &&
        !isProcessing;

    if (shouldListen && !isListeningRef.current) {
        // 350ms delay — prevents tight loops during rapid state transitions
        const timer = setTimeout(() => {
            if (!isSpeakingRef.current && !isProcessingRef.current && !isListeningRef.current) {
                startListening();
                if (sttProvider === 'whisper') vad.startListening();
            }
        }, 350);
        return () => clearTimeout(timer);
    } else if (!shouldListen) {
        if (isListeningRef.current) stopListening();
        if (sttProvider === 'whisper') vad.stopListening();
    }
}, [micIntent, isSpeaking, isProcessing, state, ...]);
```

### Why 350ms delay?

React state updates are batched. When `speakAndWait` resolves and sets multiple state values, there's a brief window where `isSpeaking` is still `true` from the previous render. The 350ms delay waits for all state to settle before starting the mic.

### Why `isListeningRef` instead of `isListening`?

`isListening` lags by one render cycle. `isListeningRef.current` is updated synchronously — so the guard `!isListeningRef.current` never causes a double-start.

---

## 10. STT Provider Cascade

### Determination (computed at render time)

```typescript
const sttProvider = (
    whisperEnabled &&       // ENABLE_WHISPER_STT feature flag
    !vadFailed &&           // VAD hasn't crashed/degraded
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
) ? 'whisper' : 'browser';
```

### STT Provider inside useSTT

```typescript
const resolvedProvider: ResolvedSTTProvider = useMemo(() => {
    if (provider === 'whisper') return 'whisper';
    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (hasSR) return 'browser';
    const hasRecorder = !!(MediaRecorder && navigator.mediaDevices?.getUserMedia);
    if (hasRecorder) return 'recorder';
    return 'none';
}, [provider]);
```

**VAD is only enabled when `sttProvider === 'whisper'`**:
```typescript
const vad = useVAD({ enabled: sttProvider === 'whisper', ... });
```

### Fallback Chain

```
Whisper+VAD → (VAD crash) → Browser SpeechRecognition
                         → (no SpeechRecognition) → MediaRecorder+Whisper
                                                  → (no MediaRecorder) → 'none' (error state)
```

---

## 11. Feature Flags

Fetched from `/api/flags` (backed by Upstash Redis).

| Flag | Default | Effect |
|---|---|---|
| `ENABLE_WHISPER_STT` | `true` | Uses Groq Whisper + VAD pipeline. If false, falls to browser STT |
| `ENABLE_AWS_POLLY_TTS` | `false` | Uses AWS Polly for TTS. If false, uses browser WebSpeech |
| `ENABLE_VAD_INTERRUPTIONS` | `true` | Enables smart pause interruption in ConversationView |
| `ENABLE_SILENT_OBSERVER` | `true` | Enables the silent observer (badge signals, nudges) |

**Important:** `useGlobalFeatureFlag('ENABLE_WHISPER_STT', true)` — the `true` default means the hook returns `true` on first render (before `/api/flags` responds). This ensures `sttProvider = 'whisper'` from the very first render — avoiding a flash of `'browser'` mode.

---

## 12. Race Conditions & Fixes

### Race 1: `speak()` → `stop()` → `speak()` double-cancel

**Problem:** Chrome's `speechSynthesis.cancel()` followed immediately by `speak()` silently discards the new utterance.

**Fix:** `invId` increments on every `speak()` call. After `cancel()`, if `wasSpeaking`, wait 100ms before starting new utterance, and check `id === this.invId` to bail if a newer call came in.

### Race 2: TTS engine destroy on voice config change

**Problem:** `useTTS` used to re-create `TTSEngine` whenever `prefVoice`, `voiceRate`, or `voicePitch` changed. Each recreation called `destroy()` which incremented `invId` and fired `onSpeakingChange(false)` → `onSpeakEnd` → mic-sync reset → transcript cleared.

**Fix:** Engine created ONCE in a mount-only `useEffect(fn, [])`. Voice config changes call `engine.setVoiceConfig()` on the existing engine — no destroy/recreate.

### Race 3: `onSpeakEnd` fires before TTS even started

**Problem:** `stop()` when idle fired `onSpeakingChange(false)` → `onSpeakEnd` → mic turned on during AI speech.

**Fix:** `stop()` only fires `onSpeakingChange(false)` if `wasSpeaking` was `true`.

### Race 4: Duplicate VAD subscriptions

**Problem:** Every call to `vad.startListening()` called `registerCallback()`, adding a second `onSpeechEnd` subscriber. Every speech segment was transcribed twice.

**Fix:** `registerCallback()` unsubscribes all previous callbacks before subscribing new ones. `unsubRef.current` holds the cleanup.

### Race 5: `resetTranscript()` clearing valid accumulated transcript

**Problem:** Mic sync effect called `resetTranscript()` on every mic restart. If VAD fired `onSpeechEnd` then the mic restarted (normal VAD cycle), the transcript was cleared before auto-submit could read it.

**Fix:** `resetTranscript()` is ONLY called in `submitUserResponse()` and `startInterview()` — never in mic sync effect.

### Race 6: `setIsProcessing(false)` in `finally` during TTS

**Problem:** `startInterview` and `submitUserResponse` had `setIsProcessing(false)` in a `finally` block. This ran while the `await speakAndWait()` was still in progress, creating a window where `isProcessing = false` + `isSpeaking = true` triggered the mic sync effect to start the mic during AI speech.

**Fix:** `setIsProcessing(false)` moved to run immediately after `callChatApi` returns, before `speakAndWait`. The sequence is now: fetch → `setIsProcessing(false)` → `speakAndWait` → `setMicIntent('auto-on')`.

### Race 7: stale `onTranscript` callback

**Problem:** `stt.onTranscript` captured a stale closure from the render when STT was initialized.

**Fix:** `optsRef.current = opts` is a **synchronous update during render** (not inside a `useEffect`). This ensures the ref is always current before any effect runs.

### Race 8: `micSyncEffect` double-start from stale `isListening` ref

**Problem:** `isListening` state lags one render cycle. Two renders in quick succession both saw `isListening = false` and both called `startListening()`.

**Fix:** `isListeningRef.current = isListening` synchronous assignment during render. `shouldListen && !isListeningRef.current` guard prevents double-start even within the same render batch.

---

## 13. Bug History — What Was Fixed

### Session 1–4 (Early debugging)

| Bug | Root cause | Fix |
|---|---|---|
| `500 Internal Server Error` on `/api/voice/transcribe` | WAV header corruption: `data` tag at offset 38 instead of 36 | Fixed `float32ToWav`: data tag at 36, size at 40 |
| Transcription returning random text / noise | Audio too short (~200ms), noise-only segments | Added `minSpeechMs: 500ms` guard |
| Mic race: speaking prompt activates mic | `onSpeakEnd` fired from idle `stop()` call | `stop()` only fires if `wasSpeaking` |
| Dual VAD conflict | `ConversationView` had its own VAD instance | Removed ConversationView's VAD; all VAD in `useInterview` |
| SharedArrayBuffer check blocking VAD | COEP/COOP headers not set | Removed SharedArrayBuffer check from support detection |
| `whisperEnabled` defaulting to `false` | `useGlobalFeatureFlag` default was `false` | Changed default to `true` |
| TTS engine recreation killing in-flight speak | `useEffect` deps included `prefVoice` | Mount-only engine creation |
| Spurious `onSpeakEnd` from `stop()` when idle | Always fired `onSpeakingChange(false)` | Guard with `wasSpeaking` |
| `resetTranscript` clearing valid transcript | Called in mic sync effect | Moved to submit/start only |
| Stale callback refs | `useEffect` lag | Synchronous `optsRef.current = opts` during render |

### Session 5 (Current architecture)

| Bug | Root cause | Fix |
|---|---|---|
| Mic activating during AI speech | `onSpeakEnd` → mic-on callback race | Replaced with serial `await speakAndWait()` — mic only activates after `await` resolves |
| Transcript not visible | TranscriptViewer box was `h-32` (128px) | Changed to `h-[35vh]` min 180px max 280px |
| Text input auto-showing after 10s | Aggressive auto-detect timer | Timer increased to 45s, no longer auto-opens textarea |
| Short VAD audio → poor STT quality | `redemptionMs: 900`, `minSpeechMs: 500` too short | `redemptionMs: 1500`, `minSpeechMs: 800`, `negativeSpeechThreshold: 0.25` |
| AI message not visible during interview | ConversationView only in History panel | Added last-AI-message preview card above mic button |

---

## 14. File Map

```
src/
├── lib/voice/
│   ├── tts-engine.ts          ← TTSEngine class (Polly + Browser cascade)
│   ├── whisper-stt.ts         ← WhisperSTT client (low-level, used by transcribeAudio)
│   ├── vad-manager.ts         ← VADManager singleton (MicVAD wrapper)
│   ├── types.ts               ← VADState enum, VADConfig interface, callbacks
│   └── browser-stt.ts         ← (legacy) BrowserSTT wrapper (now inside useSTT)
├── hooks/
│   ├── useTTS.ts              ← React wrapper: speak(), speakAndWait(), stop()
│   ├── useSTT.ts              ← React wrapper: startListening(), transcribeAudio()
│   ├── useVAD.ts              ← React wrapper: startListening(), stopListening()
│   └── useInterview.ts        ← Main orchestrator: state machine, TTS/STT/VAD wiring
├── app/api/voice/
│   ├── transcribe/route.ts    ← POST /api/voice/transcribe → Groq Whisper
│   └── synthesize-polly/route.ts ← POST /api/voice/synthesize-polly → AWS Polly
├── components/
│   ├── interview/
│   │   ├── InterviewSession.tsx  ← Main UI, uses useInterview hook
│   │   └── ConversationView.tsx  ← Chat history display (no VAD here)
│   └── voice/
│       ├── TranscriptViewer.tsx  ← Read-only live transcript display
│       ├── MicrophoneButton.tsx  ← Mic toggle button with visual states
│       └── MicPulse.tsx          ← Pulsing animation (listening/speaking/processing)
└── config/
    └── voice-config.ts        ← getVoiceConfig() — reads feature flags for VAD params
```

---

## 15. Console Log Reference

When debugging in browser devtools, these prefixes identify which layer is logging:

| Prefix | File | What it means |
|---|---|---|
| `[TTS]` | `tts-engine.ts` | Engine-level TTS events |
| `[useTTS]` | `useTTS.ts` | Hook-level TTS events, retries |
| `[STT]` | `useSTT.ts` | Transcription calls, results, errors |
| `[VADManager]` | `vad-manager.ts` | Script loading, MicVAD init, state transitions |
| `[useVAD]` | `useVAD.ts` | VAD start/stop, onSpeechStart/End forwarding |
| `[useInterview]` | `useInterview.ts` | Smart pause logic, auto-submit, provider decisions |
| `[Mic Sync]` | `useInterview.ts` | Mic sync effect: when mic actually starts/stops |
| `[Mic Diagnostics]` | `useInterview.ts` | One-time mount log of capabilities and provider |
| `[startInterview]` | `useInterview.ts` | Interview init and intro TTS flow |
| `[submitUserResponse]` | `useInterview.ts` | User turn processing and AI reply TTS |
| `VAD \| debug >` | `vad-bundle.min.js` | Silero VAD internal: speech start/end detection |

### Healthy startup sequence (from your logs)

```
[useVAD] Browser supports ONNX VAD                    ← Support check passed
[Mic Diagnostics] ...                                 ← Capabilities logged
[Mic Permission] current state: granted               ← Mic permission OK
[startInterview] Speaking intro (serial), textLen=640 ← Intro TTS starting
[useTTS] speakAndWait attempt 1/3, textLen=626        ← TTS attempt 1
[TTS] Starting browser TTS...                         ← Browser TTS (Polly not enabled)
[TTS] Browser utterance started playing               ← Audio playing
[TTS] Browser utterance error: interrupted            ← Chrome: normal on some versions
[TTS] Browser TTS completed, success=true             ← Resolved with started=true (OK)
[useTTS] speakAndWait succeeded on attempt 1          ← Success
[Mic Sync] Starting mic. sttProvider=whisper          ← Mic activating
[useVAD] Starting ONNX VAD...                         ← VAD init
[VADManager] Loading ONNX Runtime...                  ← Script loading
[VADManager] MicVAD ready ✓                           ← VAD ready
[useVAD] ONNX VAD listening ✓                         ← Listening
VAD | debug > Detected real speech start              ← User spoke
[useVAD] onSpeechEnd fired, audio length: XXXXX       ← Audio captured
[STT] Transcription result: "..."                     ← Whisper result
[useInterview] Auto-submit after 5s silence: "..."    ← Auto-submit triggered
[submitUserResponse] Speaking AI reply (serial)       ← Cycle repeats
```
