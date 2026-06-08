# AlgoMind

Welcome to the AlgoMind repository. AlgoMind is a scalable, AI-driven technical interviewing platform designed to simulate realistic coding interviews, assess candidate proficiency across 8 algorithmic dimensions, and optimize long-term learning via Spaced Repetition (FSRS).

## Architecture & Documentation Hub

The core architecture of AlgoMind is a Serverless Monolith with Edge Enhancements. We utilize Next.js App Router for both the frontend UI and the backend API Gateway, backed by Supabase (PostgreSQL), Upstash Redis, and Inngest.

To ensure developers have a deep, accurate understanding of the system, we have compiled an exhaustive, multi-part engineering wiki located in the `docs/` directory.

### [01. System Architecture & High-Level Design (HLD)](docs/01-system-architecture.md)
Maps out the entire macro architecture (Vercel, Supabase, Inngest, Piston, Gemini) and provides sequence diagrams for the critical asynchronous parallel pipelines (e.g., `assessInterviewFunction`).

### [02. Database Schema & Architecture](docs/02-database-schema.md)
Contains a comprehensive Mermaid Entity Relationship Diagram (ERD) mapping all 20+ tables in the `public` schema. Details Row Level Security (RLS) constraints, Spaced Repetition (FSRS) data structures, and RAG vector configurations.

### [03. API Reference & Services](docs/03-api-reference.md)
Documents the 21 distinct service domains within the Next.js API router. Covers request/response payloads, code execution sandboxing (Piston), RAG vector search, and Voice STT/TTS pipelines.

### [04. Frontend UI/UX & Voice State Machines](docs/04-frontend-ui-ux.md)
Provides State Machine diagrams for the complex Voice Activity Detection (VAD) hardware layer and the logical Interview Protocol layer. Maps out the Client/Server component boundaries.

### [05. Security, Authentication & Edge Middleware](docs/05-security-and-auth.md)
Details the global Next.js Edge Middleware interceptor. Explains how Supabase Auth JWTs are synchronized via SSR, how Role-Based Access Control is enforced, and how Upstash Redis throttles traffic per tier.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase Project
- Upstash Redis instance
- Gemini API Key / Groq API Key / AWS Credentials (for Polly)

### Local Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. In a separate terminal, start the Inngest local dev server to handle background queues:
   ```bash
   npx inngest-cli@latest dev
   ```
