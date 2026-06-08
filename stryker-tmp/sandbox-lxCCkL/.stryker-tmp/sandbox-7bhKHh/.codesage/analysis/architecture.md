# Architecture Audit

## System Design

The application follows a **Serverless Monolith with Edge Enhancements** architecture.

### Request Lifecycle (Primary Voice Interview Flow)
1. **Client Audio Capture:** `<InterviewSession>` mounts and `useVAD` hook listens to microphone input using `@ricky0123/vad-web`.
2. **Speech End Detection:** VAD detects the end of the candidate's speech and packages the audio blob.
3. **STT Processing:** Audio blob is sent to `/api/voice/transcribe` -> Groq Whisper API for lightning-fast transcription.
4. **State Machine Update:** Client `state-machine.ts` transitions from `LISTENING` to `THINKING`.
5. **LLM Inference:** Transcript is sent to `/api/interview/chat` -> Gemini API via `src/lib/ai/client.ts`. RAG Context is injected using `src/lib/rag/retriever.ts` (fetching pgvector embeddings from Supabase).
6. **Streaming & Chunking:** LLM response streams back. `text-chunker.ts` breaks stream into logical sentences.
7. **TTS Generation:** Sentences are piped to `/api/voice/synthesize-polly` -> AWS Polly.
8. **Playback:** Client receives audio buffers and plays them sequentially. State transitions back to `LISTENING`.

### Module Map
- **`src/app/api`**: All backend routing, completely isolating Supabase/Upstash/AI secret keys from the client.
- **`src/components`**: Presentation layer. Strictly typed React components with Tailwind/shadcn.
- **`src/lib/voice`**: Core voice engine (VAD, TTS, Interruptions).
- **`src/lib/assessment`**: Cognitive grading logic utilizing LLMs to evaluate `assessments` table schema metrics.
- **`src/lib/rate-limit`**: Upstash Redis circuit breakers.

## Architecture Diagram

```mermaid
graph TD
    Client[Browser Client]
    VAD[VAD-Web Audio]
    API_STT[/api/voice/transcribe]
    API_CHAT[/api/interview/chat]
    API_TTS[/api/voice/synthesize-polly]
    
    Supabase[(Supabase PostgreSQL)]
    Redis[(Upstash Redis)]
    
    Groq[Groq Whisper STT]
    Gemini[Gemini 1.5 LLM]
    Polly[AWS Polly TTS]
    
    Client -->|Audio Blob| API_STT
    API_STT -->|Transcribe| Groq
    Groq -->|Text| API_STT
    API_STT -->|Transcript| Client
    
    Client -->|Context + Transcript| API_CHAT
    API_CHAT -->|Rate Limit Check| Redis
    API_CHAT -->|Fetch RAG Context| Supabase
    API_CHAT -->|Prompt| Gemini
    Gemini -->|Streamed LLM Reply| API_CHAT
    API_CHAT -->|Streamed Text| Client
    
    Client -->|Sentence| API_TTS
    API_TTS -->|Synthesize| Polly
    Polly -->|Audio Stream| API_TTS
    API_TTS -->|Audio Buffer| Client
    Client -->|Playback| VAD
```
