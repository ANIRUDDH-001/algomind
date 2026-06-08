# 03. API Reference & Services

AlgoMind's backend is a Next.js App Router API Gateway containing 21 distinct service domains. The API is divided into Candidate routes, Employer B2B routes, Admin endpoints, and background execution services.

## Rate Limiting Architecture (Upstash Redis)
As detailed in [Security & Auth](05-security-and-auth.md), global rate limiting intercepts API traffic at the Edge Middleware. 
- **Admin & Employer:** 200 requests globally.
- **Execute (`/api/execute`):** Handled directly within the route via Upstash: 1 execution per 3 seconds per user.
- **Assess (`/api/assess/start`):** 5 requests per 10 minutes per IP for claiming slots.

---

## 1. Inference & Chat Services (`/api/chat` & `/api/assess/chat`)

### `POST /api/chat` (Standard Mock Interview)
Handles standard candidate interactions. 
- **Features:** Supports Server-Sent Events (SSE) streaming. Forwards chunks via Inngest `interview/chat` to `Supabase Realtime` channels (`interview_${sessionId}`) to bypass Vercel serverless timeouts.
- **Payload:**
```typescript
interface ChatRequestBody {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    problemContext?: { title?: string; content?: string; ragContext?: string; tags?: string[] };
    guestMode?: boolean;
    sessionId?: string;
}
```

### `POST /api/assess/chat` (Employer Assessment)
Handles candidate AI interviews under timed constraints.
- **Limits:** Enforces max AI turns (e.g. 20, via `campaign.max_turns`) with Redis counter (`assess:${submissionId}:msgCount`).
- **Auth:** Decodes candidate JWT session securely (does not use standard Supabase Auth user).

---

## 2. Code Execution Service (`/api/execute`)

Executes user-provided code against an external sandbox (Piston API) to ensure the primary Node.js server cannot be compromised by malicious loops or system calls.
- **Caching:** Uses MD5 hashing (`exec_cache:${hash}`) via Upstash Redis to cache identical execution requests for 10 minutes.
- **Payload:**
```typescript
interface ExecuteRequest {
    language: 'python' | 'javascript' | 'java' | 'cpp';
    code: string;
    stdin?: string;
}
```

---

## 3. RAG Vector Search (`/api/rag/search` & `/api/rag/context`)

Powers the dynamic retrieval-augmented generation engine to feed the AI context about the platform's specific expectations.
- **`/api/rag/search`**: Uses LangChain's standard local retriever logic.
- **`/api/rag/context`**: The core production endpoint. Embeds the user's query into 768 dimensions and calls the Supabase RPC `match_knowledge_chunks` with a `0.5` cosine similarity threshold.

---

## 4. B2B Employer Assessments (`/api/assess/*`)

### `POST /api/assess/start`
Initializes a new assessment from a campaign invite link.
- **Logic:** Validates `campaignToken` -> Calls `verify_campaign_entry_code` -> Claims slot via `claim_campaign_slot` RPC. Issues a secure JWT token for the candidate to use during the session.

### `POST /api/assess/complete`
Finalizes an assessment and kicks off asynchronous analysis.
- **Payload:** Array of `questionStates` (transcripts and elapsed times) and `integrityFlags`.
- **Async Execution:** Fires the Supabase Edge Function `run-assessment` to analyze the result asynchronously, returning `200 OK` to the candidate immediately.

---

## 5. Voice Services (`/api/voice/*`)

### `POST /api/voice/transcribe` (STT)
Speech-to-Text utilizing Groq's Whisper API for near-instant latency.
- **Logic:** Attempts `whisper-large-v3-turbo` with a custom Data Structures & Algorithms vocabulary prompt to increase accuracy on technical terms.
- **Anti-Hallucination:** Rejects outputs based on a confidence gate (`< 0.3` threshold).

### `POST /api/voice/synthesize-polly` (TTS)
Text-to-Speech via AWS Polly.
- **Logic:** Strips markdown formatting before synthesizing. Truncates/chunks text exceeding 2900 characters. Returns an `audio/mpeg` buffer.
