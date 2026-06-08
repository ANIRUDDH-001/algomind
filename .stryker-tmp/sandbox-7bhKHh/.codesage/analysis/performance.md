# Performance Audit

## System Performance Overview

### Bottlenecks & Optimization
1. **Voice Pipeline Latency:** The largest performance bottleneck in the system is the combination of LLM Token Generation + TTS processing. 
   - *Current Solution:* The system mitigates this by chunking the LLM stream into sentences via `src/lib/ai/response-chunker.ts` and piping individual sentences to AWS Polly via `src/lib/voice/tts-engine.ts`. This ensures the first audio buffer plays while the rest is still generating.
2. **STT Speed:** Upgraded from standard APIs to Groq Whisper (`src/lib/voice/whisper-stt.ts`), drastically reducing transcription time for candidate audio blobs to under 200ms.
3. **Caching:** `src/lib/ai/response-cache.ts` prevents redundant LLM calls for identical context/queries, saving cost and time.
4. **Rate Limiting:** Managed at the Edge with Upstash Redis (`src/lib/rate-limit/decision-layer.ts`), adding virtually 0 latency to API requests.

### Client Performance
- Heavy reliance on client-side WebAssembly models for VAD (`@ricky0123/vad-web`) and ONNX. The initial load is mitigated by pre-fetching assets in `interview/page.tsx`.
