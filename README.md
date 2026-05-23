# 🧠 Algomind

Welcome to **Algomind**, the next-generation AI-powered mock interview platform. This repository serves as the core blueprint for the application's backend, frontend, and database architecture.

## 🚀 Overview

Algomind is built to provide a highly interactive, voice-driven, and code-enabled interview experience. It features strict timing/turn constraints, highly responsive UI dual-layouts, and fallback-heavy backend services to ensure 100% uptime during live sessions.

### Key Capabilities
- **Voice Pipeline**: Real-time STT/TTS processing with fallback mechanisms.
- **Code Execution**: In-browser synchronized code editing and remote execution via Piston.
- **Cognitive Assessment**: Multi-dimensional grading covering algorithmic thinking, communication, problem decomposition, and pattern recognition.
- **Spaced Repetition**: Adaptive learning integrations for post-interview reviews.
- **Robust Telemetry**: Fire-and-forget backend logging and performance monitoring.

---

## 🛠 Tech Stack

- **Frontend**: Next.js, React 18, Tailwind CSS, Lucide Icons
- **Backend Architecture**: Next.js App Router (Serverless Functions), Upstash Redis (Caching & Rate Limiting)
- **Database & Auth**: Supabase (PostgreSQL, Row-Level Security, JWT Auth, Atomic RPCs)
- **AI / Voice Integration**:
  - **STT**: Groq Whisper (Primary) -> Web Speech API (Fallback)
  - **TTS**: AWS Polly (Primary) -> Browser TTS (Fallback)
  - **Assessment Engine**: Groq/Gemini routing determinism
- **Testing**: Vitest, React Testing Library

---

## 🏗 Architecture & System Design

### 1. Graceful Degradation (Voice & AI)
The system is designed with multiple fail-safes. If Groq Whisper or AWS Polly experiences an outage, Algomind instantly falls back to native Browser Speech APIs without crashing the active user session. AI routing gracefully cascades through fallback models for assessment grading.

### 2. Frontend Modularity & Layouts
The primary `InterviewSession` orchestrates logic globally, distributing state via `InterviewLayoutContext`.
- **`DesktopLayout`**: A dynamic 4-quadrant UI for side-by-side video/voice, problem description, code execution, and chat history.
- **`MobileLayout`**: A heavily optimized, swipe-friendly UI isolating concerns into focused tabs (Voice, Code, Problem) to prevent viewport stretching.

### 3. Database Integrity & Security (Supabase)
Our PostgreSQL instance strictly guards user data.
- **Row-Level Security (RLS)**: Enforced via JWT claims (`auth.uid()`).
- **Atomic Operations**: Core session completions are performed via secure RPCs (`save_interview_session_atomic`) to prevent partial multi-table writes.
- **CHECK Constraints**: Score boundaries (0-100) and enum matching are native to the DB schema to prevent phantom dirty states.
- **JSONB Optimization**: Deep-nested data (`transcript`, `skill_evidence`) are highly optimized with `GIN` indexes.

---

## 🧪 Testing

The repository boasts a massive suite of ~1,300+ tests spanning unit, integration, and UI component layers. We utilize `vitest` for blisteringly fast test parallelization.

```bash
# Run the complete test suite
npm run test
```

*Note: Component tests involving deeply nested context providers must be wrapped in their respective layout providers (e.g., `InterviewLayoutContext.Provider`).*

---

## 🔒 Security Best Practices
- Ensure you have configured all ENV variables prior to deploying the Next.js edge functions. Missing ENVs will trigger graceful service degradation rather than full crashes, but primary models will be bypassed.
- RLS Policies restrict reads/writes strictly to authenticated users. System-level DB patches bypass these constraints safely during atomic RPC execution.

---
**Prepared post-audit (Launch Version 1.0.0). Happy coding!**
