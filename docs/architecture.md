# Architecture & System Design

AlgoMind is a scalable, AI-driven technical interviewing platform. Its architecture is built as a **Serverless Monolith with Edge Enhancements**, enabling high performance, rapid iteration, and secure multi-tenant capabilities.

## High-Level Design (HLD)

- **Frontend & API Gateway:** Built with Next.js 14 (App Router) and hosted on Vercel. Both the UI and backend API endpoints reside in the same repository.
- **Persistent Data Layer:** Supabase (PostgreSQL) is the core database. It handles user profiles, interview sessions, coding problems, spaced repetition tracking (FSRS), and RAG embeddings via `pgvector` (using the `match_knowledge_chunks` RPC).
- **Real-Time Data:** Supabase Realtime (WebSockets) is utilized to broadcast streaming AI chat chunks directly to the client (e.g., via `chatAssistantFunction` processed by Inngest).
- **Ephemeral Data & Caching:** Upstash Redis is used for global API rate limiting (especially for admin/employer tiers) and caching execution results.
- **Asynchronous Processing:** Inngest handles heavy background workflows asynchronously to keep the primary API responsive.
- **AI Models:** Gemini 1.5 serves as the core LLM for conversational generation and assessment. AWS Bedrock/Polly is used for Text-to-Speech (TTS), and Groq Whisper acts as a Speech-to-Text (STT) fallback.

## Low-Level Design (LLD)

### UI/UX Architecture
- **Framework & Libraries:** React 19, Tailwind CSS v4, Framer Motion for animations, Radix UI / Shadcn for accessible UI primitives, and `react-resizable-panels` for the complex interview layout.
- **Component Patterns:** The frontend leverages strongly typed React Server Components for data fetching, paired with highly interactive Client Components. For example, the `<InterviewSession>` component maintains a sophisticated internal state machine handling voice modes (Listening, Thinking, Speaking, Interrupted).
- **Dashboards:** Separate layouts and role-based access control mechanisms exist for Candidates (`/dashboard`), Employers (`/employer`), and Owners (`/owner`). These dashboards feature deep analytics such as an 8-Dimensional Cognitive Profile radar chart (`RadarChart`), session history timelines, and AI-generated KAI narrative summaries.

### Voice Processing State Machine
- **Client-Side:** `@ricky0123/vad-web` handles Voice Activity Detection (VAD) locally in the browser via ONNX. This ensures near-zero latency for interruption detection.
- **TTS Engine:** The TTS engine (`src/lib/voice/tts-engine.ts`) implements a robust cascade strategy. It attempts AWS Polly TTS first and falls back to the native Browser WebSpeech API. It includes chunking logic to prevent 30-second browser TTS timeouts.

## Security
- **Edge Middleware:** Edge Middleware (`src/middleware.ts`) intercepts requests to handle session-based route protection, enforce rate-limiting via Upstash, and perform diagnostic completion checks.
- **Data Isolation:** Row Level Security (RLS) within Postgres isolates tenant data, ensuring users and employers only access data they are authorized to view.
- **Execution Security:** The `/api/execute` endpoint utilizes the external Piston API for secure, sandboxed code execution, with payload caching and fallback mechanisms.

## Parallel Processing & Backend Pipelines
- **Framework:** Inngest (`src/lib/inngest/functions.ts`) is the core engine managing parallel, asynchronous background jobs.
- **Key Workflows:**
  - `assessInterviewFunction`: Triggered when an interview session concludes. It runs the `CognitiveAnalyzer` over the session transcript to compute an 8-dimension score, saves the assessment, updates the user's Knowledge Graph, calculates Spaced Repetition (FSRS) intervals, and updates KAI memory.
  - `chatAssistantFunction`: Offloads AI response streaming. It generates the response via Gemini 1.5 and pushes chunks to the client asynchronously over a Supabase Realtime channel (`interview_${sessionId}`).

## Known Technical Debt & Caveats
- **Code Execution:** Dependency on a public Piston API (`emkc.org`) poses potential scaling and IP rate-limiting risks for production workloads.
- **Vector Storage:** A `SimpleVectorStore` implementation exists as a fallback or migration path for embeddings, alongside the primary `pgvector` architecture.
- **UI Consistency:** The frontend relies on some duplicated loading skeleton logic across different dashboard variants.
