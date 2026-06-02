# AlgoMind
> An AI-powered technical interview and learning platform that simulates real-world coding interviews with voice and real-time feedback.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Supabase](https://img.shields.io/badge/Supabase-DB-green) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

---

## What This Is

AlgoMind solves the problem of finding high-quality, realistic technical interview practice. Candidates often practice algorithms in a vacuum, failing to develop the communication and problem-decomposition skills required in actual interviews. AlgoMind provides an interactive, voice-enabled interview environment that assesses cognitive skills just like a human interviewer.

The system orchestrates a complex state machine that pairs a real-time code editor with AI-driven voice interaction. It chunks candidate speech, analyzes problem-solving dimensions in real time, manages interruptions dynamically, and generates comprehensive post-interview feedback and skill trajectory analytics.

Unlike simple chatbot wrappers, AlgoMind uses a dedicated multi-agent backend. It separates the cognitive assessment logic from the conversational flow, utilizing a retrieval-augmented generation (RAG) system for context, an Upstash-backed rate limiter for abuse prevention, and a custom state machine to handle edge cases like candidate silence or mid-sentence interruptions.

---

## Architecture

*Architecture diagram available in internal masterbook.md*

The architecture relies on a Next.js App Router monolith communicating with a Supabase PostgreSQL backend. Real-time voice processing uses a combination of client-side Voice Activity Detection (VAD), AWS Polly for Text-to-Speech (TTS), and Groq/Whisper for Speech-to-Text (STT), all orchestrated via server-side API routes.

---

## Tech Stack

| Layer | Technology | Role in This Project |
|-------|-----------|----------------------|
| **Frontend** | Next.js 14, React 19, Tailwind CSS | Client interface, Server Components, Routing |
| **Backend** | Next.js API Routes, Inngest | REST endpoints, Background Jobs |
| **Database** | Supabase (PostgreSQL + pgvector) | Persistent storage, RAG embeddings |
| **Caching/Rate Limits** | Upstash Redis | API Rate limiting, Circuit breakers, Session caches |
| **AI Models** | Gemini API, Groq, DeepSeek | Conversational intelligence, Transcript assessment |
| **Voice / STT / TTS** | AWS Polly, Whisper, VAD-Web | Client-side silence detection, Speech generation |
| **Auth** | Supabase Auth | User management and session tracking |

---

## Key Features

- **Interactive Coding Environment**: Split-pane code editor with real-time compilation execution via Piston.
- **Voice-First AI Interviewer**: Client-side VAD combined with AWS Polly enables a low-latency, interruptible voice interview experience.
- **Multi-dimensional Assessment**: Evaluates candidates across 8 cognitive dimensions (e.g., algorithmic thinking, communication clarity) instead of just pass/fail.
- **Spaced Repetition Learning (FSRS)**: Adapts problem difficulty and schedules reviews based on performance.
- **Cohort Analytics for Employers**: Enterprise dashboards to track candidate performance and hire-readiness.

---

## AI & External Integrations

| Integration | Provider | Used For |
|------------|---------|---------|
| Gemini 1.5 | Google AI Studio | Core conversational agent and assessment generation |
| Whisper STT | Groq | Ultra-fast speech-to-text processing |
| Polly TTS | AWS | Generating realistic AI interviewer voice audio |
| Piston API | EngineerMan | Remote code execution for candidate solutions |

---

## Getting Started

### Prerequisites
- Node.js v20+
- Supabase Project (PostgreSQL)
- Upstash Redis Database
- Google AI Studio API Key

### Installation

```bash
git clone [repo URL]
cd algomind
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | Yes | https://xyz.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public anonymous key | Yes | eyJhb... |
| SUPABASE_SERVICE_ROLE_KEY | Supabase admin bypass key | Yes | eyJhb... |
| INTERNAL_API_SECRET | Auth secret for edge functions | Yes | my-secret |
| ASSESSMENT_JWT_SECRET | JWT signing secret for sessions | Yes | my-jwt-secret |
| GEMINI_API_KEY | Google AI Studio API Key | Yes | AIza... |

### Running Locally

```bash
npm run dev
```

---

## Project Structure

```
algomind/
├── scripts/         # Build and utility scripts
├── src/
│   ├── app/         # Next.js App Router pages and API endpoints
│   ├── components/  # React UI components (Dashboard, Interview, UI primitives)
│   ├── hooks/       # Custom React hooks
│   ├── lib/         # Core business logic (AI, DB, Assessment, Voice)
│   ├── test-utils/  # Mocks and test helpers
│   ├── types/       # Global TypeScript interfaces
│   └── __tests__/   # Integration and unit tests
```

---

## Known Limitations

- Voice pipeline latency is heavily dependent on the chosen TTS provider and may not yet be optimized for sub-500ms responses on slow connections.
- The Piston code execution API defaults to a public endpoint, which is subject to strict rate limits and should be self-hosted for production.
- RAG context retrieval currently relies on simple vector similarity without hybrid search (BM25), which may reduce accuracy on highly ambiguous queries.

---

## License

[License TBD]

---

## Built By

AlgoMind Team
