# AlgoMind — End-to-End Audit & Honest Engineering Review

**Date:** 2026-09-10 · **Branch:** `main` @ `c7683ec` · **Environment audited:** local dev server (`npm run dev`, port 3000) pointed at the **live production Supabase project** (`wfdgsmhuglmrxcmwcylz`, 22 real users) · **Authenticated as:** owner (`aniruddhvijayvargia@gmail.com`).

> **How to read this.** Every claim below was verified against running code, live API responses, the production database (via Supabase MCP), or provider APIs — not inferred. Where something is unproven, it is explicitly marked *inconclusive*. Because the dev server talks to production data, all mutating controls (Save/Delete/Toggle) were left untouched; findings on those are from reading code + read-only probes.

---

## 1. Executive verdict (honest)

AlgoMind is an **ambitious, well-structured product with genuinely good bones** — clean Next.js App-Router layout, RLS on every table, a documented tiered-AI-routing design, graceful-degradation contracts, a thoughtful voice stack, responsive desktop/mobile shells. The *intent* is clear and mostly sound.

But it is currently in a state where **most of its headline "AI" features are silently broken or running on the wrong path**, and there is **one critical security hole**. The recurring failure pattern is the same across three subsystems:

> A clean abstraction was designed (DB-driven model routing, a confidence-gated interruption engine, a multi-provider embedder), but the **live code paths route *around* it and reimplement a cruder inline version**, while the good version rots as dead code full of **hardcoded model IDs that have since been decommissioned**. Meanwhile external dependencies (AWS, the public Piston API, several Groq/Gemini model IDs) **died out from under the app**, and the health/telemetry that should have caught it is itself broken.

Net: the app *appears* down ("0 healthy models", "voice faulty", "Run does nothing") more than it *is* down — but the parts that limp along do so slowly, on far-down fallbacks, with no visibility. This is very fixable, and a lot of it is **deletion and consolidation, not new code.**

### Scorecard

| Area | State | One-line |
|---|---|---|
| Security (DB RPC grants) | 🔴 Critical | Unauthenticated users can read private data & call destructive functions |
| AI chat routing | 🟠 Degraded | Works via slow fallback; **streaming path has no failover**; 5 dead model IDs |
| RAG / embeddings | 🔴 Broken | 100% failure — every interview runs with **no** RAG context |
| Code execution ("Run") | 🔴 Broken | Public Piston API went whitelist-only → every run 503s |
| Voice pipeline | 🟠 Fragile | Works but self-echo barge-in bug; real interruption engine is dead code |
| AWS (Polly/Bedrock/S3) | ⚫ Deprecated | Dead creds; **being removed** — see §7 removal plan |
| Health/observability | 🟠 Misleading | Health check pings dead models → false "0 healthy"; CSP reports 400 |
| Owner dashboard correctness | 🟠 Wrong data | 2 pages query non-existent tables; KG stats always 0 |
| Core UI (desktop + mobile) | 🟢 Good | Renders cleanly, no horizontal overflow, PDF works, IDE panels solid |
| Auth / RLS / route protection | 🟢 Good | All protected APIs 401; RLS on all 35 tables |

---

## 2. Findings ranked by severity

| # | Sev | Area | Finding | Proof |
|---|-----|------|---------|-------|
| BUG-04 | 🔴 **Critical** | Security/DB | Anon (public key) can execute 38 `SECURITY DEFINER` RPCs; 32 lack an internal auth guard — IDOR reads, state tamper, and **destructive** deletes | Live `curl` as anon returned data (200); `has_function_privilege` |
| BUG-13 | 🔴 High | RAG | Embedding pipeline 100% broken → interviews run with no RAG context | localhost logs + provider 404 |
| BUG-16 | 🔴 High | Code exec | Public Piston API whitelist-only (401) → every "Run" 503s | `/api/execute` 503 + direct Piston 401 |
| BUG-18 | 🔴 High | AI streaming | **Streaming chat has no model failover** — picks model[0]; if it's dead the whole turn errors to the user | code trace `client.ts:801-833, 934, 1009` |
| BUG-02 | 🟠 High | Health | `/api/health/ai` reports **0 healthy** while 11/16 models are live (pings 2 dead models) | health JSON vs provider lists |
| BUG-03 | 🟠 High | AI routing | 5 decommissioned model IDs still registered/active + hardcoded in code | provider model lists |
| BUG-11 | 🟠 High | DB | `count_distinct_diagnosed_users()` & `get_hardest_concepts()` **permanently error** (`search_path=''` + unqualified table) → owner KG stats always 0 | direct SQL error |
| BUG-12 | 🟠 High | Owner UI | 2 owner pages query non-existent tables (`users`, `system_flags`); errors swallowed → always-empty data | edge_logs 404 + code |
| BUG-15 | 🟠 Med-High | AI perf | Chat wastes 2–5s failing through dead tiers before landing on a live model | 3× latency probe |
| BUG-06 | 🟡 Med | Observability | CSP `report-uri` → `/api/log-error` rejects every report with 400 | curl both report shapes |
| BUG-07 | 🟡 Med | Security/CSP | Invalid CSP source `polly.*.amazonaws.com` (silently ignored) | console error ×6/load |
| BUG-08 | 🟡 Med | Owner UI | Model Registry shows dead models as "Healthy" until manually Verified | `/owner/models` + verify API |
| BUG-19 | 🟡 Med | Voice | Real barge-in engine (`InterruptionManager`, 637 lines) is **dead code**; live barge-in is crude → self-echo feedback loop | code trace |
| BUG-01 | 🟢 Low | Frontend | Raw `// @ts-expect-error` comment renders as visible text on the **public landing page** | rendered page text |
| BUG-17 | ⚫ Dep. | AWS | Polly TTS dead (502) — being removed | `/api/voice/synthesize-polly` 502 |
| BUG-05 | 🟢 Low | Auth cfg | Leaked-password protection (HaveIBeenPwned) disabled | Supabase advisor |
| BUG-09 | 🟢 Low | SEO | Doubled tab title `Diagnostic \| AlgoMind \| AlgoMind` | rendered title |
| WARN-10 | 🟢 Low | Hygiene | Dev route `/test-modal` ships to production | route 200 |
| PERF-DB | 🟡 Med | DB scaling | RLS `initplan` ×65, multiple-permissive-policies ×138, dup index, 13 unindexed FKs, 30 unused indexes | Supabase perf advisor |

---

## 3. The AI model pipeline — intent, mess, and how to rebuild it

### What was intended (and it's a good design)
A DB-driven routing table (`model_routing`) as the source of truth, `model_registry` for capabilities/limits, a static `CHAT_MODELS` list as an emergency break-glass fallback, and a deterministic **stage plan** (primary → cross-tier secondary → emergency) driving failover (`src/lib/ai/model-routing.ts:87-97`). On paper this is a clean, self-healing tiered router.

### What actually happens (the mess)
The implementation drifted badly from that intent. **There is not one source of truth — there are five**, and the two the interactive chat endpoints actually hit are the wrong ones:

1. `model_routing` table (`getModelsForUseCase`) — **only reached by non-interactive/analysis calls.**
2. `model_registry` table (`getActiveModels`) — what all interactive + streaming paths actually use.
3. Static `CHAT_MODELS` (`src/lib/ai/providers.ts:39-181`) — emergency fallback, **front-loaded with dead IDs**.
4. Env overrides (`GROQ_GPT_OSS_MODEL_ID`, `GEMINI_FREE_TIER_MODEL_ID`).
5. Hardcoded string literals scattered through the code.

`generateCompletion` has two disjoint halves: when `preferredProvider` is set it takes a "compatibility path" (`src/lib/ai/client.ts:118-181`) that **bypasses the entire designed stage-plan/cross-tier/emergency logic**. And **every interactive caller sets a provider** — `chat/route.ts:335` forces `'gemini'`, `assess/chat/route.ts:323` uses `'auto'` (resolved to a concrete provider). So **the owner-dashboard "AI Routing" table does not actually control the live mock-interview chat.** It only governs backend analysis calls.

### Concrete bugs (file:line)

- **BUG-18 — Streaming has no failover (biggest live bug).** `generateStream` (`client.ts:801-833`) resolves a provider and calls `streamGroq`, which picks `groqModels[0]?.id ?? 'llama-3.3-70b-versatile'` (`client.ts:934`) — a **single** model, no loop. If it 404s/429s the fetch throws (`client.ts:957-960`) and the whole stream rejects to the user. The **main interview chat streams** (via Inngest, `inngest/functions.ts:246-252`) and so does assessment chat (`assess/chat/route.ts:282-290`). `streamGemini`'s hardcoded default is `gemini-2.0-flash` (`client.ts:1009`) — a confirmed-dead ID. **The primary user-facing chat path has zero model failover.**
- **BUG-03 — dead model IDs, in data *and* code.** DEAD at provider (verified): `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `qwen/qwen3-32b`, `meta-llama/llama-4-scout-17b-16e-instruct`, `gemini-2.0-flash`. These sit at **tiers 1–4** of `CHAT_MODELS` (live `gpt-oss-120b/20b` are tiers 5–6). Hardcoded literals that a DB change can't fix: `intent-classifier.ts:277` (`llama-3.1-8b-instant` — the LLM intent second-pass silently 404s every time and falls back to a heuristic), `client.ts:934`, `client.ts:1009`, `client.ts:1154-1155`.
- **BUG-15 — slow failover.** Verified `/api/chat` returns 200 via `gemini-3.1-flash-lite` (a live model), but warm latency for a trivial reply was **2.1 / 5.6 / 4.8s** — 3–5× a healthy Groq reply — because routing burns 404 round-trips on dead tiers first.
- **Asymmetric provider fallback.** Cross-provider fallback exists only `gemini→groq` (`client.ts:149`). A groq-routed request that exhausts groq returns `"All allowed models failed"` and never tries Gemini (`client.ts:176-180`).
- **Response cache is off in prod** (`client.ts:627-632` requires `NODE_ENV !== 'production'`) and its advertised "fuzzy Levenshtein matching" (`response-cache.ts:5-6`) is **not implemented** in the cache — pure overhead as shipped.

### Recommendation — collapse to one router
1. **Delete the `preferredProvider` compatibility fork** (`client.ts:118-181`). Every call — streaming and non-streaming — goes through **one** ordered-candidate function reading **one** table (merge `model_routing` + `model_registry` into a single `models` table). "Preferred provider" becomes a soft priority boost, not a separate code path.
2. **Make streaming iterate the candidate list** exactly like non-streaming (attempt connection to candidate N, only commit to streaming once bytes flow, else advance). This kills BUG-18.
3. **Purge every hardcoded model ID** (`intent-classifier.ts:277`, `client.ts:934/1009/1154/1155`, dead `CHAT_MODELS` rows) → look up the first active model instead.
4. **Fix the health check** to ping whatever the router would actually use (first active model per provider) — this alone fixes "0 healthy".
5. **Symmetric fallback** both directions, driven by the candidate list.
6. **Delete all Bedrock branches** as part of AWS removal (§7).

---

## 4. RAG / embeddings — completely broken (BUG-13)

Every interview currently runs **without RAG context**. Verified from the live dev-server logs:

```
⚠️ Bedrock Titan embedding failed … The security token included in the request is invalid.
⚠️ Gemini embedding failed: models/gemini-embedding-1 is not found (404)
⚠️ Bedrock embedding (last-resort) also failed …
❌ All embedding providers failed. Interview will proceed without RAG context.
```

Two root causes:
1. **Primary embedder is Bedrock/AWS** (`client.ts:1307-1326`, `bedrock-client.ts:273`, model `amazon.titan-embed-text-v2:0`) — dead creds (AWS being removed).
2. **The Gemini fallback model ID is wrong**: `gemini-embedding-1` (`client.ts:1336,1369-1370`; `providers.ts:186-194`). Verified: that ID → **HTTP 404**; the real ID `gemini-embedding-001` → **works**.

**The fix is *not* a one-line ID swap — there's a dimension mismatch:**
- `gemini-embedding-001` default output = **3072 dims** (verified live).
- Stored `knowledge_chunks.embedding` = **768 dims** (31 chunks in the DB, verified).
- So you must call `gemini-embedding-001` with `outputDimensionality: 768`, **or** re-embed the whole corpus at the new dimension. After AWS removal, **Gemini must become the primary embedder**, not a fallback.

---

## 5. Code execution ("Run") — fully broken (BUG-16)

`POST /api/execute` returns **503 "Code execution service unavailable"** for every run. Root cause verified by calling the endpoint directly:

```
PISTON_URL = https://emkc.org/api/v2/piston/execute
→ HTTP 401 "Public Piston API is now whitelist only as of 2/15/2026.
   Please host your own instance…"
```

The default in `src/app/api/execute/route.ts:123` points at the now-defunct public Piston. Users can write code in the Monaco editor (which loads fine) but **the Run button never works**. **Fix:** self-host Piston via Docker (or switch to Judge0) and set `PISTON_URL`. The route's caching/rate-limit/cache-hit logic around it is otherwise sound.

---

## 6. Voice pipeline — works but fragile (BUG-19 + cluster)

### Intent
Sensible: Silero VAD (ONNX) → Groq Whisper STT, with a browser-`SpeechRecognition` → `MediaRecorder` degradation ladder; TTS cascades Polly → browser `SpeechSynthesis`; a barge-in engine to interrupt the AI when the user speaks.

### The core problem: three orchestrators + a dead interruption engine
There are **three parallel voice orchestrators that don't agree**: `useInterview.ts` (the real one, used by the interview components), `useUnifiedVoice.ts` (used only by the learn page), and `useInterviewVoice.ts` (**imported nowhere**). The sophisticated `InterruptionManager` (637 lines — grace period, debounce, confidence gating, frame counting) is **only** referenced by the dead hook, so **it never runs in the product.** The barge-in that *does* run is a crude inline version.

### Concrete bugs (file:line)
- **BUG-19 — self-echo feedback loop.** In `useInterview.ts:306-309`, *any* VAD speech-start while the AI is speaking interrupts TTS **with no grace period and no confidence gate**. If the user isn't on headphones, the mic hears the AI's own audio, cuts the AI off, and then `onSpeechEnd`'s echo-guard *passes* (`useInterview.ts:329`) so **the AI's own speech gets transcribed and sent as the user's turn.** VAD's mic is **not** configured with `echoCancellation` (`vad-manager.ts:205-249`) — unlike the recorder path which sets it. This is a strong candidate for the "voice faulty at times" reports.
- **No real Groq TTS, but the UI claims one.** `TTSEngine` supports only `'polly' | 'browser'` (`tts-engine.ts:14`); the repo itself documents "No Groq TTS implementation exists" (`validateEnv.ts:119`). Yet `VoiceSettings.tsx:201` advertises *"Groq Orpheus Neural TTS"* and branches on `ttsProvider==='groq'` (`:43`). Users can be shown a voice that can never be produced.
- **VAD singleton pinned to `window.__VAD_MGR__`** (`vad-manager.ts:368-383`) — one component unmount can `destroy()` a manager another still uses → stale mic streams across navigation.
- **Deferred-stop race**: the 1s safety timer in `useVAD.stopListening` (`useVAD.ts:190-205`) is **shorter** than the 1.5–1.8s VAD redemption window it's meant to outlast → can force-stop mid-utterance and drop audio.
- **Config split-brain**: `vad-manager.ts:38-47` and `voice-config.ts` disagree on VAD constants, and `init()` only applies one of them — the localStorage-tunable knobs mostly don't take effect.
- **Whisper** runs turbo→large-v3 **serially** and a turbo 5xx (non-429) throws without trying large-v3 (`transcribe/route.ts:89`); under `maxDuration=30` two serial calls on a long clip can time out. There's also a fourth **unused** STT path (`whisper-stt.ts`) and duplicate WAV encoders.

### Recommendation
Collapse to **one** orchestrator (`useInterview.ts`), delete `useInterviewVoice.ts` + `useUnifiedVoice.ts`. Either adopt `InterruptionManager` as the single barge-in brain (wire `onFrameProcessed → handleVADFrame`, add grace + confidence gate) or delete it — don't ship both. **Enable `echoCancellation` on the VAD mic** (biggest single reliability win). With Polly gone, make **browser TTS the hardened default**: unlock-on-first-gesture to beat autoplay blocking, detect zero-voice environments and show a text fallback, chunk long turns. Remove the fictitious Groq/Orpheus option.

---

## 7. AWS — mark deprecated & remove (Polly · Bedrock · S3 · Transcribe)

Per your direction, **all AWS integration is deprecated and slated for removal.** Good news from the audit: **every AWS path is flag-gated and defaults OFF** (`src/lib/feature-flags.ts:71,79,88,95,103`) and additionally gated on `AWS_ACCESS_KEY_ID` being present. **The app already runs 100% on Groq / Gemini / browser-TTS / Supabase** — so removal is low-risk *if* the fallbacks below are preserved.

### Surface inventory (delete outright)
- `src/lib/aws/polly.ts`, `src/lib/aws/s3.ts`, `src/lib/aws/usage-logger.ts`, `src/lib/aws/index.ts`, `src/lib/ai/bedrock-client.ts`
- Routes: `src/app/api/voice/synthesize-polly/route.ts`, `src/app/api/storage/transcript/route.ts` (**already orphaned — no caller**), `src/app/api/owner/aws-usage/route.ts`
- Owner UI: `src/app/owner/aws/` (page + `AWSConfigPanel` + `AWSUsagePanel`)
- **`src/config/providers.ts` — entire module has zero importers (dead); safe to delete.**

### Edit (strip AWS, keep file)
- `src/lib/ai/client.ts` — remove Bedrock blocks `:183-247`, `:395-398`, `:811-831`, `:1074-1099`, and the Titan embedding attempts `:1307-1326`, `:1345-1360`. Keep Groq/Gemini + make Gemini the primary embedder (§4).
- Drop `'bedrock'` from the provider unions **in one pass** (`providers.ts:4`, `types.ts:18-19,66`, `intent-classifier.ts:18`, `response-cache.ts:25,199,212`, `analytics/model-telemetry.ts:37`) — this is a type-cascade; they must change together or TS breaks.
- Voice: remove `tryPolly` + Polly branch from `tts-engine.ts` (browser-only `speak`); drop `pollyEnabled` from `useTTS.ts` (+ the dead `'polly-flag-changed'` listener) and `voice-adapter.ts`; collapse `userTtsProvider` unions to `'auto'|'browser'` (`useInterviewVoice.ts:28`, `useInterview.ts:174`, `InterviewSession.tsx:85`, `interview/page.tsx:58`).
- `VoiceSettings.tsx:218,238-242` remove Polly option/notes; `owner/users/users-client.tsx:171` remove Polly option; `owner/models/ModelsClient.tsx:535` remove Bedrock option.
- `owner/flags/FlagsClient.tsx` + `owner/settings/SettingsClient.tsx` — remove the "AWS Services" flag group + "Disable all AWS" button; `owner/layout.tsx:35` remove `/owner/aws` nav; `owner-mutations.ts:14` remove its `revalidatePath`.
- `feature-flags.ts` delete the 5 flag defs; `env.d.ts:44-49` + `validateEnv.ts:63-69,150-155` remove AWS env vars.
- `user-preferences.ts:22,29,54,87` — migrate stored `tts_provider='polly'` values to `'auto'`/`'browser'` so no invalid preference remains.

### DB & env cleanup
- `DELETE FROM model_routing WHERE provider='bedrock';`
- Drop table `aws_usage_log` + RPC `get_aws_usage_summary`.
- Drop the **unused** `interview_sessions` columns (verified never written): `audio_s3_key`, `transcript_s3_key`, `transcript_storage`, `transcribe_job_name`, `transcribe_status`. Keep the live `transcript` JSONB. Regenerate `src/types/supabase.ts`.
- Remove env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_BEDROCK_REGION`, `AWS_BUDGET_LIMIT`. Remove deps `@aws-sdk/client-polly`, `@aws-sdk/client-s3`, `@aws-sdk/client-bedrock-runtime`.
- User-facing copy: `legal/privacy/page.tsx:52` (AWS Polly) & `:61` (AWS Bedrock) — remove. (`:51` "Supabase … hosted on AWS" refers to Supabase's hosting, not the integration — leave or reword.)

### Removal risks
- **If Bedrock is currently ON in prod**, it's serving chat *first* — removing it shifts all load onto small Groq/Gemini free-tier RPM/RPD caps. Confirm capacity first. (Default is off, so this only bites if enabled.)
- **Polly-preference users** drop to browser TTS — a perceptible quality downgrade (migrate their saved preference).
- **S3 & Transcribe are already inert** (orphaned route / phantom, no implementation) — removing them cannot affect end users. *Transcribe never had an implementation at all — only a flag and unused columns.*

---

## 8. Database & security

### 🔴 BUG-04 (Critical) — anon can execute privileged DB functions
Using only the **public anon key** (shipped in every browser as `NEXT_PUBLIC_SUPABASE_ANON_KEY`), an **unauthenticated** caller can invoke 38 `SECURITY DEFINER` functions via `/rest/v1/rpc/<fn>`. `SECURITY DEFINER` means they run as the table owner and **bypass RLS**. 32 of them have **no internal auth guard**. Proven live (anon, HTTP 200 with data):

- `get_student_context(p_user_id)` → returns **any** user's subscription status, weekly usage, sessions remaining, and weakest/strongest concepts (IDOR read of private data).
- `get_admin_analytics(p_days)` → `{total_users, active_models, total_sessions}` (admin-only data).

Also anon-executable with no guard (grant verified via `has_function_privilege`; **not executed**, to avoid harming production):
- **Destructive:** `cleanup_old_events(days)` → `DELETE FROM system_events`; `safe_delete_admin(email)` → `DELETE FROM admin_users`.
- **IDOR reads:** `get_user_sessions_with_assessment`, `get_due_reviews`, `get_hardest_concepts`, `get_model_rate_stats`, `count_distinct_diagnosed_users`.
- **State tamper (arbitrary user):** `atomic_increment_weekly_usage`, `check_and_increment_weekly_usage`, `record_user_question`, `update_user_streak`, `initialize_concept_states`, `save_question_progress`, `on_interview_session_completed`, `on_learn_session_completed`, `mark_submission_dropped`, `record_code_attempt`, `check_code_rate_limit`.

6 functions *do* self-guard (`get_user_progress` returns "Authentication required", `is_owner`, `check_is_admin`, `get_my_permissions`, `save_interview_session_atomic`, `upsert_concept_states_batch`), and ~7 are trigger functions granted by mistake (they reference `NEW`/`OLD` and would error if RPC-called). Confirmed by Supabase advisors: lint `0028` (anon, 38) + `0029` (authenticated, 42).

**Fix (do this first):**
```sql
-- Revoke blanket execute, then grant back only what genuinely needs it.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
-- Re-grant the few RPCs the client legitimately calls, to `authenticated` only,
-- and add `auth.uid()` checks inside any that act on a p_user_id.
```
Trigger functions never need `EXECUTE` grants at all. Destructive/admin functions should be `service_role`-only.

### 🟠 BUG-11 — two owner-analytics functions are permanently broken
`count_distinct_diagnosed_users()` and `get_hardest_concepts()` are declared `SET search_path = ''` but reference `concept_states` **unqualified** → every call throws `relation "concept_states" does not exist` (verified via direct SQL, for all roles). They're called by `/api/owner/kg-stats` (`route.ts:42,44`), which has a try/warn fallback — so the page doesn't crash, but **"users with diagnostic" is always 0 and "hardest concepts" always empty**, even though 160 `concept_states` rows exist. **Fix:** qualify as `public.concept_states` (or `SET search_path = public`).

### 🟠 BUG-12 — two owner pages query tables that don't exist
- `owner/rate-limits/page.tsx:13` → `.from('users')` (no such table — it's `profiles`) → 404 in edge_logs → the "rate-limit override" user list is **always empty**.
- `owner/settings/page.tsx:20` → `.from('system_flags')` (no such table) → 404 → the flags list renders **empty**.
Both ignore the `{error}` from Supabase, so the pages return 200 with silently-missing data. **Fix:** `from('profiles')` and `from('global_feature_flags')` respectively (verify column shapes).

### 🟢 Good
- **RLS is enabled on all 35 public tables** with policies present.
- **Route protection is solid:** all `/api/admin/*`, `/api/owner/*`, `/api/employer/*`, `/api/knowledge/*`, `/api/user/me`, `/api/storage/*` return **401** unauthenticated (33-endpoint sweep). Authenticated owner sweep: all 200.
- `tsc --noEmit` and `eslint` both pass clean (exit 0).

### 🟡 PERF-DB — scaling (Supabase performance advisor)
- `auth_rls_initplan` ×65 — RLS policies call `auth.uid()`/`current_setting()` **per row** instead of `(select auth.uid())`. Wrap them; big win at scale.
- `multiple_permissive_policies` ×138 — many tables have >1 permissive policy per role+action (each runs). Consolidate.
- `duplicate_index` — `co_owners` has two identical indexes; drop one.
- 13 unindexed foreign keys; 30 unused indexes (review before adding/removing).

### 🟢 BUG-05 (Low) — enable leaked-password protection (HaveIBeenPwned) in Supabase Auth settings.

---

## 9. Observability, health & CSP

- **BUG-02 — health check lies.** `/api/health/ai` pings two **dead** models (`client.ts:1154-1155`: `llama-3.1-8b-instant`, `gemini-2.0-flash`) and maps the result to *all* models of that provider → reports **0 healthy** while 11/16 are actually live. Also `if (model.id.includes('2.5'))` (`~client.ts:1176`) brands the 3 live `gemini-2.5-*` models as "unknown/preview" via a brittle substring test. This is why the ops view screams total outage.
- **BUG-06 — CSP monitoring is 100% broken.** `next.config.ts:104` sets `report-uri /api/log-error?source=csp`, but browsers POST CSP reports as `{"csp-report":{…}}` / `[{type:"csp-violation",…}]`, and `log-error/route.ts` requires `error_message` → **every report 400s** (curl-confirmed both shapes; observed ×3 live on dashboard load). Add a `?source=csp` branch that maps the report body into a `client_error` insert.
- **BUG-07 — invalid CSP source.** `polly.*.amazonaws.com` (`next.config.ts:97,101`) is invalid (`*` only allowed as the left-most label) → browser ignores it (console error ×6/load). It's currently `Report-Only` so it doesn't block, but if promoted to enforcing it would break Polly (moot once AWS is removed — but clean it up: it's pure console noise now).
- **Next.js note:** the `middleware` file convention is deprecated in Next 16.1.7 → migrate to `proxy` (forward-compat, low priority).
- **Localhost logs:** the only recurring runtime error is the RAG embedding failure (BUG-13). Supabase edge_logs (24h) show only the 4xx from BUG-11/12 (+ my test probes); postgres/auth logs clean.

---

## 10. UI / UX — desktop & mobile

**Overall the UI is the healthiest part of the app.** No document-level horizontal overflow on mobile (375×812) for landing, dashboard, practice, settings, owner, or interview; inner pill/tab rows scroll intentionally. Desktop interview (1440) is a proper 3-panel IDE (problem + preview | begin | Monaco + Run + tests), Monaco loads, no overflow; ≤904/mobile switches to Problem/Voice/Code/Chat bottom tabs. Owner portal collapses to a hamburger + top bar on mobile. Dashboard's 5 tabs, PDF "Download Report" (generates a real blob), practice's 343-problem catalog + 4 modes + topic filters, settings, legal, login, 404 — all render correctly.

Smaller items:
- **BUG-01 (Low but embarrassing — it's the public landing page):** `src/app/page.tsx:406` has a raw `// @ts-expect-error -- automated unused local suppression` sitting in JSX children, so **React renders the comment as literal text** inside the "Interview Modes" card. Repo-wide scan: this is the only occurrence. Delete the line (or move it above the `.map`).
- **BUG-09 (Low):** doubled tab title `Diagnostic | AlgoMind | AlgoMind` — `learn/diagnostic/layout.tsx:17` sets `'Diagnostic | AlgoMind'` under a root template `'%s | AlgoMind'`. Set it to just `'Diagnostic'`.
- **WARN-10 (Low):** `/test-modal` dev route ships to production — remove or guard.
- **Mobile cosmetic (Low):** dashboard stat card clips "AM" at the right edge; fixed bottom nav overlaps the bottom of the "placement season" card (content isn't padded for the nav).
- **Inconclusive (needs manual check):** the owner mobile hamburger drawer's open/close could not be confirmed via automation (click actionability timed out; the nav links do exist off-canvas in the DOM). **Not asserting it's broken** — please tap it once on a real phone to confirm.

---

## 11. Prioritized action plan

### P0 — do now (security + "it's broken")
1. **BUG-04** — `REVOKE EXECUTE … FROM anon, authenticated`; re-grant narrowly; add `auth.uid()` guards; make destructive fns `service_role`-only. *(security)*
2. **BUG-16** — stand up a self-hosted Piston (or Judge0) and set `PISTON_URL` → restores "Run".
3. **BUG-13** — switch embeddings to `gemini-embedding-001` with `outputDimensionality: 768` (match the 768-dim corpus) and make Gemini the **primary** embedder → restores RAG.
4. **BUG-03 + BUG-02** — deactivate the 5 dead model rows, replace hardcoded dead IDs with live ones, fix the health ping → chat gets fast + health tells the truth.

### P1 — this week (correctness + reliability)
5. **BUG-18** — give the streaming path the same iterate-candidates failover as non-streaming.
6. **BUG-11 / BUG-12** — qualify the two broken RPCs; fix `from('users')`→`profiles` and `from('system_flags')`→`global_feature_flags`; stop swallowing `{error}`.
7. **BUG-19 + voice** — enable `echoCancellation` on the VAD mic; pick one orchestrator; wire or delete `InterruptionManager`; harden browser-TTS default; remove the fake Groq/Orpheus option.
8. **AWS removal (§7)** — start with S3/Transcribe (inert), then Polly, then Bedrock (after confirming Groq/Gemini capacity).

### P2 — cleanup & scale
9. **BUG-06 / BUG-07** — fix CSP report handler; fix/remove the invalid CSP source.
10. **PERF-DB** — wrap RLS `auth.uid()` in `(select …)`, consolidate permissive policies, drop dup/unused indexes, index the 13 FKs.
11. **BUG-01 / BUG-09 / WARN-10 / BUG-05** — delete the leaked JSX comment, fix the double title, drop `/test-modal`, enable leaked-password protection.
12. **Router/voice consolidation** — the deeper refactor in §3/§6: one model table, one router, one voice orchestrator. This is where "redevelop better" pays off — most of it is deletion.

---

## 12. What's genuinely good (so you keep it)
- Clean App-Router structure; TypeScript + ESLint both green.
- RLS on every table; strong API route-protection; correct 401s everywhere.
- Graceful-degradation *contracts* already exist (TTS `degraded_mode`, RAG "proceed without context", model self-deprecation) — the scaffolding for reliability is there; it just needs the live paths wired to it.
- The per-model **Verify** button in the owner Model Registry is correct (it caught the dead models accurately).
- Responsive, polished UI; working PDF export; a real 343-problem catalog.
- The *designs* you drifted away from (DB routing stage-plan, `InterruptionManager`) are good — the fix is to route through them, not replace them.

---

### Appendix — how each finding was proven
- **Provider truth:** live `GET` of Groq (`/openai/v1/models`) and Gemini (`/v1beta/models`) with your keys, diffed against configured models.
- **DB truth:** Supabase MCP — `pg_proc` + `has_function_privilege`, direct function execution, `information_schema`, RLS/`pg_policies`, security + performance advisors, edge/postgres/auth logs.
- **Runtime truth:** authenticated in-browser `fetch` of `/api/chat` (×3), `/api/execute`, `/api/voice/synthesize-polly`; anon `curl` of RPCs; `/api/health/ai`.
- **Code truth:** direct reads with file:line, plus two focused read-only code analyses of the AI and voice subsystems.
- **UI truth:** desktop (1440/904) + mobile (375×812) walkthrough with overflow measurement, console/network capture, and screenshots.
- **Not executed** (to protect production data): the destructive anon RPCs and all mutating owner controls — those findings are grant-verified + code-read, and explicitly labeled as such.
