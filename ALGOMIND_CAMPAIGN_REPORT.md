# AlgoMind — Mock-Interview Campaign: Consolidated Findings Report

**Date:** 2026-09-13  **Runs:** 50/50 completed (0 failures)  **Wall-clock:** 12.3 min
**Fleet:** 3-way concurrency, 4-key Gemini pool for candidate simulation
**Target:** live production Supabase (`wfdgsmhuglmrxcmwcylz`) via the real app endpoints

> Every "candidate" was an LLM role-playing a persona, driving the **real** app endpoints
> (`/api/chat`, `/api/interview/analyze`, save action, `/api/learn/*`) as an authenticated
> throwaway QA account. The platform (Kai + analyzer + DB + FSRS + knowledge graph) is what
> was under test. Test data is **retained** (not deleted) for re-runs / transcript review.

---

## 1. Executive summary

The core interview loop is **solid and shipped-quality**: across 50 runs there were **zero**
"I'm having trouble connecting" failures, **zero** empty replies, **100%** of assessments produced
real feedback, and score calibration cleanly separates candidate quality (adversarial 1.0 →
professional 7.4). Report-card suggestions are **specific and tailored, not generic** — the earlier
"generic report" you flagged was a symptom of the since-fixed analyzer truncation.

Two **pre-existing, silent, core-feature bugs** were root-caused and then confirmed at scale:

1. **Learn diagnostic onboarding has been 500-ing since ~May 2026** (double-encoded RPC argument) — 14/14 diagnostics failed.
2. **Interview completion never writes knowledge-graph mastery** (an RPC guard rejects the service role) — 0/36 interviews updated `concept_states`.

Neither blocks the interview itself, which is why they went unnoticed — but together they mean the
**knowledge graph is effectively populated only by completed Learn concept-sessions**, and the Learn
survey silently drops the learner into a fallback concept.

---

## 2. What works — verified at scale

| Area | Result | Evidence |
|---|---|---|
| **Interview chat reliability** | 0 "trouble connecting", 0 empty replies across 237 turns | rollup `troubleConnecting:0, emptyReplies:0` |
| **Assessment produced** | 100% have real overall feedback | `pctHasFeedback: 100` |
| **Evidence coverage** | 97% of assessments cite evidence in all 8 skills | `pctAll8Evidence: 97` |
| **Report-card quality** | Suggestions tailored to the actual problem + candidate quotes | §6 samples |
| **Score calibration** | Clean persona separation | §5 |
| **Hire-decision spread** | NO_HIRE 13 / BORDERLINE 5 / HIRE 15 / STRONG_HIRE 3 | rollup `hireDist` |
| **FSRS spaced repetition** | Scheduling + advancement + due surface all work | §5 |
| **Learn concept-session** | 14/14 sessions completed + saved; 12/12 non-abandon had real notes | rollup + scorecards |
| **Analyzer model** | `gemini-3.1-flash-lite` served all 36 assessments reliably | scorecard `modelUsed` |

---

## 3. Findings (priority-ranked)

### 🔴 P1-A — Learn diagnostic onboarding 500s (double-encoded RPC arg) — **14/14 runs**
- **File:** `src/lib/knowledge-graph/service.ts` → `initializeFromDiagnostic()` (~line 184).
- **Cause:** calls `initialize_concept_states` with `p_results: JSON.stringify(payload)` — a JSON
  **string scalar**, but the SQL function needs a JSON **array**. Postgres throws
  `22023 "cannot get array length of a scalar"`. The endpoint's fallback path also throws → HTTP 500.
- **Proof:** `p_results: JSON.stringify(array)` → error 22023; `p_results: array` → OK. Identical
  error chain present in `system_events` at **2026-05-28** (long-standing).
- **Impact:** the diagnostic MCQ survey (the entry point of Learn mode) never seeds the knowledge
  graph; `nextRecommendedConcept` is null; learner is dropped into a fallback concept.
- **Fix (1 line):** pass the array — `p_results: payload`.

### 🔴 P1-B — Interviews never update knowledge-graph mastery (over-strict RPC guard) — **0/36 runs**
- **File:** `src/lib/knowledge-graph/service.ts` → `onInterviewSessionCompleted()` (~line 272),
  calls `upsert_concept_states_batch` via the **service client**.
- **Cause:** the SQL function's ownership guard raises `42501 "Unauthorized: caller does not own this
  user_id"`. The service role has `auth.uid() = NULL` and the guard has **no `service_role`
  exemption** (unlike `initialize_concept_states`, which allows it). The error is swallowed
  (`console.error + return`), so the save still "succeeds" and the failure is invisible.
- **Proof:** every completed interview → `concept_states` count stayed **0** (`practiceRunsWithConceptStates: 0/36`).
- **Impact:** the knowledge graph / concept-mastery never advances from interviews. (This is the root
  cause of the earlier "concept_states stays 0 after a practice save" observation.) FSRS review
  scheduling is a **separate** system and is unaffected.
- **Fix:** add `OR auth.role() = 'service_role'` to the function's guard (mirror `initialize_concept_states`).

### 🟠 P2-C — Ceiling clustering: strong candidates get uniform skill scores
- **Observed:** `p-professional-practice-full-i2` and `p-professional-crunch-full-i1` (9 turns each,
  strong) received **8/8/8 across all 8 skills** — no differentiation — even though the prose feedback
  was rich and specific. 19% of assessments were undifferentiated overall (also includes correctly
  floored adversarial=1 and short-session caps).
- **Impact:** a strong candidate's report card shows no relative strengths/weaknesses. Prose is good;
  the numeric radar is flat at the top end.
- **Suggested fix:** in the analyzer prompt, require differentiation even for strong candidates
  (force a spread / "rank your top-2 and bottom-2 dimensions").

### 🟠 P2-D — Interviewer leaks internal assessment template + `TERMINATE_INTERVIEW` into chat — **8/36 runs**
- **Observed:** Kai emitted its end-of-interview scaffold (`**Overall Assessment**`,
  `**Dimensional Scores**`, `**Hire Decision**`) and the control token `TERMINATE_INTERVIEW` directly
  into the visible chat stream (esp. edge personas + wrap-up turns).
- **Runs:** adversarial ×2, fresher ×2, gibberish, newbie, professional ×2.
- **Impact:** the candidate sees internal scoring scaffolding and a raw control token in the transcript.
- **Suggested fix:** strip `TERMINATE_INTERVIEW` (and any "Dimensional Scores/Hire Decision" block)
  from streamed chat output server-side; reinforce in the interviewer prompt that scoring happens only
  in the separate analyze step.

### 🟠 P2-E — Repo/DB drift on SECURITY DEFINER functions
- `upsert_concept_states_batch`'s ownership guard exists in the **live DB** but in **no tracked
  migration** — a fresh rebuild from `supabase/migrations/` would not reproduce it (masking P1-B in CI).
- The model-registry DB changes (deactivating dead Gemini models, adding `gemma-4-26b`) were applied
  via MCP earlier and also lack migration files.
- **Suggested fix:** dump live function/DDL state into migrations to restore repo/DB parity.

### 🟡 P3 — Smaller findings
- **F1 — Short-session cap leaks into user-facing feedback:** e.g. *"This was a brief session — scores
  capped at 6 due to limited evidence."* Internal calibration mechanic surfaced to the candidate.
- **F2 — `difficultyMode` not sent to `/api/chat`:** the interviewer prompt is always built as
  `'practice'` server-side; the warm-up/crunch/sprint mode only affects the client + the saved record,
  not Kai's behavior during the interview.
- **F3 — `adjustedScore` diverges upward from `overallScore`** (e.g. adj 9.43 vs overall 8.2; adj 9.2
  vs 8.0) — two scores that trend apart may confuse users about which is "the" score.
- **F4 — Chat telemetry gap:** the `/api/chat` SSE `done` event reports `modelUsed: "auto"` (the
  selector) rather than the concrete model that served — can't tell Groq vs Gemini from logs.
- **F5 — Markdown bold `**…**` in interviewer messages** (6/36) despite the "plain speech, no markdown"
  instruction — voice-relevant (TTS sanitizer strips `*`, so likely inaudible, but the rule isn't honored).
- **F6 — Learn results endpoint `confidenceDelta` mismatch:** results returned `0` while the live
  concept-end returned `0.15` for the same session (results recomputes from stored `kai_assessment`).

---

## 4. Latency (under 3-way concurrency)

| Metric | p50 | p90 | max |
|---|---|---|---|
| Interview chat — time to first byte | 2,640 ms | 3,805 ms | 8,910 ms |
| Interview chat — total | 2,804 ms | 4,361 ms | 9,276 ms |
| Learn tutor — total | 2,473 ms | 5,321 ms | 7,340 ms |

TTFB p50 ~2.6 s is higher than a single-run baseline (~1 s) because three interviews shared the
single Groq key + free-tier limits, engaging cross-provider fallback. Acceptable for a test fleet;
real single-user latency is lower. (F4 above prevents attributing turns to Groq vs Gemini precisely.)

---

## 5. Calibration, FSRS, and Learn flow

**Score calibration by persona (avg overall):**

| Persona | Avg | Reads as |
|---|---|---|
| Edge: Adversarial | 1.0 | correctly floored (gaming, no substance) |
| Edge: Gibberish | 2.3 | correctly very low |
| Edge: Wrong-but-confident | 3.2 | correctly low (confident ≠ correct) |
| Newbie | 4.0 | low-mid, guided-only |
| Edge: Terse-correct | 4.7 | mid (analyzer extracted signal from sparse answers) |
| Fresher | 6.6 | solid mid-high |
| Professional | 7.4 | high |

**FSRS (spaced repetition) — works end-to-end:**
- 37 problem-level cards + 64 skill-level cards across QA users; **all** have due dates and stability > 0.
- **56 skill cards reached reps ≥ 2** with due dates pushed out to October — i.e. stability advances
  across repeated sessions (the core FSRS behavior).
- `get_due_reviews` RPC returns the near-term due items → the dashboard "Review Due" surface works.
- No lapses yet (expected — no failed re-reviews were driven). FSRS math + DB integration also covered
  by the passing unit/integration suite.

**Learn flow:**
- 14/14 concept sessions completed and saved; `concept_states` updated via the concept path.
- 12/12 non-abandon runs produced real assessment notes; the 2 "no-notes" runs were the **abandon**
  variants (correct — abandoned sessions don't assess).
- Diagnostic: **14/14 returned 500** (P1-A). Sessions still ran via fallback concept.
- Edge variants behaved: `skip-diagnostic` started a concept session without a prior diagnostic
  (soft gate — worth deciding if that should be blocked); `abandon` left an active session (no assess).

**Knowledge graph:** 0/36 interviews populated `concept_states` (P1-B).

---

## 6. Report-card quality — real vs generic (your key concern)

Verdict: **real and tailored.** Samples (verbatim):

- **Professional (8.2, STRONG_HIRE)** — next steps: *"Explore parallel processing techniques for
  scenarios where the hash map exceeds single-node memory limits"*, *"Review advanced techniques for
  handling integer overflow in large-scale summation problems"* — specific to the 4-Sum problem solved.
- **Newbie (4.2, NO_HIRE)** — next steps: *"Review graph traversal (BFS vs DFS) for grid-based
  problems"*, *"Practice manual tracing of algorithms on small test cases"* — tied to the
  Pacific-Atlantic problem; per-skill improvements were differentiated (5/3/5) with real quotes.
- **Fresher (6.8, HIRE)** — skills well-differentiated (6.8 / 6.75 / 7.05); next steps:
  *"Study space-optimized DP (rolling arrays or in-place updates)"* — specific to the min-cost-path DP.

Evidence fields quote the candidate's actual words, and improvements are concrete. The two quality
caveats are **P2-C** (numeric flatness at the top end) and **F1** (cap message leaking into prose).

---

## 7. Recommended fix order

1. **P1-A** (1-line): `initialize_concept_states` arg → restores Learn onboarding.
2. **P1-B** (guard exemption): `upsert_concept_states_batch` → restores KG mastery from interviews.
3. **P2-E**: capture live DDL into migrations (prevents both P1s from silently returning / hiding in CI).
4. **P2-C / P2-D**: analyzer differentiation + strip internal template/token from chat.
5. **P3 batch**: F1–F6 as polish.

Plus the pending security/perf DDL: **migrations 01 (RPC grant lockdown) + 07 (RLS auth-wrap)** are
**not currently in force** (73 unwrapped policies, 27 anon-executable SECURITY DEFINER functions). A
corrected, paste-ready, idempotent SQL file is provided at
[`APPLY_SECURITY_MIGRATIONS_01_07.sql`](APPLY_SECURITY_MIGRATIONS_01_07.sql) (the staged 01 was a
no-op as written; 07 used Postgres-unsupported regex lookbehind — both fixed).

---

## 8. Data locations

- Per-run artifacts: `campaign-results/<runId>/` → `transcript.json`, `assessment.json`, `scorecard.json`, `run.log`
- Aggregate: `campaign-results/rollup.json`  •  live log: `campaign-results/progress.ndjson`
- Working findings log: `campaign-results/FINDINGS.md`
- Harness: `campaign/` (config, harness, personas, run-practice, run-learn, run-campaign)
- Matrix: 36 practice (warm-up/practice/crunch/sprint × full/short/oneturn × 7 personas + edge/specials) + 14 learn (full/abandon/skip-diagnostic)
- Test accounts (retained): `qa-{newbie,fresher,professional,adversarial,wrongconf,terse,gibberish}@algomind.test`
