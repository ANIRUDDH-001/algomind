# AlgoMind — Master Remediation & Migration Plan

> **Last updated:** June 2025  
> **Principle:** Everything works perfectly on Vercel FIRST → then migrate to AWS.  
> **Execution order:** Phase 1 (Critical Fixes) → Phase 2 (UI Polish) → Phase 3 (Prompt & AI Hardening) → Phase 4 (Testing & QA) → Phase 5 (AWS Migration)

---

## Table of Contents

1. [Bug Summary & Root Causes](#1-bug-summary--root-causes)
2. [Prompt File Reference](#2-prompt-file-reference)
3. [Schema Reference (29 tables)](#3-schema-reference-29-tables)
4. [Feature Flag Inventory](#4-feature-flag-inventory)
5. [Phase 1 — Critical Fixes (Vercel)](#5-phase-1--critical-fixes-vercel)
6. [Phase 2 — UI Polish & Loading States](#6-phase-2--ui-polish--loading-states)
7. [Phase 3 — Prompt & AI Hardening](#7-phase-3--prompt--ai-hardening)
8. [Phase 4 — Testing & QA Matrix](#8-phase-4--testing--qa-matrix)
9. [Phase 5 — AWS Migration](#9-phase-5--aws-migration)
10. [Schema Additions Required](#10-schema-additions-required)
11. [Feature ↔ Code Mapping](#11-feature--code-mapping)
12. [Component Architecture Map](#12-component-architecture-map)
13. [API Route Inventory (50 endpoints)](#13-api-route-inventory-50-endpoints)
14. [Priority Execution Table](#14-priority-execution-table)
15. [Verification Checklist](#15-verification-checklist)

---

## 1. Bug Summary & Root Causes

| # | Bug | Severity | Root Cause | File(s) |
|---|-----|----------|------------|---------|
| A1 | All assessment scores = 0 | **CRITICAL** | `useAssessment.ts` runs `CognitiveAnalyzer` CLIENT-SIDE in browser where API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`) are `undefined`. All AI models fail → fallback returns 0. | `src/hooks/useAssessment.ts` → `src/lib/assessment/analyzer.ts` → `src/lib/ai/client.ts` |
| A2 | Kai hallucinating understanding | **HIGH** | Interviewer prompt has no coherence validation. When user says gibberish ("asdfgh"), Kai responds positively ("Great approach!") because the prompt only handles engagement patterns, not input quality. | `src/lib/interview/interviewer-prompt.ts` (lines 163-184) |
| A3 | Polly TTS 502 errors | **MEDIUM** | AWS SDK `SynthesizeSpeechCommand` fails; error details are swallowed by generic catch. Could be IAM permissions, wrong region, or Kajal voice unavailable. | `src/lib/aws/polly.ts`, `src/app/api/voice/synthesize-polly/route.ts` |
| A4 | Duplicate transcript display | **MEDIUM** | `InterviewSession.tsx` has TWO transcript areas: compact preview (L754-767) AND `ZoomTranscript` (L833-856). Both show `lastAiMessage`. | `src/components/interview/InterviewSession.tsx` |
| A5 | Two separate analysis screens | **MEDIUM** | After interview: `ReportCard` shows as full-screen overlay (L599 in InterviewSession.tsx) AND `/interview/analysis` has `AnalysisClient` as a full page. User sees two different UIs for the same data. | `src/components/assessment/ReportCard.tsx`, `src/components/analysis/AnalysisClient.tsx` |
| A6 | `co_owners` 403 RLS error | **LOW** | Client-side query to `co_owners` table hits restrictive RLS. Policy only allows co-owner to read their own record by `user_id` or `email`, but the query may be using wrong filter. | `src/app/interview/page.tsx`, `src/lib/rate-limit/user-rate-limiter.ts` |
| A7 | No loading animations | **LOW-MED** | Zero `loading.tsx` files in the entire `src/app/` directory. Next.js shows blank white during route transitions and SSR data fetching. | Missing files across `src/app/` |

---

## 2. Prompt File Reference

### The 3 prompt files you need to know:

| File | Purpose | What it controls |
|------|---------|------------------|
| **`src/lib/interview/interviewer-prompt.ts`** (443 lines) | **THE main prompt file** — generates Kai's system prompt, turn prompts, feedback prompts, and assessment extraction prompts. | Kai's personality, interview phases (intro → approach → coding → testing → complexity → wrap-up), hint protocol (3 levels), scoring rubric (1-10), adaptive behavior, memory integration, mode-specific behavior (warm-up/practice/crunch/sprint), hire decision criteria |
| **`src/lib/interview/prompts.ts`** (142 lines) | **Turn prompt orchestrator** — maps state machine states to interview phases, builds context per turn. | Calls `generateInterviewerSystemPrompt()` and `generateTurnPrompt()` from above. Adds difficulty mode overlays. This is the bridge between state machine and prompt. |
| **`src/lib/assessment/prompts.ts`** (121 lines) | **Assessment prompt** — generates the JSON-structured scoring prompt for CognitiveAnalyzer. | 8 cognitive dimensions with sub-criteria weights, rubric levels 1-5, difficulty calibration, code quality analysis, hire decision, strictness gates. |

### Key functions in `interviewer-prompt.ts`:

| Function | Lines | What it generates |
|----------|-------|-------------------|
| `generateInterviewerSystemPrompt(config)` | 63-266 | Full system prompt with: role definition, critical principles, problem context, 5 interview phases, candidate response patterns, scoring rubric (1-10 strict), feedback structure, communication style, adaptive behavior, Kai memory injection |
| `generateTurnPrompt(phase, userMessage, context)` | 272-325 | Phase-specific instructions (intro/approach/coding/testing/complexity/wrap-up) with user's latest message embedded |
| `generateFeedbackPrompt(history, problem, ...)` | 333-413 | Final interview feedback in JSON format: 8 dimension scores with evidence, strengths, improvements, hire decision, technical deep dive (optimal solution, complexities, key insight) |
| `generateAssessmentExtractionPrompt(history, problem)` | 419-443 | Simplified assessment extraction (8 scores + summary + recommendations) |

### Where to add coherence validation (A2 fix):

In `generateInterviewerSystemPrompt()`, after the `CANDIDATE RESPONSE PATTERNS` section (line ~190), add a new pattern:

```
### 🟣 INCOHERENT / GIBBERISH INPUT:
If the candidate's message is gibberish, random characters, or clearly not a technical response:
Response: "I didn't quite catch a technical concept there. Could you try explaining your approach in more detail?"
NEVER pretend to understand nonsensical input. NEVER say "Great approach!" to gibberish.
Score: Cap ALL dimensions at 2 for that exchange.
```

---

## 3. Schema Reference (29 tables)

All tables live in `public` schema. All have RLS ENABLED. Full dump at `schema details/supabase_schema.sql`.

### Core Interview Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `interview_sessions` | `id`, `user_id`, `problem_id`, `problem_title`, `problem_difficulty`, `status` (in_progress/completed/abandoned), `transcript` jsonb, `feedback` jsonb, `overall_score`, `difficulty_mode`, `raw_score`, `adjusted_score` | Every interview session |
| `assessments` | `id`, `session_id`, 8 cognitive score columns (numeric 4,2), `overall_score`, `skill_evidence` jsonb, `overall_feedback`, `next_steps[]`, `model_used`, `confidence`, `sub_criteria` jsonb, `hire_decision`, `code_quality` jsonb, `validation_pass_done` | Post-interview analysis results |
| `problems` | `id`, `title`, `description`, `difficulty`, `tags[]`, `hints[]`, `examples` jsonb, `constraints`, `time_complexity`, `space_complexity`, `primary_pattern` | Problem bank |

### User/Profile Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `profiles` | `id` (= auth.uid), `email`, `full_name`, `account_type` (candidate/employer/admin/owner), `company_name`, `is_suspended` | User profiles |
| `learner_profiles` | `user_id`, `kai_memory` text, `kai_memory_structured` jsonb, `narrative`, `hire_readiness_trend` jsonb, `current_streak`, `longest_streak` | Kai's memory of each student |
| `user_preferences` | `user_id`, voice settings, `theme`, `show_onboarding`, `leetcode_username` | User settings |
| `user_daily_usage` | `user_id`, `date`, `questions_used` | Rate limiting |
| `leetcode_profiles` | `user_id`, `username`, `total_solved`, `easy_solved`, `medium_solved`, `hard_solved`, `ranking`, `contest_rating` | LeetCode integration |

### Employer/Assessment Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `assessment_campaigns` | `id`, `created_by`, `title`, `problem_id`, `time_limit_mins`, `expires_at`, `max_uses`, `public_token`, `entry_code`, `difficulty` | Employer campaigns |
| `candidate_submissions` | `id`, `campaign_id`, `session_id`, `candidate_name/email`, `status`, `overall_score`, `dimension_scores` jsonb, `hire_decision`, `integrity_flags[]`, `analysis_status` | Candidate takes employer assessment |
| `employer_invites` | `id`, `invite_code`, `email`, `company_name`, `expires_at`, `is_active` | Employer invitation system |

### AI/Knowledge Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `knowledge_chunks` | `id`, `topic`, `subtopic`, `content`, `keywords[]`, `embedding` vector(768), `effectiveness_score` | RAG knowledge base |
| `knowledge_gaps` | `id`, `user_id`, `user_query`, `gap_reason`, `status`, `ai_drafted` | Knowledge gap tracking |
| `ai_models` | `id`, `name`, `provider`, `capabilities[]`, `is_active` | AI model registry |
| `model_registry` | `model_id`, `provider`, `tier`, `rpm`, `tpm`, `is_active` | Model routing config |
| `model_routing` | `id`, `model_id`, `use_case` (chat/analysis), `priority`, `is_active` | Model priority routing |
| `model_performance_logs` | `id`, `model_id`, `latency_ms`, `tokens_used`, `cost`, `success` | Model performance tracking |

### Spaced Repetition / Progress Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `spaced_repetition` | `user_id`, `problem_id`, SM2 + FSRS fields, `next_review`, `use_fsrs` | Problem-level spaced repetition |
| `skill_repetition` | `user_id`, `skill_id` (8 cognitive skills), FSRS fields, `due` | Skill-level spaced repetition |
| `insight_snapshots` | `user_id`, `insights` jsonb, `recommended_problems` jsonb, `recommended_tier` | Pre-computed recommendations |
| `score_benchmarks` | `difficulty`, `skill_id`, `p25/p50/p75/p90` | Population benchmarks |

### Admin/System Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `admin_users` | `id`, `email`, `can_be_employer` | Admin user list |
| `co_owners` | `id`, `email`, `user_id`, `granted_by` | Co-owner access |
| `global_feature_flags` | `key`, `is_enabled`, `updated_by`, `notes` | Server-side feature flags |
| `system_config` | `key`, `value`, `notes` | System configuration |
| `system_events` | `id`, `type`, `user_id`, `provider`, `error_code`, `metadata` jsonb | Audit trail |
| `company_profiles` | `id`, `name`, `emoji`, `theme_color`, `persona_prompt` | Company branding |
| `session_replays` | `session_id`, `public_token`, `is_public`, `annotations` jsonb | Public replay sharing |
| `code_attempts` | `id`, `identifier`, `campaign_id`, `success` | Entry code tracking |

---

## 4. Feature Flag Inventory

### Client-Side Flags (`src/lib/feature-flags.ts` — localStorage)

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_VAD_INTERRUPTIONS` | ✅ true | Voice Activity Detection for natural interruptions |
| `ENABLE_SMART_ROUTING` | ✅ true | Route simple queries to Groq, complex to Gemini |
| `ENABLE_CHUNKED_RESPONSES` | ✅ true | Stream TTS sentence-by-sentence |
| `ENABLE_RESPONSE_CACHE` | ❌ false | In-memory response cache (not suitable for serverless) |
| `ENABLE_HINGLISH_SUPPORT` | ✅ true | Hindi + English interviews |
| `ENABLE_SILENT_OBSERVER` | ✅ true | Real-time coaching nudges |
| `ENABLE_WHISPER_STT` | ✅ true | Groq Whisper speech-to-text |
| `ENABLE_AWS_POLLY_TTS` | ❌ false | AWS Polly Neural TTS (Kajal) |
| `ENABLE_AWS_TRANSCRIBE_STT` | ❌ false | AWS Transcribe batch post-processing |
| `ENABLE_AWS_S3_STORAGE` | ❌ false | S3 transcript storage |
| `ENABLE_LEARN_MODE` | ❌ false | AI tutor mode with RAG |
| `ENABLE_COMPARATIVE_ANALYSIS` | ✅ true | Side-by-side retry comparison |
| `ENABLE_DIFFICULTY_MODES` | ✅ true | Warm-up / Practice / Crunch / Sprint |

### Server-Side Flags (`global_feature_flags` table in Supabase)

Queried via `src/lib/feature-flags-server.ts` → `getGlobalFeatureFlag(key)`. Cached 60s via Upstash Redis.

> **For demo day:** Enable `ENABLE_AWS_POLLY_TTS` in DB. Keep S3/Transcribe disabled.

---

## 5. Phase 1 — Critical Fixes (Vercel)

### A1: Assessment 0 Scores (CRITICAL — 30 min)

**Problem:** `useAssessment.ts` imports `CognitiveAnalyzer` and runs it in the browser. API keys don't exist client-side.

**Fix:**

1. **Create server API route** `src/app/api/interview/analyze/route.ts`:
   ```typescript
   // POST /api/interview/analyze
   // Body: { sessionId, problem: { title, description, difficulty, difficultyMode }, transcript }
   // 1. Validate auth (Supabase session)
   // 2. Instantiate CognitiveAnalyzer server-side (has env vars)
   // 3. Run analyzer.analyze(sessionId, problem, transcript)
   // 4. Return assessment JSON
   ```

2. **Rewrite `useAssessment.ts`** to use `fetch('/api/interview/analyze')`:
   ```typescript
   // Remove: import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
   // Replace: const analyzer = new CognitiveAnalyzer(); → fetch()
   const res = await fetch('/api/interview/analyze', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ sessionId, problem, transcript }),
   });
   const assessment = await res.json();
   ```

3. **Verify:** Run a practice interview → end → confirm scores are non-zero.

**Files to change:**
- `src/hooks/useAssessment.ts` (rewrite)
- `src/app/api/interview/analyze/route.ts` (create)

---

### A4: Duplicate Transcript (MEDIUM — 5 min)

**Problem:** Two areas in `InterviewSession.tsx` both display `lastAiMessage`.

**Fix:** Remove the compact preview block at lines 754-767 in `InterviewSession.tsx`. Keep only the `ZoomTranscript` component (L833-856).

**Files to change:**
- `src/components/interview/InterviewSession.tsx` (delete lines 754-767)

---

### A6: co_owners 403 RLS (LOW — 5 min)

**Problem:** Client query to `co_owners` table fails because RLS policy is too restrictive.

**Fix:** Either:
- **Option A:** Add a SELECT policy: `USING (user_id = auth.uid() OR email = auth.email())`
- **Option B:** Move the query to a server action that uses the service role client.

**Recommended:** Option B (server action) — more secure, no client-side exposure of co_owner data.

**Files to change:**
- Create `src/app/actions/co-owner.ts` with a `checkCoOwnerStatus()` server action
- Update callers in `src/app/interview/page.tsx` and `src/lib/rate-limit/user-rate-limiter.ts`

---

## 6. Phase 2 — UI Polish & Loading States

### A7: Loading Animations (LOW-MED — 20 min)

**Problem:** Zero `loading.tsx` files → blank white screens during route transitions.

**Create `loading.tsx` in these directories:**

| Path | UI Spec |
|------|---------|
| `src/app/loading.tsx` | Root: centered logo pulse animation |
| `src/app/dashboard/loading.tsx` | 3-row skeleton cards (stats, history, insights) |
| `src/app/interview/loading.tsx` | Centered spinner + "Preparing your interview..." text |
| `src/app/interview/analysis/loading.tsx` | Skeleton: score orb shimmer + 8 skill cards shimmer |
| `src/app/interview/history/[sessionId]/loading.tsx` | Skeleton: transcript lines + assessment panel |
| `src/app/practice/loading.tsx` | Grid of 6 skeleton problem cards |
| `src/app/learn/loading.tsx` | Chat-style skeleton bubbles |
| `src/app/settings/loading.tsx` | Form skeleton with 4 field placeholders |
| `src/app/admin/loading.tsx` | Table skeleton with 5 rows |
| `src/app/employer/loading.tsx` | Dashboard skeleton |
| `src/app/employer/dashboard/loading.tsx` | Campaign list skeleton |

**Template for each `loading.tsx`:**
```tsx
export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 w-full max-w-2xl px-6">
                {/* Skeleton content appropriate for the page */}
                <div className="h-8 bg-zinc-800/50 rounded-lg animate-pulse w-1/3" />
                <div className="h-64 bg-zinc-800/30 rounded-2xl animate-pulse" />
            </div>
        </div>
    );
}
```

---

### A5: Merge Two Analysis Screens (MEDIUM — 45 min)

**Problem:**
- `ReportCard.tsx` (183 lines) — shows as full-screen overlay immediately after interview ends. Uses `AssessmentResult` from client-side analyzer.
- `AnalysisClient.tsx` (815 lines) — full analysis page at `/interview/analysis`. Uses pre-processed data from DB.
- User sees TWO different UIs for the same data.

**Fix Strategy:**

| Step | Action |
|------|--------|
| 1 | When interview ends, instead of showing `ReportCard` overlay, navigate to `/interview/analysis?session=<id>` |
| 2 | In `InterviewSession.tsx`, replace `ReportCard` rendering (L599) with `router.push('/interview/analysis?session=' + sessionId)` |
| 3 | Ensure `/interview/analysis` page fetches the latest assessment from DB (it already does) |
| 4 | Port the best visual elements from `ReportCard` (score orb, conic gradient, framer-motion entry) into `AnalysisClient` header |
| 5 | Keep `ReportCard.tsx` for backward-compat but mark as @deprecated |

**UI Spec for unified analysis page (`AnalysisClient.tsx`):**

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                     │
│                                                          │
│  ┌───────────┐  Assessment Complete.                     │
│  │           │  Problem: Two Sum (EASY)                  │
│  │   7.2     │  Duration: 18 min  │  Confidence: 85%     │
│  │  SCORE    │  Mode: Practice    │  Date: Jun 2025      │
│  └───────────┘                                           │
│                                                          │
│  [Previous Attempts Timeline] (if comparative enabled)   │
│                                                          │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Skill Radar │ │ Key Moments  │ │ Code Quality │      │
│  │   Chart     │ │  Timeline    │ │   Panel      │      │
│  └─────────────┘ └──────────────┘ └──────────────┘      │
│                                                          │
│  8× Skill Dimension Cards (expandable)                   │
│  ┌──────────────────────────────────────────────┐       │
│  │ Problem Decomposition  █████████░  8.2/10    │       │
│  │ Evidence: "Candidate broke the problem..."   │       │
│  │ Sub-criteria: Completeness: 8, Clarity: 9... │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  Improvement Examples (if available)                     │
│  ┌──────────────────────────────────────────────┐       │
│  │ What you said → Level 6 response → Level 9   │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  Hire Decision: BORDERLINE                               │
│  Overall Feedback: "..."                                 │
│  Next Steps: 1. ... 2. ... 3. ...                       │
│                                                          │
│  FSRS: Next Review: Jul 3 │ Stability: 4.2 │ State: 2  │
│                                                          │
│  [Export PDF]  [Share Replay]  [Retry Problem]           │
└──────────────────────────────────────────────────────────┘
```

**Files to change:**
- `src/components/interview/InterviewSession.tsx` (remove ReportCard overlay, add redirect)
- `src/components/analysis/AnalysisClient.tsx` (port score orb from ReportCard)
- `src/components/assessment/ReportCard.tsx` (mark @deprecated)

---

## 7. Phase 3 — Prompt & AI Hardening

### A2: Kai Coherence Validation (HIGH — 15 min)

**Problem:** Kai says "Great approach!" to gibberish like "asdfgh".

**Fix in `src/lib/interview/interviewer-prompt.ts`:**

Add after the `CANDIDATE RESPONSE PATTERNS` section (~line 190):

```markdown
### 🟣 INCOHERENT / NON-TECHNICAL INPUT:
If the candidate's message is:
- Random characters (e.g., "asdfgh", "lkjhgfd")
- Completely unrelated to the problem (e.g., "what's the weather?")
- Copy-pasted solution from external source (suspiciously complete code with no discussion)
- Single word without context (e.g., "yes", "ok", "sure") when you asked for an approach

Response strategy:
1. DO NOT pretend to understand. NEVER say "Great approach!" or "Interesting" to gibberish.
2. Say: "I didn't catch a technical concept there. Could you walk me through your thinking?"
3. If it happens twice: "For the interview, I need to hear your problem-solving process. What data structures or algorithms come to mind for this problem?"
4. If it happens three times: Flag for potential disengagement.

Score impact: Cap ALL dimensions at 2 for exchanges with incoherent input.
```

**Also add to turn prompt phases** (in `generateTurnPrompt`):

For each phase instruction, prepend:
```
IMPORTANT: If the user's message is gibberish, random characters, or clearly not a technical response, 
DO NOT validate it. Ask them to explain their thinking clearly.
```

---

### A3: Polly TTS Error Logging (MEDIUM — 10 min)

**Problem:** Polly 502 with no diagnostic info.

**Fix in `src/lib/aws/polly.ts`:**

```typescript
} catch (err) {
    // ENHANCED ERROR LOGGING
    const errMsg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : 'UnknownError';
    console.error('[Polly] Synthesis failed:', {
        error: errMsg,
        errorType: errName,
        voice,
        engine,
        textLength: text.length,
        region: process.env.AWS_REGION || 'ap-south-1',
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });
    throw new Error('AWS_POLLY_FAILED' satisfies PollyError);
}
```

**Fix in `src/app/api/voice/synthesize-polly/route.ts`:**

Return the underlying error type in the 502 response body (in dev mode) so you can diagnose IAM issues without SSH.

**Checklist for Polly debugging:**
1. Verify IAM policy has `polly:SynthesizeSpeech` action
2. Verify Kajal voice is available in `ap-south-1` (it is — Neural engine, Indian English)
3. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in Vercel env vars
4. Test with `Aditi` (standard engine) to isolate Neural engine issues
5. Check for AWS account free tier limits (5M chars/month for first 12 months)

---

### Prompt Improvement Roadmap (for manual refinement)

These are suggestions for you to edit `src/lib/interview/interviewer-prompt.ts` directly:

| Area | Current State | Improvement |
|------|---------------|-------------|
| Memory injection | Basic: appends memory as text block | Structured: use `kaiMemoryStructured` to dynamically adjust hint level, pace, and topic focus |
| Sprint mode | Generic "move quickly" instruction | Add: problem transition protocol, scoring per-problem, time allocation enforcement |
| Code review | Phase 3 just says "let them code" | Add: specific code quality criteria (naming, structure, idiomatic patterns), code smell detection prompts |
| Cultural fit | Not assessed | Add: optional 9th dimension "Professional Communication & Collaboration" |
| Edge case probing | Phase 4 is generic | Add: problem-specific edge cases from `problem.constraints` field |
| Follow-up questions | Generic approach | Add: Socratic method template — "Why did you choose X over Y?" → "What's the tradeoff?" → "When would Y be better?" |

---

## 8. Phase 4 — Testing & QA Matrix

### Test Coverage (Current: 880 tests, 105 files — Vitest)

| Category | What to test | Priority |
|----------|-------------|----------|
| **A1 (assessment)** | `POST /api/interview/analyze` → returns valid scores, auth required, handles invalid input | P0 |
| **A1 (hook)** | `useAssessment` calls fetch instead of CognitiveAnalyzer | P0 |
| **A2 (coherence)** | Mock gibberish input ("asdfgh") → verify prompt contains coherence gate → Kai doesn't say "Great approach!" | P1 |
| **A3 (polly)** | Mock Polly SDK failure → verify error includes diagnostic info | P1 |
| **A4 (transcript)** | `InterviewSession` renders only ONE transcript area | P1 |
| **A5 (analysis)** | Interview end → navigates to `/interview/analysis`, NOT renders ReportCard overlay | P1 |
| **A6 (co_owners)** | Server action returns co-owner status without 403 | P2 |
| **A7 (loading)** | Each `loading.tsx` file renders skeleton without error | P2 |

### New Test Files to Create

| File | Tests |
|------|-------|
| `src/__tests__/api-interview-analyze.test.ts` | 1. Returns 401 without auth. 2. Returns valid assessment JSON. 3. Handles short transcript gracefully. 4. Returns scores > 0 for valid input. |
| `src/__tests__/useAssessment-server.test.ts` | 1. Calls /api/interview/analyze. 2. Does NOT import CognitiveAnalyzer. 3. Sets isAnalyzing during fetch. 4. Handles network error. |
| `src/__tests__/coherence-prompt.test.ts` | 1. System prompt contains "INCOHERENT" pattern. 2. Gibberish → cap score at 2. |
| `src/__tests__/polly-error-logging.test.ts` | 1. SDK error → console.error includes region, voice, textLength. 2. Missing keys → AWS_POLLY_NOT_CONFIGURED. |
| `src/__tests__/loading-states.test.ts` | 1. Each loading.tsx renders. 2. Contains animate-pulse class. |

### E2E Tests (Playwright)

| Test | Flow |
|------|------|
| `tests/e2e/interview-flow.spec.ts` | Login → Practice → Select problem → Complete interview → Scores displayed (> 0) → Analysis page renders correctly |
| `tests/e2e/loading-states.spec.ts` | Navigate to each major route → verify loading skeleton appears before content |
| `tests/e2e/voice-fallback.spec.ts` | Start interview with Polly disabled → verify browser TTS fallback works |

---

## 9. Phase 5 — AWS Migration

> **ONLY AFTER all Phase 1-4 items are green on Vercel.**

### Migration Architecture

```
User → Cloudflare DNS → AWS EC2 (t2.micro)
                           ↓
                    Docker / PM2 + Next.js
                           ↓
              ┌────────────┼──────────────┐
              ↓            ↓              ↓
         Supabase     Upstash Redis    AWS Services
         (Postgres)   (Cache 60s)      (Polly, S3, Bedrock)
```

### Step-by-Step

| Step | Action | Time |
|------|--------|------|
| B1 | Launch EC2 t2.micro (Ubuntu 24.04 LTS, free tier, ap-south-1) | 10 min |
| B2 | Allocate Elastic IP, configure Security Group (22, 80, 443) | 5 min |
| B3 | SSH in, install Node 22 LTS, PM2, Nginx, Certbot | 10 min |
| B4 | Clone repo, `npm ci`, copy `.env` from Vercel env vars | 5 min |
| B5 | `npm run build && pm2 start npm -- start` | 5 min |
| B6 | Configure Nginx reverse proxy (port 3000 → 80/443) | 5 min |
| B7 | Point Cloudflare DNS A record to Elastic IP | 2 min |
| B8 | Certbot SSL (`certbot --nginx -d algomind.xyz`) | 3 min |

### Nginx Config

```nginx
server {
    server_name algomind.xyz;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### AWS Services Integration

| Service | Current State | Migration Action |
|---------|---------------|------------------|
| **Polly TTS** | Feature flag OFF, code exists | Fix A3, enable flag in DB, verify IAM |
| **S3 Storage** | Feature flag OFF, code exists | Create bucket `algomind-sessions`, enable flag |
| **Bedrock Claude** | Fallback in model routing | Already works via `AWS_ACCESS_KEY_ID` — no change needed |
| **Transcribe** | Feature flag OFF, code exists | Post-MVP enhancement |

### Environment Variables for EC2

```bash
# Supabase (same as Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# AI Providers
GROQ_API_KEY=xxx
GEMINI_API_KEY=xxx

# AWS (already configured for Polly/Bedrock)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1

# Redis
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional
PISTON_URL=https://emkc.org/api/v2/piston
```

---

## 10. Schema Additions Required

### No new tables needed for Phase 1-3.

The existing 29 tables cover all current features. However, for specific fixes:

| Addition | When | SQL |
|----------|------|-----|
| Add `analysis_status` column to `interview_sessions` | Phase 1 (A1) | `ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));` |
| Add RLS policy for `co_owners` | Phase 1 (A6) | `CREATE POLICY "co_owners_select_own" ON co_owners FOR SELECT USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));` |
| Add `s3_transcript_key` to `interview_sessions` | Phase 5 (S3) | `ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS s3_transcript_key text;` |
| Add `polly_audio_key` to `interview_sessions` | Phase 5 (optional) | `ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS polly_audio_key text;` |

### Migration Files

Create in `supabase/migrations/`:
```
20250620_001_add_analysis_status.sql
20250620_002_fix_co_owners_rls.sql
20250620_003_add_s3_columns.sql  (Phase 5 only)
```

---

## 11. Feature ↔ Code Mapping

| Feature | UI Component(s) | Hook(s) | API Route(s) | DB Table(s) | Flag |
|---------|-----------------|---------|--------------|-------------|------|
| **Interview (core)** | `InterviewSession.tsx`, `ConversationView.tsx`, `CodeEditor.tsx` | `useInterview.ts`, `useVoiceInterview.ts` | `POST /api/chat` | `interview_sessions` | — |
| **Assessment** | `ReportCard.tsx` → `AnalysisClient.tsx` | `useAssessment.ts` | `POST /api/interview/analyze` (new) | `assessments` | — |
| **Voice (STT)** | `InterviewSession.tsx` (mic button) | `useVoiceInterview.ts` | `POST /api/voice/transcribe` | — | `ENABLE_WHISPER_STT` |
| **Voice (TTS)** | `InterviewSession.tsx` (auto-play) | `useVoiceInterview.ts` | `POST /api/voice/synthesize-polly` | — | `ENABLE_AWS_POLLY_TTS` |
| **VAD Interruptions** | `InterruptionIndicator.tsx` | `useVoiceInterview.ts` | — | — | `ENABLE_VAD_INTERRUPTIONS` |
| **Practice Mode** | `/practice` page | — | `POST /api/chat` | `interview_sessions`, `problems` | — |
| **Employer Assessment** | `/assess/[token]` page | — | `/api/assess/*` (5 routes) | `assessment_campaigns`, `candidate_submissions` | — |
| **Dashboard** | `StatsOverview.tsx`, `InsightsPanel.tsx`, `SessionTimeline.tsx`, `HireReadinessTrend.tsx` | — | — (SSR) | `interview_sessions`, `assessments`, `insight_snapshots`, `learner_profiles` | — |
| **Spaced Repetition** | `ReviewQueueWidget.tsx` | — | Server action `addProblemToReviewQueue` | `spaced_repetition`, `skill_repetition` | — |
| **Learn Mode** | `/learn` page | — | `POST /api/learn/chat` | `knowledge_chunks` | `ENABLE_LEARN_MODE` |
| **LeetCode** | Settings page | — | `/api/leetcode/*` (3 routes) | `leetcode_profiles` | — |
| **RAG Knowledge** | Admin RAG panel | — | `/api/rag/*`, `/api/admin/rag` | `knowledge_chunks`, `knowledge_gaps` | — |
| **Model Routing** | Owner panel | — | `/api/owner/model-routing` | `model_registry`, `model_routing` | `ENABLE_SMART_ROUTING` |
| **Feature Flags** | Owner panel | — | `/api/owner/flags` | `global_feature_flags` | — |
| **Session Replay** | `/replay/[token]` | — | `/api/replay/generate` | `session_replays` | — |
| **Difficulty Modes** | Interview lobby | — | — (prompt config) | — | `ENABLE_DIFFICULTY_MODES` |
| **Kai Memory** | Automatic (per student) | — | `/api/user/memory` | `learner_profiles` | — |
| **Comparative Analysis** | `AnalysisClient.tsx` (previous attempts) | — | — (SSR) | `interview_sessions` | `ENABLE_COMPARATIVE_ANALYSIS` |
| **Silent Observer** | `SilentObserverNudge.tsx` | — | — (client-only) | — | `ENABLE_SILENT_OBSERVER` |
| **Text Interview** | `TextInterviewMode.tsx` | — | `POST /api/chat` | — | — |
| **Hinglish** | Prompt + Whisper config | — | — | — | `ENABLE_HINGLISH_SUPPORT` |

---

## 12. Component Architecture Map

```
src/components/
├── interview/              (16 files — the interview experience)
│   ├── InterviewSession.tsx      ★ Main 1271-line orchestrator
│   ├── ConversationView.tsx      Chat bubbles
│   ├── CodeEditor.tsx            Monaco editor
│   ├── TextInterviewMode.tsx     Text-only alternative
│   ├── InterruptionIndicator.tsx VAD interruption UI
│   ├── SilentObserverNudge.tsx   Coaching nudges
│   ├── ManualControls.tsx        Manual mic/skip controls
│   ├── VoiceOnboarding.tsx       First-time voice setup
│   ├── GuestModeBanner.tsx       Guest user banner
│   ├── GuestProblemSelectorModal.tsx  Guest problem picker
│   ├── GuestRegisterModal.tsx    Guest → register modal
│   ├── GuestResultsOverlay.tsx   Guest results
│   ├── InterviewLimitBar.tsx     Daily limit indicator
│   ├── InterviewErrorBoundary.tsx Error boundary
│   ├── BrowserCompatBanner.tsx   Browser support warning
│   └── MobileWarning.tsx         Mobile not supported
│
├── assessment/             (6 files — scoring & results)
│   ├── ReportCard.tsx            ★ Post-interview overlay (TO BE DEPRECATED)
│   ├── SkillDetailCard.tsx       Individual skill card
│   ├── SkillBadge.tsx            Skill icon badge
│   ├── AssessmentLoader.tsx      Loading state
│   ├── EmptyState.tsx            No assessment yet
│   └── ErrorState.tsx            Assessment error
│
├── analysis/               (1 file — deep analysis page)
│   └── AnalysisClient.tsx        ★ 815-line unified analysis (TO ABSORB ReportCard)
│
├── dashboard/              (17 files — user dashboard)
│   ├── StatsOverview.tsx         Score/session stats cards
│   ├── InsightsPanel.tsx         AI-generated insights
│   ├── RecommendationsPanel.tsx  Problem recommendations
│   ├── SessionTimeline.tsx       Visual session history
│   ├── HireReadinessTrend.tsx    Readiness trend chart
│   ├── ReviewQueueWidget.tsx     Spaced repetition queue
│   ├── SkillTrendCard.tsx        Skill progress over time
│   ├── CandidateHistoryTable.tsx Session history table
│   ├── PDFReport.tsx             PDF export
│   ├── ExportReportButton.tsx    Export trigger
│   ├── ShareReplayButton.tsx     Share session
│   ├── SessionNode.tsx           Timeline node
│   ├── DashboardCard.tsx         Generic card
│   ├── DashboardHeader.tsx       Header
│   ├── DashboardNav.tsx          Navigation
│   └── ComingSoonSection.tsx     Feature placeholder
│
└── ui/                     (21 files — shadcn/ui primitives)
    ├── button, card, dialog, drawer, input, label, select, tabs, etc.
    └── ErrorBanner.tsx           Global error display
```

---

## 13. API Route Inventory (50 endpoints)

### Core Interview
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/chat` | Yes | Main interview chat turn (AI response via model routing) |
| POST | `/api/execute` | Yes | Code execution via Piston |
| **POST** | **`/api/interview/analyze`** | **Yes** | **NEW — Server-side assessment (fixes A1)** |

### Voice
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/voice/transcribe` | Yes | Groq Whisper STT |
| POST | `/api/voice/synthesize-polly` | Yes | AWS Polly TTS |

### Employer Assessment
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/assess/start` | Public | Start employer assessment |
| POST | `/api/assess/chat` | Public | Assessment chat turn |
| POST | `/api/assess/complete` | Public | Complete & score (server-side) |
| POST | `/api/assess/save-progress` | Public | Save candidate progress |
| POST | `/api/assess/verify-code` | Public | Verify entry code |

### Learn Mode
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/learn/chat` | Yes | RAG-powered learning chat |

### RAG
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/rag/search` | Yes | Knowledge search |
| POST | `/api/rag/context` | Yes | Context retrieval |

### User
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/user/memory` | Yes | Kai memory |
| GET | `/api/user/owner-status` | Yes | Owner check |
| GET | `/api/user/account-type` | Yes | Account type |
| GET | `/api/user/submissions/[id]/report` | Yes | Submission report |

### Feature Flags
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/flags` | No | Get flags |

### LeetCode
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/leetcode/status` | Yes | Sync status |
| POST | `/api/leetcode/connect` | Yes | Connect account |
| POST | `/api/leetcode/refresh` | Yes | Refresh data |

### Employer
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/employer/campaigns` | Employer | Create/list |
| GET/PUT | `/api/employer/campaigns/[id]` | Employer | CRUD campaign |
| GET | `/api/employer/submissions/[campaignId]` | Employer | List submissions |
| GET | `/api/employer/submissions/[campaignId]/export` | Employer | CSV export |
| GET | `/api/employer/submissions/.../report/[id]` | Employer | Single report |
| GET | `/api/employer/transcript/[sessionId]` | Employer | Transcript |
| POST | `/api/employer/upgrade` | Yes | Upgrade to employer |

### Replay
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/replay/generate` | Yes | Public replay link |

### Admin (18 routes)
| Path group | Purpose |
|------------|---------|
| `/api/admin/admins` | Admin user CRUD |
| `/api/admin/trigger-cron` | Manual cron |
| `/api/admin/rag` | RAG management |
| `/api/admin/reset-model` | Reset model |
| `/api/admin/models` | Model list/verify |
| `/api/admin/events` | System events |
| `/api/admin/health` | Health |
| `/api/admin/employer-invites` | Invite management |
| `/api/admin/employers` | List employers |
| `/api/admin/ai-status` | AI status |
| `/api/admin/cache-stats` | Cache stats |

### Owner (5 route groups)
| Path group | Purpose |
|------------|---------|
| `/api/owner/users` | All users |
| `/api/owner/rate-limits` | Rate limit management |
| `/api/owner/flags` | Feature flag management |
| `/api/owner/co-owners` | Co-owner management |
| `/api/owner/model-routing` | Model routing config |

### Health (3 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Basic health |
| GET | `/api/health/connectivity` | No | Connectivity |
| GET | `/api/health/ai` | No | AI provider health |

### Cron
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/cron/trigger` | Secret | External cron trigger |

---

## 14. Priority Execution Table

| Order | Task | Effort | Impact | Depends On |
|-------|------|--------|--------|------------|
| 1 | **A1:** Assessment → server API route | 30 min | CRITICAL — scores work | — |
| 2 | **A4:** Remove duplicate transcript | 5 min | Medium — cleaner UI | — |
| 3 | **A2:** Coherence validation in prompt | 15 min | High — stops hallucination | — |
| 4 | **A3:** Polly error logging | 10 min | Medium — debuggable TTS | — |
| 5 | **A6:** co_owners server action | 5 min | Low — stops 403 | — |
| 6 | **A7:** Loading animations (11 files) | 20 min | Low-Med — polished UX | — |
| 7 | **A5:** Merge analysis screens | 45 min | Medium — unified UX | A1 (scores must work first) |
| 8 | **Phase 4:** Write new tests | 60 min | High — prevents regressions | A1-A7 all done |
| 9 | **Phase 5:** AWS EC2 migration | 45 min | Strategic — independence from Vercel | Phases 1-4 green |

**Total estimated time: ~4 hours**

---

## 15. Verification Checklist

### After Phase 1 (Critical Fixes)

- [ ] Start practice interview → end → assessment scores are > 0
- [ ] Assessment page shows 8 dimensional scores with evidence
- [ ] Only one transcript area visible during interview
- [ ] No 403 error in console for co_owners
- [ ] Polly error logs show diagnostic info (if TTS fails)

### After Phase 2 (UI Polish)

- [ ] Navigate to `/dashboard` → see skeleton loading before content
- [ ] Navigate to `/interview/analysis` → see skeleton before data loads
- [ ] All 11 routes show loading states
- [ ] After interview ends → redirect to `/interview/analysis` (not ReportCard overlay)
- [ ] Analysis page shows score orb + 8 skill cards + key moments

### After Phase 3 (Prompt Hardening)

- [ ] Say "asdfgh" to Kai → Kai does NOT say "Great approach!"
- [ ] Say "asdfgh" three times → Kai warns about engagement
- [ ] Normal conversation works as before

### After Phase 4 (Testing)

- [ ] `npm run test` passes > 900 tests
- [ ] New test files for A1-A7 all pass
- [ ] Playwright E2E: full interview flow passes

### After Phase 5 (AWS Migration)

- [ ] `curl -I https://algomind.xyz` → 200 OK from EC2
- [ ] Full interview flow works on EC2
- [ ] Polly TTS works (if flag enabled)
- [ ] All feature flags work
- [ ] Vercel deployment can be decommissioned

---

## Appendix: File Quick Reference

| What | Where |
|------|-------|
| Main interview prompt | `src/lib/interview/interviewer-prompt.ts` |
| Turn prompt builder | `src/lib/interview/prompts.ts` |
| Assessment prompt | `src/lib/assessment/prompts.ts` |
| Client assessment hook (BROKEN) | `src/hooks/useAssessment.ts` |
| Server assessment analyzer | `src/lib/assessment/analyzer.ts` |
| AI model client | `src/lib/ai/client.ts` |
| Interview session UI | `src/components/interview/InterviewSession.tsx` |
| ReportCard overlay (TO DEPRECATE) | `src/components/assessment/ReportCard.tsx` |
| Analysis page | `src/components/analysis/AnalysisClient.tsx` |
| Polly TTS | `src/lib/aws/polly.ts` |
| Feature flags (client) | `src/lib/feature-flags.ts` |
| Feature flags (server) | `src/lib/feature-flags-server.ts` |
| Supabase schema dump | `schema details/supabase_schema.sql` |
| State machine | `src/lib/interview/state-machine.ts` |
| Model routing | `src/lib/ai/model-routing.ts` |
| Interview config | `src/lib/interview/interview-config.ts` |
