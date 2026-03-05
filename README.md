# AlgoMind 🧠

> **Voice-first AI technical interview coach — speaks, listens, scores, and teaches.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://algomind-drab.vercel.app/)
[![Tests](https://img.shields.io/badge/Tests-880%20passing-success?style=for-the-badge)](https://github.com/ANIRUDDH-001/algomind)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

AlgoMind is an AI-powered technical interview preparation platform that simulates real-world coding interviews using **voice-first AI**. Built with a **Multi-Model Architecture** (Llama 4 + Gemini 2.5/3.0 + Kimi K2) and **Hybrid RAG** (JSON Vector Store + pgvector), it delivers sub-second latency and context-aware feedback across **8 cognitive dimensions**.

---

## 🌟 Key Features

### 🎤 Voice-First AI Interviewer
- **Real-time Conversation** — speak naturally; the AI interrupts, asks follow-ups, and provides hints like a human interviewer
- **Smart Interruption Manager** — framework-agnostic `InterruptionManager` with grace periods, debouncing, confidence filtering, and circular event streams for diagnostics
- **Voice Activity Detection (VAD)** — Silero VAD (ONNX Runtime) running in-browser for privacy-first, zero-latency speech detection with tunable thresholds
- **Multi-Provider Voice Pipeline** — STT (Groq Whisper / Browser native), TTS (AWS Polly / Browser native), with feature-flag-driven provider switching
- **DSA Vocabulary Engine** — 500+ technical terms for improved STT accuracy

### 🧠 8-Dimensional Cognitive Assessment
Proprietary scoring engine measuring:
1. **Problem Decomposition** — breaking down complex tasks
2. **Pattern Recognition** — identifying correct data structures/algorithms
3. **Algorithmic Thinking** — logical flow and edge case handling
4. **Code Quality** — cleanliness, naming, and modularity
5. **Communication** — clarity of thought and vocal explanation
6. **Efficiency** — time and space complexity mastery
7. **Debugging** — identifying and fixing logical errors
8. **Adaptability** — incorporating feedback and hints

### 🚀 Multi-Model AI Architecture
- **DB-Driven Model Routing** — `model_routing` table with Redis-cached (60s TTL) priority-ordered model selection per use case
- **Intelligent Fallback Chain**: DB routing → cross-tier fallback → legacy provider fallback → AWS Bedrock Claude 3.5 Sonnet
- **Chat Models**: Llama 3.3 70B, Llama 3.1 8B, Llama 4 Scout/Maverick, Kimi K2, GPT-OSS 120B/20B (via Groq)
- **Analysis Models**: Gemini 2.5 Pro, Gemini 3.0 Pro, Gemini 2.5/2.0 Flash (via Google AI)
- **Embeddings**: Gemini Embedding 001 (768 dimensions)
- **Safety**: GPT-OSS Safeguard 20B content filtering

### 📚 Practice Ecosystem
- **480+ curated problems** from Blind 75, NeetCode 150, Striver's A-Z, and Grind 75
- **AI-vetted quality control** — all problems validated by a "Lead Tech Interviewer" AI agent
- **Smart filters** — difficulty, topic (DP, Graphs, Trees, etc.), and completion status
- **FSRS-5 Spaced Repetition** — evidence-based review scheduling with SM-2 backward compatibility
- **Skill-Level FSRS** — per-skill scheduling maps cognitive dimensions to problem categories

### 🔐 Auth & Session Management
- **Supabase Auth** — Google, GitHub, email/password, magic links (with PKCE for in-app browsers)
- **Session Cache** — module-level cache with 15-minute trust window, reduces `getUser()` calls
- **Smart Middleware** — JWT local decode trusts tokens with >5 min remaining, falls back to server validation near expiry
- **Visibility-Aware Polling** — feature flag polling pauses when tab is hidden, refreshes on return
- **Guest Mode** — trial access with configurable limits and conversion flow

### 📊 Owner / Admin Panel
- **Owner Dashboard** — tabbed panel for voice debug, model monitoring, feature flags
- **Voice Debug Tab** — real-time VAD event stream, 10 tunable sliders (interruption + VAD engine params), live reconfiguration
- **Co-Owner System** — database-backed co-owner table with RLS policies
- **Feature Flags** — Redis + Supabase backed, per-user and global flags

### 💎 Additional Features
- **Visual Radar Charts** — Recharts-powered strength/weakness visualization
- **PDF Export** — professional assessment reports via `@react-pdf/renderer`
- **PWA Support** — installable app with service worker (`@ducanh2912/next-pwa`)
- **Mobile-First Design** — swipe navigation, responsive layouts, collapsible code editor
- **AI Memory** — structured memory system using Kai memory framework for personalized feedback
- **Progress Narratives** — AI-generated milestone narratives at configured intervals

---

## 🛠️ Tech Stack

### Frontend & Core
| Technology | Version | Purpose |
|-----------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.1.6 | App Router, Server Actions, Edge Middleware |
| [React](https://react.dev/) | 19.2.3 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Strict mode, full type coverage |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Utility-first styling |
| [Radix UI](https://www.radix-ui.com/) | 1.4.3 | Accessible UI primitives |
| [Framer Motion](https://www.framer.com/motion/) | 12.x | Animations and transitions |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | 4.7.0 | Code editor (VS Code engine) |
| [Recharts](https://recharts.org/) | 3.7.0 | Data visualization |

### Backend & Database
| Technology | Purpose |
|-----------|---------|
| [Supabase](https://supabase.com/) | PostgreSQL 17.6 + Auth + RLS + Realtime (29 tables) |
| [Upstash Redis](https://upstash.com/) | Caching (model routing, feature flags, rate limits) |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | FSRS-5 spaced repetition engine |
| Hybrid RAG | JSON Vector Store (MVP) + pgvector (production scale) |

### AI & Intelligence
| Provider | Models | Use Case |
|----------|--------|----------|
| **Groq** | Llama 4 Scout/Maverick, Llama 3.3 70B, Llama 3.1 8B, Kimi K2, GPT-OSS 120B/20B | Chat, hints, fast responses |
| **Google AI** | Gemini 2.5 Pro, Gemini 3.0 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash | Deep analysis, 8-dim scoring |
| **AWS Bedrock** | Claude 3.5 Sonnet v2 | Last-resort fallback |
| **Embeddings** | Gemini Embedding 001 (768d) | RAG vector search |

### Voice
| Component | Technology |
|-----------|-----------|
| VAD | Silero ONNX (v5/legacy) via ONNX Runtime Web |
| STT | Groq Whisper API + Browser Web Speech API |
| TTS | AWS Polly + Browser SpeechSynthesis |

### DevOps & Testing
| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev/) | Unit testing (880 tests, 105 files) |
| [Playwright](https://playwright.dev/) | E2E testing |
| [ESLint](https://eslint.org/) | Linting (flat config) |
| [Vercel](https://vercel.com/) | Deployment & edge functions |

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router (118 files)
│   ├── actions/            # Server Actions (save-session, spaced-rep, etc.)
│   ├── admin/              # Admin panel
│   ├── api/                # API routes (chat, voice, auth, user)
│   ├── assess/             # External assessment pages
│   ├── dashboard/          # User dashboard + interview history
│   ├── employer/           # Employer dashboard
│   ├── interview/          # Interview room + analysis page
│   ├── learn/              # Learning module
│   ├── owner/              # Owner panel (voice debug, feature flags)
│   ├── practice/           # Practice mode
│   └── settings/           # User settings
├── components/             # React components
│   ├── auth/               # AuthProvider, login forms
│   ├── interview/          # ConversationView, CodeEditor, Timer
│   ├── analysis/           # AnalysisClient, radar charts, FSRS section
│   ├── dashboard/          # Stats, history, progress cards
│   └── ui/                 # shadcn/ui primitives
├── config/                 # Voice config, provider config
├── hooks/                  # 18 custom hooks (useVAD, useSTT, useTTS, etc.)
├── lib/                    # Core business logic
│   ├── ai/                 # UnifiedAIClient, model routing, providers
│   ├── assessment/         # CognitiveAnalyzer, 8-dim scoring, narratives
│   ├── auth/               # Session cache, session manager
│   ├── interview/          # Prompt engineering, transcript enrichment
│   ├── rag/                # Hybrid vector store, knowledge retrieval
│   ├── spaced-repetition/  # FSRS-5, SM-2, review queue, skill scheduler
│   ├── recommendations/    # AI-powered learning recommendations
│   └── voice/              # VAD, STT, TTS, interruption manager
└── types/                  # Shared TypeScript type definitions
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/ANIRUDDH-001/algomind.git
cd algomind

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Fill in: GEMINI_API_KEY, GROQ_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Database Setup

After creating your Supabase project, apply the schema and seed data:

```bash
# Apply the schema (from schema details/supabase_schema.sql)
# Then run the seed migrations in order:
psql $DATABASE_URL -f supabase/migrations/20260305_cleanup_dead_tables.sql
psql $DATABASE_URL -f supabase/migrations/20260305_seed_feature_flags.sql
psql $DATABASE_URL -f supabase/migrations/20260305_seed_model_routing.sql
```

This seeds:
- **15 feature flags** in `global_feature_flags` (VAD, Smart Routing, Polly, etc.)
- **13 AI models** in `model_registry` (Groq + Gemini + embeddings)
- **11 routing rules** in `model_routing` (6 chat + 5 analysis)
- **1 system config** (`cross_tier_fallback_enabled`)

### Database Schema (29 Tables)

All tables live in the `public` schema on Supabase PostgreSQL 17.6 with pgvector extension.

| Category | Tables |
|----------|--------|
| **Core Interview** | `profiles`, `interview_sessions`, `assessments`, `problems` |
| **Spaced Repetition** | `spaced_repetition` (per-problem FSRS-5 + SM-2), `skill_repetition` (per-skill FSRS) |
| **AI Infrastructure** | `ai_models`, `model_routing`, `model_registry`, `model_performance_logs`, `system_config`, `global_feature_flags`, `system_events` |
| **RAG & Knowledge** | `knowledge_chunks` (pgvector 768-dim embeddings), `knowledge_gaps` |
| **User Experience** | `learner_profiles`, `user_preferences`, `leetcode_profiles`, `insight_snapshots`, `session_replays`, `user_daily_usage` |
| **Employer / Enterprise** | `assessment_campaigns`, `candidate_submissions`, `company_profiles`, `code_attempts`, `employer_invites` |
| **Access Control** | `admin_users`, `co_owners` |
| **Analytics** | `score_benchmarks` |

**Key extensions:** pgvector (768-dim embeddings), pgcrypto, uuid-ossp, pg_cron, pg_graphql

> Full schema reference with columns, functions, and RLS policies: see [`Algomind.md` §6](Algomind.md) or [`schema details/supabase_schema.sql`](schema%20details/supabase_schema.sql)

### Development

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run all 880 tests
npm run type-check   # TypeScript verification
npm run lint         # ESLint check
```

### Environment Variables

```bash
# AI Providers (Required)
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional
AWS_ACCESS_KEY_ID=           # For Polly TTS & Bedrock fallback
AWS_SECRET_ACCESS_KEY=
UPSTASH_REDIS_REST_URL=      # For caching
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🧪 Testing

```bash
npm run test                # 880 tests across 105 files
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:voice          # Voice module tests only
npm run test:ai             # AI module tests only
```

**Coverage thresholds enforced by module:**
- Assessment: 85% lines, 90% functions
- Interview: 80% lines, 85% functions
- Spaced Repetition: 85% lines, 90% functions
- RAG: 75% lines, 80% functions

---

## � Performance Benchmarks

> Collected on March 5, 2026 via `pwsh scripts/collect-benchmarks.ps1` — all numbers from real builds, no synthetic data.

### Code Quality & Scale

| Metric | Value |
|--------|-------|
| Test suite | **880 tests passing** across **116 test files** (105 suites) |
| Source files (TS/TSX/CSS/SQL/JS) | **481 files** |
| Lines of code | **71,403** |
| TypeScript (`.ts`) | 296 files — 44,268 lines |
| React (`.tsx`) | 178 files — 26,126 lines |
| CSS | 1 file — 399 lines |
| SQL migrations | 3 files — 113 lines |

### Architecture Metrics

| Metric | Value |
|--------|-------|
| API route handlers | **54** across 18 domains |
| React components | **117** across 19 directories |
| Custom hooks | **17** |
| Library modules | **26 dirs**, 147 files |
| App pages | **20** |
| Server actions | **5** |
| Type definitions | **5** |
| npm dependencies | **38 prod + 24 dev = 62 total** |

### Database (Supabase PostgreSQL)

| Metric | Value |
|--------|-------|
| Tables | **67** (29 public + system) |
| RLS policies | **73** |
| Database functions | **97** |
| Indexes | **96** |
| Feature flags | **15** (server-controlled via `global_feature_flags`) |
| AI model routing rules | **11** (6 chat + 5 analysis) |

### Build Performance

| Metric | Value |
|--------|-------|
| Production build time | **51.9s** (Turbopack) |
| TypeScript compilation | **7.8s** (`tsc --noEmit`) |
| Bundle total (static) | **5,672 KB** (77 files) |
| JS chunks | **5,250 KB** (65 files) |
| CSS | **196 KB** (2 files) |

### AI & Content

| Metric | Value |
|--------|-------|
| AI models integrated | **13** across 3 providers (Groq, Gemini, Bedrock) |
| DSA vocabulary (STT boost) | **6,230 terms** |
| RAG knowledge base | **8 topic files** → 31 embedding chunks (1.8 MB) |
| Embedding dimensions | **768** (Gemini Embedding 001) |
| Model routing fallback tiers | **5** (DB → cross-tier → legacy → Bedrock → static) |
| Total project files | **535** |

### Core Web Vitals Thresholds (Playwright)

| Metric | Target (CI) | Target (Dev) |
|--------|-------------|--------------|
| TTFB | < 800ms | < 3000ms |
| LCP | < 2500ms | < 2500ms |
| TBT | < 200ms | < 200ms |
| CLS | < 0.1 | < 0.1 |
| Interview page Begin button | < 5s | < 5s |
| Monaco editor ready | < 3s | < 3s |

---

## �📄 License

MIT License © 2026 AlgoMind

**Team**: Aniruddh Vijayvargia & Prachi Agarwalla
**Live Demo**: [algomind-drab.vercel.app](https://algomind-drab.vercel.app/)
