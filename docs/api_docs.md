# API Architecture & Pipelines

AlgoMind's backend is built entirely on the **Next.js 14 App Router** using Edge and Node.js runtimes.

## Routing Architecture

All backend endpoints are located in `src/app/api`. The architecture is split across multiple feature verticals to handle distinct aspects of the interviewing and assessment platform.

### Feature Verticals

- **`/api/interview/chat`**
  - The core real-time conversational endpoint.
  - Interacts with Gemini 1.5 to provide AI responses.
  - Supports standard JSON responses as well as streaming chunks.
  
- **`/api/execute`**
  - Secure code execution API utilizing the external Piston API (emkc.org).
  - Features payload caching (via Upstash Redis) to prevent redundant executions and reduce third-party API load.
  - Includes compile error fallbacks for graceful degradation.

- **RAG Pipelines**
  - **`/api/rag/context`**: Utilizes `pgvector` inside Supabase via the `match_knowledge_chunks` RPC call to find relevant context embeddings for the AI.
  - **`/api/rag/search`**: Utilizes a hybrid semantic/keyword JSON-based fallback store (`SimpleVectorStore`).

- **`/api/voice`**
  - Orchestrates Text-to-Speech (TTS, via AWS Polly) and Speech-to-Text (STT, via Groq Whisper) streaming for voice-based interactions.

- **Protected System APIs**
  - **`/api/assess/chat`**, **`/api/assess/start`**, **`/api/assess/complete`**: Endpoints managing the assessment flow state.
  - **`/api/admin/*`**, **`/api/owner/*`**, **`/api/employer/*`**: Role-restricted APIs for platform management and campaign tracking.

## API Security & Rate Limiting

### Authentication Middleware
The security pipeline is primarily driven by Next.js Edge Middleware (`src/middleware.ts`). Before requests reach the route handlers, the middleware intercepts them to:
1. Verify the JWT via Supabase SSR (`@supabase/ssr`).
2. Enforce role constraints, such as ensuring only authenticated employers can access `/api/employer/*`.
3. Handle "Guest Mode" exceptions for `/interview` and `/api/chat` when the `ENABLE_GUEST_MODE` feature flag is active.

### Rate Limiting (Upstash & Supabase)
To protect the system from abuse and manage API costs, multi-layered rate limiting is enforced:
- **Upstash Redis:** Used globally for API rate limiting, especially critical for admin, employer tiers, and the external code execution API.
- **Supabase RPCs:** Database-level atomicity is used to track and restrict request ceilings. For example, `atomic_increment_weekly_usage` ensures that users do not exceed their allocated Inngest job counts or AI interaction quotas.
- `user_daily_usage` and `user_weekly_usage` tables in the database are queried to enforce request rate ceilings on expensive AI and execution endpoints.
