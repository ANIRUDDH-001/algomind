# AI & API Audit

## AI Models In Use

### Gemini (1.5 Flash / Pro)
- **Provider:** Google AI Studio
- **Usage:** Core conversational agent (`src/lib/ai/client.ts`), Narrative Generation (`src/lib/assessment/narrative-generator.ts`), Concept extraction.
- **Integration:** API calls route through `@/lib/ai/providers.ts`. Uses system prompts with strict JSON outputs for assessments.

### Groq / Whisper
- **Provider:** Groq
- **Usage:** Ultra-fast Speech-to-Text (STT).
- **Integration:** Handled in `src/lib/voice/whisper-stt.ts` and `src/app/api/voice/transcribe/route.ts`. Audio blobs from client VAD are sent here for immediate transcription.

### AWS Polly
- **Provider:** AWS
- **Usage:** Text-to-Speech (TTS) for the AI Interviewer voice.
- **Integration:** Handled in `src/lib/aws/polly.ts` and `src/app/api/voice/synthesize-polly/route.ts`. Streamed to the client.

## External APIs

### Piston (emkc.org)
- **Usage:** Remote code execution environment for candidate code.
- **Integration:** Evaluates submitted code against test cases securely. Currently relying on the public API endpoint which is subject to strict rate limits.

### Supabase / Upstash
- **Supabase:** PostgreSQL database and Auth provider.
- **Upstash:** Redis-backed rate limiter (`src/lib/rate-limit/decision-layer.ts`) protecting AI endpoints from abuse.
