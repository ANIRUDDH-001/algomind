# AlgoMind – Complete System Reference

> **Version**: 1.0.0
> **Last Updated**: 2026-02-07
> **Status**: Production-Ready

---

## 1. Project Overview

**AlgoMind** is an AI-powered technical interview coach designed to simulate real-world coding interview environments. Unlike generic chatbots, it provides a structured, context-aware practice platform that assesses candidates on cognitive skills (e.g., problem decomposition, pattern recognition) rather than just code correctness.

### Core Philosophy
*   **Assessment > Solution**: The system values *how* a user reaches a solution over simply getting the right answer.
*   **Structured Coaching**: Feedback is pedagogical, using the Socratic method to guide users rather than revealing answers.
*   **Privacy-First & Cost-Effective**: Designed to run primarily on free-tier services (Supabase Free, Gemini Flash) with minimal operational overhead.

### Target Users
1.  **Candidates**: Students and professionals practicing for technical interviews.
2.  **Admins**: Content curators who manage the problem set and RAG knowledge base.

### Non-Goals
*   A fully-fledged IDE or compiler (code execution is simulated or client-side only).
*   A competitive programming platform (focus is on interview dialogue, not test cases).

---

## 2. System Architecture

AlgoMind follows a modern **Serverless/Edge Architecture** leveraging Next.js (App Router) and Supabase.

```mermaid
graph TD
    User[User Client] -->|HTTPS| Next[Next.js App Server]
    User -->|Direct DB Access| Supabase[Supabase (PostgreSQL)]
    
    subgraph "Frontend Layer"
        Next -->|Rendering| Pages[React Server Components]
        Next -->|API Routes| API[Internal API Layer]
    end
    
    subgraph "Data Layer"
        Supabase -->|Auth| GoTrue[GoTrue Auth]
        Supabase -->|Data| Postgres[Postgres DB + pgvector]
        Supabase -->|Storage| Storage[Bucket (Assets)]
    end
    
    subgraph "AI Services"
        API -->|Inference| Gemini[Google Gemini API]
        API -->|Embeddings| GeminiEmbed[Google Gemini Embeddings]
    end
    
    subgraph "RAG System"
        API -->|Vector Search| Postgres
        API -->|Fallback| LocalVector[Local JSON Vector Store]
    end
```

### Key Components
1.  **Frontend**: Next.js 14+ (TypeScript), TailwindCSS, Shadcn/UI.
2.  **Backend**: Next.js API Routes (Serverless Functions).
3.  **Database**: PostgreSQL (Supabase) with `pgvector` for similarity search.
4.  **AI Orchestration**: Custom `AIClient` abstraction (located in `src/lib/ai`).

---

## 3. Application Flows

### 3.1. Interview Session Flow
The core loop of the application.

1.  **Initiation**: User selects a problem → `POST /api/chat` initiated with system prompt.
2.  **Dialogue**:
    *   User sends message.
    *   **RAG Retrieval**: System queries `vectorStore` for relevant DSA concepts.
    *   **Context Injection**: Top 3 matching chunks injected into System Prompt.
    *   **AI Inference**: Gemini generates response (Socratic guidance).
3.  **Completion & Assessment**:
    *   Session ends.
    *   Transcript sent to `AssessmentEngine` (in `src/lib/assessment`).
    *   AI evaluates 8 cognitive axes (Problem Decomposition, etc.).
    *   Results stored in `assessments` table.

### 3.2. RAG Retrieval Flow
Used to ground the AI's responses in factual DSA knowledge.

1.  **Vector Generation**: User query embedded using semantic model (e.g., `text-embedding-004`).
2.  **Hybrid Search** (Implemented in `src/lib/rag/vectorStore.ts`):
    *   **In-Memory Search**: The application loads `embeddings.json` into memory for high-speed retrieval.
    *   **Algorithm**: Performs **Cosine Similarity** (semantic) + **Keyword Matching** (lexical).
    *   **Note on Database**: While the `knowledge_chunks` table exists in the schema (schema/01_schema.sql) to support future `pgvector` scaling, the current application code primarily relies on the local file-based store for simplicity and speed on the free tier.
3.  **Thresholding**: Chunks with similarity score below threshold (e.g. `0.7`) are discarded.

### 3.3. Admin Access Control
Strict RLS-based security model.

1.  **Auth**: User logs in via Supabase Auth.
2.  **Check**: `is_admin(user_id)` PostgreSQL function checks `admin_users` table.
3.  **Access**:
    *   If `true`: RLS policies allow WRITE access to `problems` and administrative tables.
    *   If `false`: Read-only access to public resources.

---

## 4. Database Design

### Core Tables

#### `admin_users`
*   **Purpose**: explicit allowlist for administrative access.
*   **Critical Columns**: `email` (PK/Unique).
*   **Security**: Only readable by authenticated users (to check their own status).

#### `problems`
*   **Purpose**: The catalog of coding challenges.
*   **Schema**:
    *   `id` (Text, Slug - e.g., 'two-sum')
    *   `difficulty` (Enum: easy, medium, hard)
    *   `examples` (JSONB): Input/output pairs.
    *   `hints` (Text[]): Progressive hints.

#### `interview_sessions`
*   **Purpose**: Logs every user attempt.
*   **RLS**: Users can ONLY see their own sessions (`auth.uid() = user_id`).
*   **Key Fields**: `transcript` (JSONB) stores full chat history.

#### `assessments`
*   **Purpose**: Structured feedback on completed sessions.
*   **Relations**: `1:1` with `interview_sessions`.
*   **Schema**: 8 distinct numeric columns (0-10) for skills + `overall_score`.

### RAG & Knowledge Tables

#### `knowledge_chunks`
*   **Purpose**: Persistent storage for knowledge base.
*   **Columns**:
    *   `content` (Text): The actual knowledge.
    *   `embedding` (vector): Schema supports vector storage (syncs with `embeddings.json`).
    *   `status` (active/archived).
    *   **Note**: Acts as the source of truth; `embeddings.json` is generated from this or kept in sync.

#### `knowledge_gaps`
*   **Purpose**: Analytics table tracking user queries that returned NO relevant chunks (misses).
*   **Usage**: Admins review this to find missing content.

### Functionality Tables

#### `user_daily_usage`
*   **Purpose**: Rate limiting.
*   **Logic**: 1 row per user per day. `questions_used` increments on every API call.
*   **Constraint**: `UNIQUE(user_id, date)`.

---

## 5. SQL Layer & Logic

### Stored Procedures

*   **`check_user_rate_limit(p_user_id, p_limit)`**:
    *   Atomic check-and-increment.
    *   Returns `remaining` quota.
    *   *Bypass*: If user email exists in `admin_users`, returns infinity.

*   **`match_knowledge_chunks(query_embedding, threshold, count)`**:
    *   Performs the `pgvector` cosine distance search (`<=>` operator).
    *   *Status*: Defined in schema (`03_functions.sql`) for future DB-based RAG migration. Current app uses in-memory search.

### Triggers

*   **`handle_new_user`**:
    *   Fires on `INSERT` to `auth.users`.
    *   Action: Automatically creates rows in `public.profiles` and `public.user_preferences`.
    *   *Why*: Ensures no "partial" user states exist in the app.

---

## 6. API Reference

### Public Endpoints

#### `POST /api/chat`
*   **Purpose**: Main interview interface.
*   **Auth**: Required (Supabase Session).
*   **Body**: `{ messages: Message[], problemContext: Problem }`.
*   **Return**: AI Stream or JSON response.
*   **Internal**: Calls RAG retrieval automatically.

#### `POST /api/rag/search`
*   **Purpose**: Semantic search for knowledge base.
*   **Body**: `{ query: string, topic?: string }`.
*   **Return**: `{ context: Chunk[] }`.
*   **Rate Limit**: 20 requests/min.

---

## 7. RAG & AI Implementation

**Library Path**: `src/lib/rag`

### Vector Strategy
*   **Model**: Semantic Embedding (e.g. `text-embedding-004`).
*   **Storage**:
    *   **Primary (Code)**: `embeddings.json` (Local Filesystem). Loaded into memory on startup.
    *   **Secondary (Schema)**: `knowledge_chunks` table (PostgreSQL). Stores source of truth; schema is `pgvector`-ready.
*   **Dimensions**: 768.

### Retrieval Mechanism
1.  **Hybrid Search**:
    *   Combines **Vector Similarity** (Cosine) and **Keyword Jaccard Index**.
    *   Weighing: defaults to `0.7` semantic + `0.3` keyword.
2.  **Fallback**:
    *   If embedding API is unavailable, degrades gracefully to pure keyword search.

---

## 8. Operational Considerations

### Limits & Scalability
*   **Database**: Supabase Free Tier (500MB). RAG vectors are space-heavy; monitor `knowledge_chunks` size.
*   **Rate Limits**: Hardcoded to 5 questions/day for free users. Configurable in `src/lib/rate-limit`.

### Monitoring
*   **Console Logging**: The app uses structured logs prefixed with `[RAG]`, `[AI]`, `[DB]` for easy filtering in Vercel/CloudWatch logs.

### Database Verification
To verify the schema matches this documentation, run the SQL script located at:
`d:/algomind/sql/verify_schema.sql`

---

## 9. Developer Guide

### Where to Start
1.  **Frontend**: `src/app/interview/page.tsx` (Main UI logic).
2.  **Backend Logic**: `src/app/api/chat/route.ts` (The brain).
3.  **Data Access**: `src/lib/supabase` (Client abstractions).

### Critical Warnings
> [!WARNING]  
> **Do not modify `src/lib/ai/prompts.ts`** without extensive testing. The system prompts are carefully Tuned to prevent the AI from giving away answers.

> [!IMPORTANT]  
> **Migrations**: Always edit SQL in `sql/` folder first, then apply to Supabase. Never patch the live DB without saving the SQL file.
