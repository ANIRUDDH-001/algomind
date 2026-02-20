# Voice Architecture Refactor Design Document

## Problem Statement
Currently, AlgoMind's voice interview feature relies on two separate microphone audio streams:
1. **Web Speech API (`useVoiceInput.ts`)**: Provides continuous Speech-to-Text (STT) for capturing candidate answers, but times out silently after 60 seconds (Issue M5).
2. **Voice Activity Detection (`useVoiceActivityDetection.ts`)**: Uses `@ricky0123/vad-web` to detect user interruptions and intent to speak. It requests a separate `MediaStream` (Issue H5).

In many browsers (especially Windows, Safari, and mobile devices), requesting the microphone multiple times concurrently causes hardware-level conflicts. One stream will be denied or muted, leading to a dead microphone state for either the STT or the VAD.

## Proposed Solution: Single Audio Stream Pipeline

Web Speech API (`SpeechRecognition`) encapsulates its own microphone request and does not expose a way to inject a shared `MediaStream`. Therefore, a "true shared stream" is impossible with the current STT technology. 

### Recommended Architecture: Server-Side STT (Whisper via Groq)
We must transition away from the browser-native Web Speech API and rely entirely on the audio buffer captured by the VAD. 

**Workflow:**
1. Top-level `useInterview` activates VAD. VAD natively requests `getUserMedia` (Single Mic Access).
2. When VAD fires `onSpeechStart`, we display UI "Listening...".
3. When VAD fires `onSpeechEnd`, the plugin emits a `Float32Array` containing the audio.
4. The client encodes this array to WAV and POSTs it to a new backend route: `/api/transcribe`.
5. The backend uses Groq's fast Whisper API to return the exact string, which is then appended to the transcript.

**Benefits:**
- **Solves H5:** Only one mic request is ever made.
- **Solves M5:** Server-side Whisper does not have a hard 60s timeout, and we process chunks logically delimited by the user's natural breathing/stopping (defined by VAD).
- **Quality:** Whisper is vastly superior to the built-in browser grammar parsers.

### Interim M5 Mitigation (If Web Speech API is kept)
If the project mandates keeping Web Speech API for cost reasons:
To fix the 60s timeout, `useVoiceInput` must listen for the `onend` event and check the `shouldListenRef`. Since we also have VAD running, we can tie the restart to the `vad.isSpeaking` state. If the STT stops but VAD says the user is actively speaking, `useVoiceInput` should recursively call `startListening()` until VAD says the user has stopped.

## Next Step Implementation
1. Add encoding utility (e.g., `wav-encoder` or manual DataView construction) to format VAD `Float32Array` into `audio/wav`.
2. Implement backend endpoint `/api/transcribe` pointing to Groq's Whisper API.
3. Replace `useVoiceInput` references in `useInterview` with the new VAD emit handler.
