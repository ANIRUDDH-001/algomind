# AlgoMind — System Reference

> Complete technical reference for the AlgoMind codebase. Updated March 2026.

---

## 1. Architecture Overview

AlgoMind follows a **Voice-First, Latency-Critical** architecture. The system is a Next.js 16 application using the App Router with Server Actions, deployed on Vercel, backed by Supabase (PostgreSQL + Auth) and Upstash Redis for caching.

```
User (Browser) ──► Voice (VAD/STT) ──► Server Actions ──► AI Orchestration ──► TTS ──► User
                    ──► Code Editor ──►                   ──► RAG Lookup
```

**Core design principles:**
- Edge-first: JWT validation happens locally in middleware when possible
- Multi-model: DB-driven routing with Redis-cached model selection
- Voice-first: Sub-second voice-to-voice latency via Silero VAD + Groq Whisper
- Offline-resilient: PWA with service worker + localStorage config persistence

---

## 2. AI Subsystem

### 2.1 UnifiedAIClient (`src/lib/ai/client.ts`)

Single entry point for all AI calls. Uses direct `fetch` (no SDKs) to Groq and Gemini REST APIs.

**Fallback chain (ordered):**
1. **DB-driven routing** — reads `model_routing` table (Redis-cached 60s), ordered by `priority ASC`
2. **Cross-tier fallback** — chat models fall back to analysis models and vice versa
3. **Legacy provider fallback** — groq → gemini or gemini → groq
4. **Bedrock emergency** — Claude 3.5 Sonnet v2 (requires `AWS_ACCESS_KEY_ID`)

### 2.2 Model Registry

**Groq Models (Chat / Speed Layer):**
| Model | Tier | Notes |
|-------|------|-------|
| `llama-3.3-70b-versatile` | 1 | Primary chat model |
| `llama-3.1-8b-instant` | 2 | Ultra-fast hints |
| `meta-llama/llama-4-scout-17b-16e-instruct` | 4 | Balanced |
| `moonshotai/kimi-k2-instruct-0905` | 5 | Structured output |
| `openai/gpt-oss-120b` | 5 | Heavy reasoning |
| `openai/gpt-oss-20b` | 6 | Light reasoning |
| `openai/gpt-oss-safeguard-20b` | 99 | Safety filtering |

**Gemini Models (Analysis / Intelligence Layer):**
| Model | Tier | Notes |
|-------|------|-------|
| `gemini-2.5-pro` | 10 | Deep analysis, 8-dim scoring |
| `gemini-1.5-pro` | 10 | Fallback analysis |
| `gemini-2.5-flash` | 12 | Cost-optimized analysis |
| `gemini-2.0-flash` | 11 | Fast analysis |
| `gemini-1.5-flash` | 11 | Legacy fallback |

**Bedrock Fallback:** `anthropic.claude-3-5-sonnet-20241022-v2:0`

**Embeddings:** `gemini-embedding-001` (768 dimensions)

### 2.3 Model Routing (`src/lib/ai/model-routing.ts`)

- Database table: `model_routing` with columns `use_case`, `model_id`, `provider`, `priority`, `is_active`
- Redis cache: 60s TTL via Upstash, key `model-routing:{useCase}`
- Cross-tier fallback controlled by `system_config.cross_tier_fallback_enabled` flag
- Emergency fallback derives model list from static `CHAT_MODELS` array when both Redis and DB fail

### 2.4 Providers (`src/lib/ai/providers.ts`)

Direct HTTP calls to:
- **Groq**: `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible)
- **Gemini**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Bedrock**: AWS SDK `InvokeModelCommand` with Anthropic Messages API format

---

## 3. Voice Subsystem (`src/lib/voice/`)

### 3.1 VAD Manager (`vad-manager.ts`)

Singleton wrapper around `@ricky0123/vad-web` MicVAD. Loads ONNX Runtime + VAD bundle from `/public/vad/` via `<script>` tags (avoids Turbopack compilation).

**State machine:** `IDLE → INITIALIZING → PAUSED ⇄ LISTENING → DESTROYED | ERROR`

**Configurable parameters (via owner panel):**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `positiveSpeechThreshold` | 0.7 | Confidence to detect speech start |
| `negativeSpeechThreshold` | 0.25 | Confidence to detect speech stop |
| `redemptionMs` | 1500 | Pause tolerance before closing segment |
| `minSpeechMs` | 800 | Minimum segment length |
| `preSpeechPadMs` | 300 | Audio prepended before speech start |

**`reconfigureVAD()`** — destroys and recreates the singleton with fresh config from localStorage.

### 3.2 Interruption Manager (`interruption-manager.ts`)

Framework-agnostic interruption detection with:
- **Grace period** (`graceMs`, default 500ms): AI must speak this long before interruption allowed
- **Debounce** (`debounceMs`, default 1000ms): minimum gap between successive interruptions
- **Confidence filtering** (`minConfidence`, default 0.8): VAD confidence threshold
- **Duration filtering** (`minSpeechDurationMs`, default 200ms): minimum speech segment
- **Consecutive frames** (`consecutiveHighFrames`, default 3): required for trigger
- **Circular event stream**: diagnostics buffer for the owner debug panel

### 3.3 STT — Whisper (`whisper-stt.ts`)

`WhisperSTT` class sends Float32Array audio (converted to WAV) to Groq's Whisper API endpoint. Falls back to browser Web Speech API.

### 3.4 TTS Engine (`tts-engine.ts`)

`TTSEngine` supports AWS Polly (server-side synthesis) and browser SpeechSynthesis. Provider selection is feature-flag-driven via `src/config/providers.ts`.

### 3.5 Voice Config (`src/config/voice-config.ts`)

All voice parameters are runtime-overridable via `localStorage` key `algomind:voice-config`. The owner panel writes here, and live components read on change.

---

## 4. Assessment Subsystem (`src/lib/assessment/`)

### 4.1 CognitiveAnalyzer (`analyzer.ts`)

Scores interviews across 8 dimensions (0-10 each):
1. Problem Decomposition
2. Pattern Recognition
3. Algorithmic Thinking
4. Code Quality
5. Communication
6. Efficiency
7. Debugging
8. Adaptability

Produces `HireDecision`: STRONG_HIRE, HIRE, LEAN_HIRE, LEAN_NO_HIRE, NO_HIRE, STRONG_NO_HIRE.

### 4.2 Score Validation (`score-validator.ts`)

`validateAndCorrectScores()` auto-corrects AI-generated scores that fall outside valid ranges.

### 4.3 Evidence Extraction (`evidence-extractor.ts`)

`extractEvidence()` pulls specific evidence from interview transcripts to back up scores.

### 4.4 Progress Narratives (`narrative-generator.ts`)

AI-generated milestone narratives trigger at intervals: 1, 3, 5, 10, 15, 20, 30, 40, 50 sessions.

### 4.5 Trend Analysis (`trend-calculator.ts`)

`calculateTrend()` computes directional trends across score history.

---

## 5. Spaced Repetition (`src/lib/spaced-repetition/`)

### 5.1 FSRS-5 Engine (`fsrs.ts`)

Primary scheduler using `ts-fsrs` library:
- 85% retention target
- 180-day maximum interval
- Fuzz enabled
- FSRS-5 default weights (17 parameters)
- Maps 0-10 DSA scores → FSRS ratings (Again/Hard/Good/Easy)

### 5.2 SM-2 Legacy (`sm2.ts`)

Classic SM-2 implementation for backward compatibility:
- Ease factor adjustment
- 180-day cap
- Quality 0-5 scale derived from 0-10 interview scores

### 5.3 Review Queue (`queue.ts`)

`addToQueue()` uses FSRS as primary engine, writes SM-2 fields for backward compat. Reads/writes `spaced_repetition` table via Supabase service client.

### 5.4 Skill Scheduler (`skill-scheduler.ts`)

Per-skill FSRS scheduling. Maps skill IDs to problem tags (e.g., `problem-decomposition` → recursion, trees, graphs). `getDueSkills()` reads `skill_repetition` table.

---

## 6. Auth & Middleware

### 6.1 AuthProvider (`src/components/auth/AuthProvider.tsx`)

- Single `onAuthStateChange` subscription (no separate `getSession()`)
- Events: `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`
- Session cache integration via `markSessionValid()`, `markRefreshed()`, `clearCache()`
- Methods: OAuth (Google/GitHub), email/password, magic link (PKCE)
- E2E bypass for Playwright in non-production

### 6.2 Session Cache (`src/lib/auth/session-cache.ts`)

Module-level cache with:
- 15-minute trust window
- JWT expiry tracking
- Functions: `isSessionTrusted()`, `getCachedUserId()`, `markSessionValid()`, `clearCache()`

### 6.3 Middleware (`src/middleware.ts`)

- **JWT optimization**: Decodes JWT locally (no verification), trusts if >5 min until expiry
- **Route protection**: Unauthenticated users redirected from protected routes to `/login`
- **Guest mode**: `/interview` accessible with `?demo=true` or `algomind_demo_mode` cookie
- **Owner/co-owner gating**: Checks `profiles.account_type` and `co_owners` table
- **Employer routing**: Redirects employer accounts to `/employer/dashboard`
- **E2E bypass**: Development/test only with `playwright-e2e` cookie

---

## 7. Database Schema (Supabase PostgreSQL)

### Key Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with `account_type` (user/employer/admin) |
| `interview_sessions` | Interview transcripts, scores, metadata |
| `problems` | 480+ curated DSA problems with difficulty, topics, starter code |
| `spaced_repetition` | FSRS-5 + SM-2 review scheduling data |
| `skill_repetition` | Per-skill FSRS scheduling |
| `model_routing` | AI model configuration (provider, priority, active status) |
| `system_config` | Feature flags and system settings |
| `co_owners` | Co-owner access control |
| `feature_flags` | Per-user and global feature flags |

### RLS Policies
- Users can only read/write their own data
- Owner/co-owner access controlled by `is_owner()` function (calls `auth.uid()` internally)
- Admin access via `is_admin()` function

---

## 8. Hooks Reference (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useAdmin` | Admin role detection via AuthProvider context |
| `useAssessment` | Assessment state management |
| `useFeatureFlag` | Per-user feature flag |
| `useGlobalFeatureFlag` | Global feature flag with visibility-aware polling |
| `useGuestSession` | Guest/demo session management |
| `useGuestTrial` | Guest trial limits tracking |
| `useInterview` | Interview session orchestration |
| `useInterviewLimits` | Interview usage quotas |
| `useMediaQuery` | Responsive media queries |
| `useProgress` | User progress tracking |
| `useReviewCount` | Spaced repetition due count |
| `useSessionPersistence` | Session state persistence (no-op, migrated to AuthProvider) |
| `useSTT` | Speech-to-text integration |
| `useSwipeNavigation` | Mobile swipe gesture navigation |
| `useTTS` | Text-to-speech integration |
| `useVAD` | Voice Activity Detection |
| `useVoiceActivityDetection` | Higher-level VAD composition |

---

## 9. Config Files

| File | Purpose |
|------|---------|
| `src/config/providers.ts` | Provider configuration for TTS/STT/Storage with feature-flag-driven switching |
| `src/config/voice-config.ts` | Voice tuning parameters, localStorage-persisted, runtime-overridable |
| `next.config.ts` | Next.js configuration (PWA, webpack overrides) |
| `vitest.config.ts` | Test configuration with per-module coverage thresholds |
| `eslint.config.mjs` | ESLint flat config |
| `tsconfig.json` | TypeScript strict config with path aliases |
| `vercel.json` | Vercel deployment settings |
| `components.json` | shadcn/ui component configuration |

---

## 10. Testing

**Framework**: Vitest 4.x + @testing-library/react

**Stats**: 880 tests across 105 test files, all passing.

**Coverage thresholds:**
| Module | Lines | Functions |
|--------|-------|-----------|
| `src/lib/assessment/` | 85% | 90% |
| `src/lib/interview/` | 80% | 85% |
| `src/lib/spaced-repetition/` | 85% | 90% |
| `src/lib/rag/` | 75% | 80% |
| `src/lib/recommendations/` | 75% | 80% |
| `src/lib/ai/memory-generator` | 80% | 85% |

**E2E**: Playwright with browser-level testing for voice flows, interview sessions, and auth.

---

## 11. Deployment

- **Platform**: Vercel (optimized for Next.js)
- **Build**: `node scripts/update-sw-version.js && next build`
- **Edge Middleware**: JWT validation, route protection
- **Environment**: Production variables set in Vercel dashboard
- **PWA**: Service worker auto-updated on build via `scripts/update-sw-version.js`
