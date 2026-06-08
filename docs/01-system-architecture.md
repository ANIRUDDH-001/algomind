# 01. System Architecture & High-Level Design (HLD)

AlgoMind is architected as a **Serverless Monolith with Edge Enhancements**. It utilizes Next.js App Router for both the frontend UI and the backend API Gateway. Heavy asynchronous workloads and parallel processing are offloaded to **Inngest**.

## High-Level Architecture (Mermaid)

```mermaid
flowchart TD
    %% Client Tier
    Client(("Browser Client"))
    VAD["VAD-Web ONNX"]
    
    %% Edge & Gateway
    VercelEdge["Vercel Edge Middleware\n(Auth & Rate Limits)"]
    API["Next.js API Routes"]
    
    %% Storage & Auth
    SupabaseDB[("Supabase PostgreSQL")]
    SupabaseRealtime(("Supabase Realtime\nWebSockets"))
    Upstash[("Upstash Redis\nCaching & Limits")]
    
    %% Parallel Processing & AI
    Inngest["Inngest Background\nWorkers"]
    Gemini["Gemini 2.5\nInference"]
    Groq["Groq Whisper\nSTT"]
    AWSPolly["AWS Polly\nTTS"]
    Piston["Piston API\nCode Sandbox"]

    %% Connections
    Client <--> |Voice/UI| VAD
    Client --> |HTTPS Requests| VercelEdge
    VercelEdge --> API
    VercelEdge <--> |Rate Check| Upstash
    
    %% Backend
    API <--> SupabaseDB
    API <--> Upstash
    API --> |Trigger Event| Inngest
    API --> |Code Execution| Piston
    API --> |Voice I/O| Groq
    API --> |Voice I/O| AWSPolly
    
    %% Async Pipelines
    Inngest <--> |Read/Write| SupabaseDB
    Inngest <--> |Inference| Gemini
    Inngest --> |Stream Chunks| SupabaseRealtime
    SupabaseRealtime --> |Broadcast| Client
```

## Parallel Processing Pipelines (Inngest)

To keep the API fast and responsive, AlgoMind heavily relies on Inngest background functions defined in `src/lib/inngest/functions.ts`. 

### 1. `assessInterviewFunction`
Triggered by the event `interview/assess` when a user ends a session. It runs a complex series of steps:
1. `fetch-session` & `fetch-problem` (Load DB context)
2. `analyze-transcript` (Passes the entire transcript to the `CognitiveAnalyzer` / Gemini)
3. `save-assessment` (Saves the 8-dimension scores: Problem Decomposition, Pattern Recognition, etc.)
4. `post-commit-updates` (Massive parallel fan-out):
    - Updates **Knowledge Gaps** if the user asked questions the RAG didn't know.
    - Updates the **Spaced Repetition (FSRS)** queue (`addToQueue` and `updateSkillRepetition`).
    - Updates the user's **Knowledge Graph** via `getKnowledgeGraphService()`.
    - Regenerates the overarching **KAI Memory Narrative** (`updateKaiMemory`).

```mermaid
sequenceDiagram
    participant API as /api/interview/analyze
    participant Inngest
    participant Gemini
    participant Supabase

    API->>Inngest: Trigger 'interview/assess'
    API-->>Client: 200 OK (Accepted)
    
    Inngest->>Supabase: 1. fetch-session
    Inngest->>Supabase: 2. fetch-problem
    Inngest->>Gemini: 3. analyze-transcript (CognitiveAnalyzer)
    Gemini-->>Inngest: 8-Dimension Scores & Feedback
    Inngest->>Supabase: 4. save-assessment
    
    par 5. Post-Commit Fan-Out
        Inngest->>Supabase: Insert Knowledge Gaps
        Inngest->>Supabase: Update FSRS Matrix (spaced_repetition)
        Inngest->>Supabase: Update Knowledge Graph
        Inngest->>Supabase: Update KAI Memory (learner_profiles)
    end
```

### 2. `chatAssistantFunction`
Triggered by `interview/chat`. Instead of holding an open Vercel serverless function (which times out after 10-60 seconds depending on plan), AlgoMind streams AI responses asynchronously.
1. The API fires the Inngest event and immediately returns `200 OK`.
2. The Inngest worker calls `getAIClient().generateStream()`.
3. As Gemini generates tokens, Inngest sends them to a **Supabase Realtime Channel** (`interview_${sessionId}`) via REST.
4. The client's WebSocket connection receives the chunks and renders the text dynamically.
