# **ALGOMIND — DEEP TECHNICAL REFERENCE**
## *For Judges Who Want to Go Beyond the README*

> **Last updated**: March 6, 2026 — Rewritten from live codebase audit against all source files.

---

## **TABLE OF CONTENTS**

1. [Problem Statement & Motivation](#1-problem-statement--motivation)
2. [Application & Target Users](#2-application--target-users)
3. [Voice Pipeline Architecture](#3-voice-pipeline-architecture)
4. [AI Model Routing Deep-Dive](#4-ai-model-routing-deep-dive)
5. [Prompt Engineering System](#5-prompt-engineering-system)
6. [Interview State Machine](#6-interview-state-machine)
7. [Assessment Pipeline Internals](#7-assessment-pipeline-internals)
8. [FSRS-5 Spaced Repetition](#8-fsrs-5-spaced-repetition)
9. [Feature Flag System](#9-feature-flag-system)
10. [Rate Limiting Strategy](#10-rate-limiting-strategy)
11. [Guest Mode Design](#11-guest-mode-design)
12. [Database Schema (29 Tables)](#12-database-schema-29-tables)
13. [Interview Configuration](#13-interview-configuration)
14. [Application Routes & API](#14-application-routes--api)
15. [Employer Assessment Platform](#15-employer-assessment-platform)
16. [Hooks Reference](#16-hooks-reference)
17. [Component Architecture](#17-component-architecture)
18. [Technology Stack](#18-technology-stack)
19. [Performance & Security](#19-performance--security)
20. [Deployment](#20-deployment)
21. [Novelty & Competitive Differentiation](#21-novelty--competitive-differentiation)
22. [Scope to Scale](#22-scope-to-scale)

---

## **1. PROBLEM STATEMENT & MOTIVATION**

**1.5 million engineering graduates** emerge from Indian colleges annually, yet 60% remain unemployed or underemployed within 6 months (NASSCOM, 2024). The crisis is most acute in **Tier 2/3 cities**, where students have technical knowledge but lack:

1. **Communication Skills** — inability to articulate thought processes during technical interviews
2. **Interview Experience** — no access to realistic mock interview practice
3. **Affordable Guidance** — human mock interviews cost ₹2,000+ per session

**Who it impacts:**
- 🎓 900,000+ Tier 2/3 college students with limited placement support
- 💼 300,000+ bootcamp graduates transitioning into tech
- 🔄 300,000+ professionals upskilling for product-based companies
- 🏢 Companies struggling to find interview-ready candidates despite talent surplus

**The opportunity:** GenAI democratizes access to personalized, unlimited interview coaching at **1/1000th the cost** of human alternatives, while maintaining assessment quality through multi-dimensional evaluation.

---

## **2. APPLICATION & TARGET USERS**

**Rajesh**, a final-year B.Tech student from a Tier 3 college in Jharkhand, has solved 200+ LeetCode problems but freezes during campus interviews. He can't afford ₹2,000 mock interviews. Using **AlgoMind**, he:

1. Practices 20+ voice-based mock interviews over 2 weeks (₹40 vs ₹40,000)
2. Gets instant feedback on communication, not just code correctness
3. Identifies his weakness: too many filler words
4. Receives personalized hints when stuck, building problem-solving confidence
5. Downloads detailed reports showing 35% improvement in Communication Clarity
6. **Result**: Lands offer from product-based company (₹12 LPA vs ₹4 LPA service-based)

---

## **3. VOICE PIPELINE ARCHITECTURE**

### **3.1 End-to-End Data Flow**

```
Microphone ──► [VAD] ──► [STT] ──► [useInterview] ──► [Chat API] ──► [TTS] ──► Speaker
                │          │              │                  │             │
          vad-manager  useSTT.ts   state-machine.ts     client.ts    tts-engine.ts
          .ts (ONNX)  (4-tier)    RAG + history       5-tier LLM   Polly→Browser
```

**Target latency:** ~800ms end-to-end (VAD stop → first audio syllable)

### **3.2 VAD — Voice Activity Detection**
**File:** `src/lib/voice/vad-manager.ts`

**Library:** `@ricky0123/vad-web` — Silero ONNX model running entirely in-browser (privacy-first, zero network).

**Loading strategy:** ONNX Runtime and the VAD bundle are injected via `<script>` tags from `/public/vad/` at runtime rather than being bundled. This bypasses Turbopack's 120+ second compilation of WASM/ONNX assets:

```
/public/vad/
  ort.min.js                    # ONNX Runtime (step 1)
  vad-bundle.min.js             # VAD bundle — depends on ort (step 2)
  vad.worklet.bundle.min.js     # AudioWorklet
  silero_vad_v5.onnx            # Model weights
  silero_vad_legacy.onnx        # Legacy model weights
```

**Singleton pattern:** `getVADManager()` returns the single `VADManager` instance per browser context. Five lifecycle states: `IDLE` → `INITIALIZING` → `READY` → `LISTENING` → `DESTROYED`.

**Default configuration** (all tunable via Owner panel → localStorage):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `positiveSpeechThreshold` | `0.7` | Silero confidence to declare speech start |
| `negativeSpeechThreshold` | `0.25` | Confidence below which speech is considered stopped |
| `redemptionMs` | `1500` | Silence tolerance before closing audio segment |
| `minSpeechMs` | `800` | Minimum segment length — filters breath/cough noise |
| `preSpeechPadMs` | `300` | Audio prepended before speech start to avoid clipping |
| `model` | `'legacy'` | Silero model variant (`legacy` = v4, `v5` = newer) |

### **3.3 STT — Speech-to-Text**
**File:** `src/hooks/useSTT.ts`

**4-tier cascade** (attempted in order on init, falls to next on failure):

| Tier | Provider | Notes |
|------|----------|-------|
| `whisper` | Groq Whisper API via `/api/voice/transcribe` | Best accuracy for Indian accents, requires network |
| `browser` | Web Speech API (Chrome/Edge only) | Native, no latency, no network — `SpeechRecognition` |
| `recorder` | MediaRecorder + Whisper API | Firefox/Safari: captures audio blob, sends to Whisper |
| `none` | Disabled | Falls back to text input only |

- Default language: `en-IN` (Indian English)
- Silence timeout: 5000ms (configurable)
- `listeningIntentRef` prevents auto-restart from firing `onSpeechEnd` when user manually stops

### **3.4 TTS — Text-to-Speech**
**Files:** `src/lib/voice/tts-engine.ts` + `src/hooks/useTTS.ts`

**`TTSEngine` class** manages a single `<audio>` element (not Web Audio API's AudioContext) — iOS media volume compatibility requires the standard `<audio>` tag.

**Polly → Browser cascade:**
1. `pollyEnabled` flag read from `/api/flags` once on mount (3s timeout)
2. If enabled: `fetch('/api/voice/synthesize-polly')` → returns MP3 bytes → `<audio>` element
3. If Polly fails or disabled: `window.speechSynthesis.speak()` with best English voice

**AWS Polly specifics** (`src/lib/aws/polly.ts`):
- Voice: **Kajal** (Neural, Indian English) — `engine: 'neural'`
- Fallback voice: **Aditi** (Standard engine)
- Region: `ap-south-1` (Mumbai) for lowest latency
- Sample rate: `22050 Hz`, output: `mp3`

**Race-condition prevention:** Each `speak()` call gets a monotonically-increasing `invId`. A 100ms delay after `cancel()` works around a Chrome bug where `speechSynthesis.speak()` immediately after `cancel()` is silently dropped.

**Engine lifecycle (useTTS hook):** Engine created **once** on mount — never destroyed/recreated mid-session. Voice config changes applied via `engine.setVoiceConfig()` on the existing engine.

### **3.5 TTS Preprocessor**
**File:** `src/lib/voice/tts-preprocessor.ts`

`TTS_REPLACEMENTS` — 80+ `[RegExp, string]` rules applied sequentially:

| Category | Examples |
|----------|---------|
| Big O notation | `O(n²)` → `"O of N squared"`, `O(log n)` → `"O of log N"` |
| DSA acronyms | `DFS` → `"depth-first search"`, `BFS` → `"breadth-first search"`, `DP` → `"dynamic programming"` |
| Operators | `!=` → `"not equal to"`, `>=` → `"greater than or equal to"` |
| Array notation | `arr[i]` → `"arr at index i"` |
| Variable patterns | `i++` → `"i plus plus"` |
| Markdown | `**bold**`, backticks → stripped or spoken naturally |

### **3.6 Interview Orchestration**
**File:** `src/hooks/useInterview.ts`

`useInterview` wires together: `useTTS`, `useSTT`, `useVAD`, `InterviewStateMachine`, and `/api/chat`.

**`MicIntent` state machine** (replaces simple boolean `isMicEnabled`): `off` | `user-on` | `auto-on` | `paused-for-ai`

**Smart pause:** When AI is speaking and VAD detects user speech, `smartPauseTimerRef` fires after a grace period. If user sustains speech, AI is interrupted via `tts.stop()` and mic opens.

**Message lifecycle:** Every message has a stable `id` (`crypto.randomUUID()`), `status` (`complete` | `interrupted` | `cancelled`), and optional `partialContent` / `interruptedAt`.

---

## **4. AI MODEL ROUTING DEEP-DIVE**

### **4.1 Model Tiers**

#### Conversational Layer — Groq (speed-critical)

| Model ID | Tier | RPM | RPD | Context | Role |
|----------|------|-----|-----|---------|------|
| `llama-3.3-70b-versatile` | 1 | 25.5 | 850 | 128K | Primary chat |
| `llama-3.1-8b-instant` | 2 | 25.5 | 12240 | 128K | Ultra-fast hints |
| `meta-llama/llama-4-scout-17b-16e-instruct` | 4 | 25.5 | 850 | 128K | Balanced |
| `moonshotai/kimi-k2-instruct-0905` | 5 | 25.5 | 850 | 200K | Structured output |
| `openai/gpt-oss-120b` | 5 | 25.5 | 850 | 200K | Heavy reasoning |
| `openai/gpt-oss-20b` | 6 | 25.5 | 850 | 200K | Light reasoning |
| `openai/gpt-oss-safeguard-20b` | 99 | 100 | 1000 | 8K | Safety filtering |

#### Assessment Layer — Gemini (accuracy-critical)

| Model ID | Tier | RPM | RPD | Context | Role |
|----------|------|-----|-----|---------|------|
| `gemini-2.5-pro` | 10 | 12.75 | 1275 | 1M | Primary 8-dim scoring |
| `gemini-1.5-pro` | 10 | 2 | 50 | 2M | Fallback analysis |
| `gemini-2.0-flash` | 11 | 10 | 1500 | 1M | Fast analysis |
| `gemini-1.5-flash` | 11 | 15 | 1500 | 1M | Legacy fallback |
| `gemini-2.5-flash` | 12 | 4.25 | 17 | 1M | Cost-optimised |

#### Emergency Fallback — AWS Bedrock
- Default model: `openai.gpt-oss-120b-1:0`
- DB-overridable via `model_routing` table (`provider = 'bedrock'`)
- Auto-detects model family from ID prefix: `anthropic.*` → Claude, `openai.*` → OpenAI format
- Region: `us-east-1` (configurable via `AWS_BEDROCK_REGION`)

#### Embeddings
| Model | Provider | Dimensions |
|-------|----------|------------|
| `gemini-embedding-001` | Gemini | 768 |
| `amazon.titan-embed-text-v2:0` | Bedrock | 1024 |

### **4.2 UnifiedAIClient — 5-Tier Fallback Chain**
**File:** `src/lib/ai/client.ts`

```
Priority 1: AWS Bedrock (if ENABLE_AWS_BEDROCK ON + AWS creds)
     ↓ fail
Priority 2: DB-routed models (model_routing table, Redis-cached 60s, priority ASC)
     ↓ all exhausted
Priority 3: Cross-tier fallback (chat ↔ analysis, via system_config flag)
     ↓ still failing
Priority 4: Emergency static fallback (Groq tier ≤ 5 → Gemini or reverse)
     ↓ absolute last resort
Priority 5: Legacy provider fallback (Gemini ↔ Groq)
```

**Use-case routing:** `options.category === 'intelligence' || 'analysis'` → analysis models; everything else → chat.

### **4.3 Chat API Endpoint**
**File:** `src/app/api/chat/route.ts`

```
POST /api/chat
 ├─ Auth check → 401 if not logged in and not guestMode
 ├─ Rate limit: checkUserRateLimit(userId) → 429
 │  Guest: checkIpRateLimit(ip, { maxRequests: 20, windowSeconds: 3600 })
 ├─ Phase-aware RAG lookup (maps InterviewState → InterviewPhase → supabaseHybridSearch)
 ├─ UnifiedAIClient.generateCompletion(messages, { systemPrompt })
 └─ Response: { response, modelUsed }
```

**Phase-aware RAG** (`src/lib/rag/phase-retriever.ts`): Different knowledge per interview phase:

| Phase | Query Template | Chunks |
|-------|---------------|--------|
| `intro` | `{title}` | 2 |
| `approach` | `{title} algorithm pattern {tags}` | 4 |
| `coding` | `{title} implementation {tag} code` | 3 |
| `testing` | `edge cases testing {tags}` | 2 |
| `complexity` | `time complexity space complexity {title}` | 3 |
| `wrap-up` | `optimal solution {title}` | 3 |

### **4.4 Assessment API Endpoint**
**File:** `src/app/api/interview/analyze/route.ts`

```
POST /api/interview/analyze
 ├─ Body validation: { sessionId, problem, transcript }
 ├─ Minimum transcript: 2 turns
 ├─ CognitiveAnalyzer.analyze(sessionId, problem, transcript) → Gemini
 └─ Response: AssessmentResult (8-dim scores, feedback, hire decision)
```

Assessment runs **server-side only** — API keys unavailable client-side (was root cause of 0-score bug A1).

---

## **5. PROMPT ENGINEERING SYSTEM**

### **5.1 Kai — AI Interviewer Persona**
**File:** `src/lib/interview/interviewer-prompt.ts`

- **VOICE OUTPUT RULES**: No markdown, no asterisks, no stage directions, no `[pause]` tokens
- Anti-answer-giving: Guide through questions, never give solutions directly
- Hint system: 3-tier (subtle → moderate → strong) with diminishing-returns scoring

| Function | Purpose |
|----------|---------|
| `generateSystemPrompt(options)` | Full Kai system prompt with mode, problem, RAG context, Kai memory |
| `generateTurnPrompt(history, userInput, code)` | Per-turn prompt with live code changes |
| `generateInterviewOpeningTrigger()` | First AI message trigger |
| `GUEST_INTRO_TEXT` | Static intro injected before first API call in guest mode |
| `MAX_USER_INPUT` | 2000 chars truncation |

**Mode-specific behaviour:**

| Mode | Key Behaviour |
|------|--------------|
| `warm-up` | Very gentle tone, extra hints, celebrate every attempt |
| `practice` | Standard interview, 3-tier hints |
| `crunch` | Time pressure framing, fewer hints |
| `sprint` | Two-problem framing; `P1_COMPLETE_PROMPT` injected at half-time |
| `employer` | Maximum strictness, zero hints, evaluation-only, no encouragement |

### **5.2 Assessment Prompt**
**File:** `src/lib/assessment/prompts.ts`

`generateAssessmentPrompt(problem, transcript, skillDefinitions)` — sent to Gemini for 8-dim scoring.

| Audit Fix | Description |
|-----------|-------------|
| SA-01 | `overallScore` removed from AI output — computed deterministically |
| SA-02 | Short-session score cap inside prompt so AI evidence matches |
| SA-03 | Bonus dimensions in separate block (10% contribution) |
| AC-03 | All skill keys must be dash-case (camelCase causes silent drops) |

### **5.3 Kai Learn Tutor Prompt**
**File:** `src/lib/learn/system-prompt.ts`

Hinglish tutor persona. DSA terms always in English. Pattern: `'Two-pointer technique — matlab do pointers ek saath use karna'`. References `kaiMemory` for personalised pacing. Adjusts focus based on `userPreviousScore`.

---

## **6. INTERVIEW STATE MACHINE**

**File:** `src/lib/interview/state-machine.ts`

### **States (10)**

| State | Description |
|-------|-------------|
| `idle` | Session not started |
| `problem-intro` | AI introducing the problem |
| `user-thinking` | User explaining approach |
| `ai-clarifying` | AI asking clarifying questions |
| `user-solving` | User walking through solution |
| `ai-feedback` | AI providing hints/feedback |
| `user-coding` | User writing code in Monaco |
| `solution-review` | Final code review discussion |
| `assessment` | AI generating cognitive report |
| `completed` | Session finished (no-op) |

### **Events (10)**

`START` | `USER_FINISHED_SPEAKING` | `AI_FINISHED_SPEAKING` | `MOVE_TO_SOLVING` | `REQUEST_HINT` | `SUBMIT_SOLUTION` | `FINISH_INTERVIEW` | `TERMINATE_INTERVIEW` | `USER_STARTED_CODING` | `USER_SHARED_CODE` | `USER_STOPPED_CODING`

### **Valid Transition Table**

| From | Event | To |
|------|-------|-----|
| `idle` | `START` | `problem-intro` |
| `problem-intro` | `AI_FINISHED_SPEAKING` | `user-thinking` |
| `user-thinking` | `USER_FINISHED_SPEAKING` | `ai-clarifying` |
| `user-thinking` | `MOVE_TO_SOLVING` | `user-solving` |
| `user-thinking` | `TERMINATE_INTERVIEW` | `assessment` |
| `ai-clarifying` | `AI_FINISHED_SPEAKING` | `user-thinking` (loop) |
| `ai-clarifying` | `MOVE_TO_SOLVING` | `user-solving` |
| `ai-clarifying` | `TERMINATE_INTERVIEW` | `assessment` |
| `user-solving` | `USER_FINISHED_SPEAKING` | `ai-feedback` |
| `user-solving` | `SUBMIT_SOLUTION` | `solution-review` |
| `user-solving` | `USER_STARTED_CODING` | `user-coding` |
| `user-solving` | `TERMINATE_INTERVIEW` | `assessment` |
| `ai-feedback` | `AI_FINISHED_SPEAKING` | `user-solving` |
| `ai-feedback` | `SUBMIT_SOLUTION` | `solution-review` |
| `ai-feedback` | `FINISH_INTERVIEW` | `assessment` |
| `ai-feedback` | `USER_STARTED_CODING` | `user-coding` |
| `ai-feedback` | `TERMINATE_INTERVIEW` | `assessment` |
| `user-coding` | `USER_SHARED_CODE` | `ai-feedback` |
| `user-coding` | `USER_STOPPED_CODING` | `user-solving` |
| `user-coding` | `FINISH/TERMINATE` | `assessment` |
| `solution-review` | `FINISH/TERMINATE` | `assessment` |
| `assessment` | `AI_FINISHED_SPEAKING` | `completed` |
| `completed` | *(any)* | `completed` (no-op) |

`TERMINATE_INTERVIEW` = hard stop (time/turn limit). `FINISH_INTERVIEW` = graceful user-initiated end.

---

## **7. ASSESSMENT PIPELINE INTERNALS**

### **7.1 CognitiveAnalyzer Flow**
**File:** `src/lib/assessment/analyzer.ts`

```
analyzer.analyze(sessionId, problem, transcript)
  1. generateAssessmentPrompt(problem, transcript, SKILL_DEFINITIONS)
  2. UnifiedAIClient.generateCompletion(prompt, { category: 'analysis' })
  3. JSON parse + structural validation (fill missing keys with 5)
  4. validateAndCorrectScores() — clamps 0-10
  5. computeWeightedScore(subCriteriaScores, skillId) per skill
  6. computeOverallScore(skills) — weighted avg of 8 dimensions
  7. calculateConfidence(transcript, assessment) — 0-1 reliability
  8. hireDecision: ≥8.0 STRONG_HIRE, ≥6.5 HIRE, ≥5.0 BORDERLINE, ≥3.5 NO_HIRE, <3.5 STRONG_NO_HIRE
  9. Return AssessmentResult
```

### **7.2 The 8 Cognitive Dimensions**
**File:** `src/lib/assessment/skill-registry.ts`

| Dimension | Weight | Sub-criteria |
|-----------|--------|-------------|
| **Problem Decomposition** | 15% | Clarifies Ambiguity (30%), Identifies Subproblems (30%), Defines Interfaces (20%), Handles Dependencies (20%) |
| **Pattern Recognition** | 15% | Names Pattern (30%), Justifies Fit (30%), Without Prompting (25%), Generalises to Variants (15%) |
| **Algorithmic Thinking** | 15% | Proposes Working Algo (35%), Avoids Flawed Approach (20%), Articulates Steps (25%), Considers Alternatives (20%) |
| **Complexity Analysis** | 12% | Correct Time (30%), Correct Space (20%), Explains Reasoning (30%), Handles Recursion/Amortised (20%) |
| **Communication Clarity** | 12% | Thinks Aloud (35%), Correct Terminology (25%), Checks Understanding (20%), Structured Explanation (20%) |
| **Edge Case Awareness** | 10% | Empty Input (20%), Single Element (20%), Duplicates/Overflow (25%), Logic-Specific Cases (35%) |
| **Optimization Mindset** | 11% | States Brute Force (20%), Recognises Opportunity (25%), Articulates Tradeoff (30%), Implements/Explains (25%) |
| **Debugging Approach** | 10% | Traces Manually (30%), Isolates Failing Case (25%), Forms Hypothesis (30%), Verifies Fix (15%) |

### **7.3 Evidence Extractor**
**File:** `src/lib/assessment/evidence-extractor.ts`

`extractEvidence(transcript, skill)` — keyword-pattern helper that backs scores with transcript quotes. Per-skill keyword dictionaries (e.g. pattern-recognition: dynamic programming, hash map, two pointers, sliding window). Returns up to 3 relevant turns per skill.

### **7.4 Confidence Calculator**
**File:** `src/lib/assessment/confidence-calculator.ts`

`confidence = min(turns/10, 0.4) + min(words/500, 0.3) + (skillsWithEvidence/8) × 0.3`

Short sessions (<5 turns) score ≤0.2. This cap is communicated to the prompt (SA-02).

### **7.5 Key Moments Extractor**
**File:** `src/lib/assessment/key-moments.ts`

AI-powered extraction of 5-7 turning points per session: `approach_identified`, `optimization_transition`, `self_correction`, `complexity_explained`, `impressive_statement`, `missed_opportunity`, `stuck_point`. Each has a 60-char quote, significance sentence, cognitive dimension, and sentiment. Cached in `assessments.skill_evidence`.

---

## **8. FSRS-5 SPACED REPETITION**

### **8.1 Algorithm Configuration**
**File:** `src/lib/spaced-repetition/fsrs.ts`

Uses `ts-fsrs` v5.2.3:
- `request_retention: 0.85` (85% target recall)
- `maximum_interval: 180` days
- `enable_fuzz: true` (prevents review clustering)
- 17 FSRS-5 default weights (trained on 20k+ learners)

**Score → FSRS Rating:** 0-3 → Again, 4-5 → Hard, 6-7 → Good, 8-10 → Easy

### **8.2 Review Queue**
**File:** `src/lib/spaced-repetition/queue.ts`

`addToQueue()` called after every session: upserts `spaced_repetition` table with both FSRS and SM-2 fields for backward compatibility. `use_fsrs` boolean selects scheduler.

### **8.3 Skill-Level Scheduler**
**File:** `src/lib/spaced-repetition/skill-scheduler.ts`

`getDueSkills(userId)` queries `skill_repetition` for overdue skills. Maps skills → problem tags:

| Skill | Suggested Tags |
|-------|---------------|
| `problem-decomposition` | recursion, trees, graphs, backtracking, divide-and-conquer |
| `pattern-recognition` | sliding-window, two-pointer, hashing, prefix-sum |
| `algorithmic-thinking` | sorting, greedy, binary-search, intervals |
| `complexity-analysis` | recursion, dynamic-programming, graphs, trees |
| `edge-case-awareness` | arrays, strings, math, bit-manipulation |
| `optimization-mindset` | dynamic-programming, heap, greedy, memoization |
| `debugging-approach` | arrays, strings, linked-list, pointers |
| `communication-clarity` | arrays, recursion, strings |

---

## **9. FEATURE FLAG SYSTEM**

### **9.1 Architecture**

```
Client read:   localStorage.getItem(storageKey) → compiled default
Server read:   Redis (5 min TTL) → Supabase global_feature_flags → compiled default
Admin write:   POST /api/flags → setGlobalFeatureFlag() → Redis invalidation + DB write
```

**Files:** `src/lib/feature-flags.ts` (client), `src/lib/feature-flags-server.ts` (server), `src/app/api/flags/route.ts`

### **9.2 Full Flag Reference**

| Key | Default | Description |
|-----|---------|-------------|
| `ENABLE_VAD_INTERRUPTIONS` | `true` | Silero VAD for natural user interruptions |
| `ENABLE_SMART_ROUTING` | `true` | Route simple → Groq, complex → Gemini |
| `ENABLE_CHUNKED_RESPONSES` | `true` | Stream responses sentence-by-sentence |
| `ENABLE_RESPONSE_CACHE` | `false` | In-memory response caching (disabled for serverless) |
| `ENABLE_HINGLISH_SUPPORT` | `true` | Hinglish interview option |
| `ENABLE_SILENT_OBSERVER` | `true` | Real-time coaching nudges |
| `ENABLE_WHISPER_STT` | `true` | Groq Whisper STT |
| `ENABLE_AWS_BEDROCK` | `false` | Bedrock as primary AI |
| `ENABLE_AWS_POLLY_TTS` | `false` | Kajal Neural TTS |
| `ENABLE_GUEST_POLLY_TTS` | `false` | Polly for guests |
| `ENABLE_AWS_TRANSCRIBE_STT` | `false` | Post-interview batch transcription |
| `ENABLE_AWS_S3_STORAGE` | `false` | S3 for Transcribe audio staging |
| `ENABLE_LEARN_MODE` | `false` | Hinglish AI tutor mode |
| `ENABLE_COMPARATIVE_ANALYSIS` | `true` | Side-by-side on problem retry |
| `ENABLE_DIFFICULTY_MODES` | `true` | Warm-Up / Practice / Crunch / Sprint |

### **9.3 Server-Side Resolution**

`getGlobalFeatureFlag(key)`: Redis → Supabase → compiled default. **Fails open** (returns default) on DB unavailable to avoid breaking live interviews.

`GET /api/flags`: Public, rate-limited 60/min per IP. `POST /api/flags`: Admin-only, validates key, writes DB + invalidates Redis, audit-logs to `system_events`.

---

## **10. RATE LIMITING STRATEGY**

### **10.1 User Rate Limiter**
**File:** `src/lib/rate-limit/user-rate-limiter.ts`

**Current (hackathon mode):** `HACKATHON_UNLIMITED = true` — returns `{ allowed: true, remaining: 9999 }` for all.

**Production logic:** Owner/co-owner → unlimited. Admin → unlimited. Others: `check_user_rate_limit(userId, profile.rate_limit_override ?? 30)` RPC. If RPC missing (`PGRST202`), **fails CLOSED** (blocks). If Supabase unavailable → localStorage daily limit fallback.

### **10.2 IP Rate Limiter**
**File:** `src/lib/rate-limit/ip-rate-limiter.ts`

`checkIpRateLimit(ip, { maxRequests, windowSeconds, endpoint? })` via `check_code_rate_limit` DB function.

| Endpoint | Limit |
|----------|-------|
| `GET /api/flags` | 60/min |
| `POST /api/chat` (guest) | 20/hour |

**Fails open** on DB error to prevent total traffic blocking.

---

## **11. GUEST MODE DESIGN**

### **11.1 Guest Problems**
**File:** `src/lib/guest/guest-problems.ts`

5 classic DSA problems embedded in the client bundle (zero DB call):

| ID | Title | Difficulty | Pattern |
|----|-------|------------|---------|
| `guest-two-sum` | Two Sum | Easy | Hash Map |
| `guest-valid-parentheses` | Valid Parentheses | Easy | Stack |
| `guest-reverse-linked-list` | Reverse Linked List | Easy | Pointers |
| `guest-binary-search` | Binary Search | Easy | Divide and Conquer |
| `guest-max-subarray` | Maximum Subarray | Medium | Kadane / DP |

Each includes pre-embedded `ragContext` — zero embedding API calls needed.

### **11.2 Guest Configuration**
From `resolveGuestConfig()`: mode `'guest'`, difficultyMode `'practice'`, `maxDurationMs: 120 * 60_000` (2 hours), `maxTurnsPerProblem: 999`, `isUnlimited: true`.

### **11.3 Demo Mode Manager**
**File:** `src/lib/demo/manager.ts`

`isDemoMode()` / `enableDemoMode()` / `disableDemoMode()` manage localStorage + `algomind_demo_mode` cookie (SSR middleware reads). `getDemoProgress()` returns 12 pre-computed demo sessions showing skill progression with seeded-random to prevent chart flicker.

---

## **12. DATABASE SCHEMA (29 TABLES)**

All tables in `public` schema on Supabase PostgreSQL 17.6 with pgvector.

### **Core Interview**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles | `id` (FK→auth.users), `email`, `account_type` (candidate/employer/admin/owner), `rate_limit_override`, `is_suspended` |
| `interview_sessions` | Interview records | `user_id`, `problem_id`, `status`, `transcript` (JSONB), `overall_score`, `difficulty_mode`, `sprint_problem_ids`, `raw_score`, `adjusted_score` |
| `assessments` | 8-dim scores | `session_id`, 8 dimension columns (numeric 4,2), `skill_evidence` (JSONB), `hire_decision`, `sub_criteria` (JSONB), `code_quality` (JSONB) |
| `problems` | 480+ DSA problems | `id` (slug PK), `title`, `difficulty`, `tags` (text[]), `hints` (text[]), `curated_lists` (text[]), `primary_pattern` |

### **Spaced Repetition**
| Table | Purpose |
|-------|---------|
| `spaced_repetition` | Per-problem FSRS-5 + SM-2 scheduling |
| `skill_repetition` | Per-skill FSRS (8 cognitive dimensions) |

### **AI Infrastructure**
| Table | Purpose |
|-------|---------|
| `ai_models` | Model catalog with pricing |
| `model_routing` | DB-driven routing (provider, use_case, priority) |
| `model_registry` | Full catalog with rate limits |
| `model_performance_logs` | Latency + cost tracking |
| `system_config` | Key-value settings (`cross_tier_fallback_enabled`) |
| `global_feature_flags` | Server-side flags |
| `system_events` | Audit + error log |

### **RAG & Knowledge**
| Table | Purpose |
|-------|---------|
| `knowledge_chunks` | pgvector 768-dim embeddings |
| `knowledge_gaps` | User gap tracking for RAG improvement |

### **User Experience**
| Table | Purpose |
|-------|---------|
| `learner_profiles` | Kai AI memory + hire readiness trend |
| `user_preferences` | Voice + theme + LeetCode |
| `leetcode_profiles` | Synced LeetCode stats |
| `insight_snapshots` | Cached dashboard insights |
| `session_replays` | Shareable replays |
| `user_daily_usage` | Daily question counter |

### **Employer / Enterprise**
| Table | Purpose |
|-------|---------|
| `assessment_campaigns` | Hiring campaigns with entry codes |
| `candidate_submissions` | Per-candidate assessment state |
| `company_profiles` | Employer branding |
| `code_attempts` | Entry code rate limiting |
| `employer_invites` | Onboarding invite codes |

### **Access Control / Analytics**
| Table | Purpose |
|-------|---------|
| `admin_users` | Admin registry |
| `co_owners` | Co-owner access |
| `score_benchmarks` | Percentile benchmarks per skill+difficulty |

### **Key Database Functions (31)**

`handle_new_user()` | `check_user_rate_limit()` | `check_code_rate_limit()` | `check_is_admin()` | `claim_campaign_slot()` | `compute_adjusted_score()` | `generate_campaign_entry_code()` | `get_user_sessions_with_assessment()` | `get_user_progress()` | `get_due_reviews()` | `get_random_problem()` | `get_model_rate_stats()` | `get_my_permissions()` | `is_owner()` | `is_admin()` | `match_knowledge_chunks()` | `mark_submission_dropped()` | `record_code_attempt()` | `record_user_question()` | `save_question_progress()` | `verify_campaign_entry_code()` | `expire_stale_submissions()` | `cleanup_old_events()` | `ensure_learner_profile()` | `increment_view_count()` | `get_system_health()` | `get_admin_analytics()` | `sync_account_type_to_jwt()` | `sync_admin_to_profile()` | `link_co_owner_user_id()` | `rls_auto_enable()`

### **Extensions**
`pgvector`, `pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_graphql`

---

## **13. INTERVIEW CONFIGURATION**

**File:** `src/lib/interview/interview-config.ts`

| Mode | Duration | Turns/Problem | Problems | Description |
|------|----------|--------------|----------|-------------|
| **Warm-up** | 20 min | 15 | 1 | Gentle introduction |
| **Practice** | 30 min | 20 | 1 | Standard preparation |
| **Crunch** | 25 min | 12 | 1 | Time-pressured |
| **Sprint** | 45 min | 10 per problem | 2 | Two-problem sprint (half-time transition) |

**Hackathon mode:** All limits disabled — `isUnlimited = true`, 120 min, 999 turns.

---

## **14. APPLICATION ROUTES & API**

### **User-Facing Pages**

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | OAuth (Google/GitHub), email, magic link |
| `/dashboard` | Stats, radar chart, history, insights |
| `/practice` | Problem selection + difficulty mode |
| `/interview` | Live voice interview |
| `/interview/analysis` | Post-interview 8-dim analysis + PDF |
| `/settings` | Voice config, LeetCode, preferences |
| `/learn` | AI tutor mode (Hinglish) |
| `/replay/[token]` | Shareable interview replay |
| `/admin` | Admin dashboard |
| `/owner` | Owner super-admin panel |
| `/employer/dashboard` | Campaign management |
| `/assess/[token]` | Candidate assessment |

### **API Routes (~54 handlers across 18 domains)**

**Core:** `/api/chat` POST, `/api/execute` POST, `/api/interview/analyze` POST

**Voice:** `/api/voice/transcribe` POST, `/api/voice/transcribe-batch` POST+GET, `/api/voice/synthesize-polly` POST

**RAG:** `/api/rag/search` POST, `/api/rag/context` POST

**Flags:** `/api/flags` GET (public) + POST (admin)

**Employer:** `/api/assess/*` (start, chat, complete, verify-code), `/api/employer/campaigns/*`, `/api/employer/submissions/*`

**Admin/Owner:** `/api/admin/models` CRUD, `/api/owner/model-routing` CRUD, `/api/owner/co-owners`, `/api/owner/flags`

---

## **15. EMPLOYER ASSESSMENT PLATFORM**

End-to-end hiring assessment system enabling employers to create multi-question campaigns, distribute them via entry codes, and rank candidates across 8 cognitive dimensions.

### **15.1 Architecture Overview**

```
Employer creates campaign → Entry code + public link generated
                          ↓
Candidate enters code → verify-code RPC (rate-limited) → start session (JWT signed)
                          ↓
Per-question interview (employer mode: zero hints, max strictness)
                          ↓
Complete → CognitiveAnalyzer runs per-question → weighted-average 8-dim scores
                          ↓
Employer views ranked submissions → radar comparison → transcript viewer → CSV export
```

### **15.2 Campaign Creation**

**Component:** `CreateCampaignModal` — 2-step wizard

| Step | UI | Details |
|------|-----|---------|
| **1: Select Questions** | Title input, searchable problem picker, drag reorder | 1–3 questions per campaign; includes "Random Easy/Medium/Hard" synthetic options |
| **2: Adjust Timing** | Per-question time editors, global timing defaults | 5–120 min per question, total ≤ 360 min; advanced panel for default Easy/Medium/Hard times |

**Settings:** Link expiry (datetime picker), max uses, "Show score to candidate" toggle.

**API:** `POST /api/employer/campaigns`
- Validates title (5–100 chars), 1–3 questions, per-question time (5–120 min), total time (≤ 360 min)
- Generates unique entry code via `supabase.rpc('generate_campaign_entry_code')`
- Inserts `assessment_campaigns` row with `campaign_questions` JSONB array
- Returns campaign with entry code + public token

**Post-creation:** Success modal displays entry code (large monospace + copy) and assessment link (copyable). Candidates need both to start.

### **15.3 Candidate Assessment Flow**

| Step | API Endpoint | Key Logic |
|------|-------------|-----------|
| **Verify code** | `POST /api/assess/verify-code` | IP rate limit (5 attempts/2 min via RPC), `ENTRY_CODE_REGEX` validation, timing-attack prevention (records failure *before* verification), returns campaign + question details |
| **Start session** | `POST /api/assess/start` | Re-verifies code server-side, rate limit (5/10 min), checks for resumable in-progress submission, atomic slot claim via `claim_campaign_slot` RPC, resolves random problem IDs, signs JWT (HMAC-SHA256) with submission ID + campaign ID |
| **Interview** | `POST /api/assess/chat` | Employer interview mode — zero hints, maximum strictness, evaluation-only prompts. Per-question state tracking with individual time limits |
| **Complete** | `POST /api/assess/complete` | JWT verification, runs `CognitiveAnalyzer.analyze()` per question (50s timeout), weighted-average across 8 skills (weighted by elapsed time), graceful degradation on timeout (`analysis_status: 'pending_retry'`), inserts `interview_sessions` + `assessments` rows |

**Security:** Entry code rate limiting, JWT session auth, atomic slot claiming, input sanitization, timing-attack prevention, service-role client for cross-user writes.

### **15.4 Employer Dashboard**

**Server component:** `employer/dashboard/page.tsx` — RSC with `requireEmployer()` guard, prefetches campaigns + problems + submission counts in parallel via `Promise.all`.

**Client component:** `EmployerDashboard` — two-tab interface:

#### Campaigns Tab
Grid of campaign cards showing:
- Title, status badge (Active / Deactivated / Expired / Full), completed count
- Questions & total time, entry code with copy button
- Actions: View Results, Copy Assessment Link, Deactivate, Delete (with confirmation dialogs)

#### Submissions Ranking Tab
- **`CohortStatsPanel`** — aggregate statistics across all submissions
- **Campaign selector** dropdown + **status filter** pills (`All`, `Completed`, `In Progress`, `Dropped Out`, `Expired`) with live counts
- **Ranked data table** — columns: Compare checkbox, Rank, Status (animated "In Progress" with active timer), Candidate, Overall score, 8 individual skill scores (color-coded: green ≥ 7, amber ≥ 4, red < 4), Hire Decision, Integrity Flags, Details
- **Sortable** by any score column
- **CSV export** via blob download with `Content-Disposition` filename parsing

#### Submission Detail Side Panel
Slides in from right showing:
- Candidate info, status, overall score, start/last-active timestamps
- `RadarChart` 8-dim skill breakdown
- Overall feedback text
- Per-question breakdown with transcript preview
- "Launch Full Transcript Viewer" button
- Print/PDF button

#### 2-Candidate Radar Comparison
Select exactly 2 candidates → overlay `RadarChart` with both skill profiles side-by-side.

#### Transcript Viewer
`CandidateTranscriptViewer` — full-screen modal with:
- Per-question sticky section headers (title, time spent/limit, status)
- Chat-bubble transcript layout (user right/indigo, AI left/dark)
- System messages filtered out (hidden from employer view)

### **15.5 Database Tables**

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `assessment_campaigns` | `created_by`, `title`, `campaign_questions` (JSONB), `entry_code`, `public_token`, `time_limit_mins` (5–360), `expires_at`, `max_uses`, `is_active`, `show_score_to_candidate` | Campaign configuration |
| `candidate_submissions` | `campaign_id`, `candidate_name`, `candidate_email`, `status` (in_progress/completed/dropped_out/expired), `overall_score`, `question_states` (JSONB), `integrity_flags`, `started_at`, `completed_at` | Per-candidate assessment state |
| `company_profiles` | `employer_id`, `company_name`, `logo_url` | Employer branding |
| `code_attempts` | `ip_address`, `attempted_at`, `was_valid` | Entry code rate limiting |
| `employer_invites` | `invite_code`, `employer_id` | Onboarding invites |

### **15.6 API Routes Summary**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/employer/campaigns` | GET | Employer | Paginated campaign list with submission counts |
| `/api/employer/campaigns` | POST | Employer | Create campaign (entry code generation) |
| `/api/employer/campaigns/[id]` | DELETE | Employer | Deactivate or permanently delete |
| `/api/employer/submissions/[campaignId]` | GET | Employer | Ranked submissions with status filter |
| `/api/employer/submissions/[campaignId]/report/[submissionId]` | GET | Employer | Full candidate report with transcript |
| `/api/employer/submissions/[campaignId]/export` | GET | Employer | CSV export |
| `/api/assess/verify-code` | POST | Public | Rate-limited entry code verification |
| `/api/assess/start` | POST | Public | Start assessment session (JWT issued) |
| `/api/assess/chat` | POST | JWT | Interview turn (employer mode) |
| `/api/assess/complete` | POST | JWT | Complete + run 8-dim analysis |

---

## **16. HOOKS REFERENCE**

| Hook | Purpose |
|------|---------|
| `useInterview` | Core orchestration (messages, AI, state machine, limits) |
| `useSTT` | 4-tier STT cascade |
| `useTTS` | Polly/browser TTS with preprocessor |
| `useVAD` | Low-level VAD events |
| `useVoiceActivityDetection` | Higher-level VAD + interruption |
| `useInterviewLimits` | Time/turn limits, sprint `isHalfTime` |
| `useGlobalFeatureFlag` | Server-side flags with visibility-aware polling |
| `useFeatureFlag` | Client-side flag from localStorage |
| `useAssessment` | Employer assessment state |
| `useGuestSession` | Guest interview state |
| `useGuestTrial` | Guest trial tracking |
| `useAdmin` | Admin role detection |
| `useProgress` | Practice progress |
| `useReviewCount` | FSRS due count |
| `useSwipeNavigation` | Mobile swipe gestures |
| `useMediaQuery` | Responsive breakpoints |

---

## **17. COMPONENT ARCHITECTURE**

| Directory | Key Components |
|-----------|---------------|
| `interview/` | `InterviewSession`, `CodeEditor` (Monaco), `ConversationView`, `VoiceOnboarding`, `SilentObserverNudge`, `InterviewLimitBar`, `InterruptionIndicator` |
| `analysis/` | `AnalysisClient`, `ExportReportButton` |
| `charts/` | `RadarChart`, `SkillDrillDown` |
| `dashboard/` | `InsightsPanel`, `ReviewQueueWidget`, `SessionTimeline`, `HireReadinessTrend`, `PDFReport` |
| `enterprise/` | `EmployerDashboard`, `CreateCampaignModal`, `CandidateTranscriptViewer` |
| `auth/` | `AuthProvider`, `ProtectedRoute`, `UserButton` |
| `voice/` | `MicPulse`, `MicrophoneButton`, `SpeakerControls` |
| `ui/` | 21 shadcn/radix primitives |

---

## **18. TECHNOLOGY STACK**

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.1.6, React 19.2.3, Monaco Editor 4.7.0, Radix UI 1.4.3, Framer Motion 12, Recharts 3.7.0 |
| **Backend** | Next.js Server Actions + API Routes, Edge Middleware, @tanstack/react-query |
| **AI/ML** | Groq (Llama 4/3.3/3.1, Kimi K2, GPT-OSS), Gemini (2.5 Pro, 2.5/2.0/1.5 Flash), AWS Bedrock |
| **Voice** | Silero VAD (ONNX Runtime Web), Groq Whisper (STT), AWS Polly Neural Kajal (TTS) |
| **Database** | Supabase PostgreSQL 17.6 + RLS + Auth (29 tables), Upstash Redis, pgvector |
| **Spaced Rep** | ts-fsrs 5.2.3 (FSRS-5), SM-2 backward compat |
| **PDF** | @react-pdf/renderer 4.3.2 |
| **DevOps** | Vercel, Vitest 4.x (880 tests), Playwright, ESLint, PWA |
| **Auth** | Supabase Auth (Google/GitHub OAuth, email, magic link with PKCE) |

---

## **19. PERFORMANCE & SECURITY**

### **Performance**
- ~800ms voice-to-voice latency
- Edge Middleware JWT decode — no cold start penalty
- Redis 60s ModelRouting cache
- Script-tag VAD loading (bypasses Turbopack 120s+ WASM)
- Visibility-aware flag polling
- PWA service worker with auto-versioning
- Single `<audio>` element for iOS compat

### **Security**
- RLS on all 29 tables
- `rls_auto_enable()` trigger on new tables
- `protect_master_admin()` trigger
- Rate limiter fails CLOSED on missing RPC
- `MAX_USER_INPUT = 2000` chars truncation
- JWT PKCE on OAuth; separate JWT secret from service role key
- Code runs in Monaco browser sandbox only

---

## **20. DEPLOYMENT**

### **Environment Variables**

```bash
# Critical
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# High (graceful degradation)
GROQ_API_KEY=
GEMINI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_APP_URL=

# Operational
CRON_SECRET=
PISTON_URL=
AWS_BEDROCK_REGION=us-east-1
```

### **Build**

```bash
npm install
npm run build    # node scripts/update-sw-version.js && next build
npm run test     # 880 Vitest tests
npm run type-check
npm run lint
```

---

## **21. NOVELTY & COMPETITIVE DIFFERENTIATION**

| Competitor | Limitation | AlgoMind Advantage |
|------------|-----------|-------------------|
| LeetCode | Code-only | Voice-first + communication scoring |
| Pramp | ₹2,000/session | ₹2/session, 24/7 |
| ChatGPT | Text-only | 8-dimensional scoring + FSRS |
| Human mock | /hour | 1,500x cheaper, unlimited |

**Technical Innovations:**
1. **Multi-Model Orchestration**: 12+ models, 5-tier fallback, DB-driven routing
2. **Indian Accent Optimisation**: en-IN STT, Kajal Neural TTS, Hinglish mode
3. **8-Dimensional Rubric**: Sub-criteria weights + AI evidence citation
4. **80+ TTS Preprocessing Rules**: `O(n²)` → natural speech
5. **ONNX VAD via Script Tags**: Bypasses Turbopack 120s+ WASM compilation
6. **Dual-Level FSRS-5**: Problem-level + skill-level scheduling
7. **Phase-Aware RAG**: 6 retrieval strategies per interview phase
8. **Sprint Mode**: Two-problem interview with half-time, shared timer
9. **Employer Assessment**: Zero-hint evaluation, entry codes, candidate pipeline

---

## **22. SCOPE TO SCALE**

**Phase 1 (Current):** DSA Interview Coach ✅ — voice-first, 480+ problems, 8-dim scoring, FSRS-5, Sprint mode, Employer mode

**Phase 2:** Resume + JD Intelligence — AI skill gap analysis, personalised mock generation

**Phase 3:** Multi-Domain — SQL, System Design, Core CS, Behavioural (STAR)

**Phase 4:** Full Career Platform — salary negotiation, company-specific prep, job matching

**Business Model:** ₹2/interview (70% gross margin), ₹49-99/month subscriptions, ₹10,000/year institutional
