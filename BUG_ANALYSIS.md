# AlgoMind — Pre-Demo Bug Analysis & Fix Plan
_Full codebase review completed March 5, 2026. No code changes made — this is the plan only._

---

## PRIORITY LEGEND
🔴 CRITICAL — will break or disqualify demo  
🟠 HIGH — serious quality issue judges will notice  
🟡 MEDIUM — polish / flow issues  
🟢 LOW — nice to have / verification items  

---

## 🔴 CRITICAL BUGS

---

### BUG-1 — Sprint Mode: Only 1 Problem Ever Loads
**Status:** Not fixed  
**Files:** `src/hooks/useInterviewLimits.ts` · `src/components/interview/InterviewSession.tsx` line 188

**Root cause:**
`InterviewSession.tsx:188` calls `(limits as any).resetTurns?.()` when Problem 1 ends.  
`useInterviewLimits` exports `reset()` — **not** `resetTurns()`.  
Optional chaining `?.()` makes this a silent no-op. Turns are never reset.

**Failure chain:**
1. Problem 1 hits 10 turns → `isTurnsUp = true`
2. Sprint transition fires, calls `startInterview()` for Problem 2
3. `isTurnsUp` is **still** `true` — reset was never called
4. The limit effect at line 595 fires immediately → shows "limit reached" modal on Problem 2
5. From the user's perspective: interview ends after 1 question

**This bug is paired with ISSUE-8 (see below).**

**Fix required — two parts:**

**Part A — `src/hooks/useInterviewLimits.ts`:**  
Add `resetTurns` to the `InterviewLimits` interface and export a new callback:
```ts
// In InterviewLimits interface:
resetTurns: () => void;

// In hook implementation (after the existing reset callback):
const resetTurns = useCallback(() => {
    setTurnsUsed(0);
    // NOTE: does NOT reset elapsedTime — sprint uses shared 45-min timer
}, []);

// In return object:
resetTurns,
```

**Part B — no change needed in `InterviewSession.tsx`:**  
Line 188 already calls `(limits as any).resetTurns?.()` — once Part A exports it, this will work correctly.

---

### BUG-2 — Kai Reads Raw Markdown Symbols Aloud (Browser TTS path)
**Status:** Not fixed  
**Files:** `src/hooks/useTTS.ts` lines 86 & 104 · `src/lib/voice/tts-preprocessor.ts`

**Root cause — two separate issues:**

**Issue A: Two TTS paths, only one preprocesses correctly**

| Path | Preprocessing |
|------|--------------|
| Polly (server) — `synthesize-polly/route.ts` | Calls `preprocessForTTS()` ✅ |
| Browser TTS (client) — `useTTS.ts` | Only does `text.replace(/[*_#\`~]/g, '')` ❌ |

When Polly is unavailable or the user is on a guest session (Polly returns 401), browser TTS reads markdown symbols verbatim.

**Issue B: `tts-preprocessor.ts` is missing critical patterns even for the Polly path**

| Input | Current TTS output | Should say |
|-------|--------------------|------------|
| `10^4` | "10 caret 4" | "10 to the power 4" |
| `n^2` | "n caret 2" | "n squared" |
| `- bullet text` | "dash bullet text" | "bullet text" |
| `(Takes a brief pause...)` | reads entire phrase aloud | silence |
| `1 <= n <= 10^4` | "1 less-equal n less-equal 10 caret 4" | "1 to 10 to the power 4 for n" |

**Fix required — two parts:**

**Part A — `src/hooks/useTTS.ts`:**  
Replace the raw `.replace()` in both `speak()` and `speakAndWait()` with a call to `preprocessForTTS`. Add the import at the top of the file:
```ts
// Add import:
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';

// In speak() — replace line ~86:
// Before: const cleaned = text.replace(/[*_#`~]/g, '').trim();
// After:  const cleaned = preprocessForTTS(text).trim();

// In speakAndWait() — replace line ~104:
// Before: const cleaned = text.replace(/[*_#`~]/g, '').trim();
// After:  const cleaned = preprocessForTTS(text).trim();
```

**Part B — `src/lib/voice/tts-preprocessor.ts`:**  
Add the following patterns to `TTS_REPLACEMENTS` **before** the Big O Notation block (order matters — specifics first):
```ts
// Parenthetical stage directions — strip before anything else reads them
[/\(([^)]{1,80})\)/g, ''],

// Bullet/list lines — strip leading dash or bullet at line start
[/^[-•]\s+/gm, ''],
[/^\*\s+/gm, ''],

// Constraint ranges with exponents — must come before plain constraint ranges
[/(\d+)\s*<=\s*([a-zA-Z._]+)\s*<=\s*(\d+)\^(\d+)/gi, '$1 to $3 to the power $4 for $2'],
// Plain constraint ranges
[/(\d+)\s*<=\s*([a-zA-Z._]+)\s*<=\s*(\d+)/gi, '$1 to $3 for $2'],

// Exponent notation — specifics before generic
[/10\^(\d+)/g, '10 to the power $1'],
[/n\^(\d+)/g, 'n to the power $1'],
[/\^\s*(\d+)/g, ' to the power $1'],    // generic fallback
```

---

### BUG-3 — Kai Dumps Full Markdown Problem Statement (Prompt Leak)
**Status:** Not fixed  
**Files:** `src/lib/interview/interviewer-prompt.ts` lines 303 & ~576 (opening trigger function)

**Root cause — two layers:**

**Layer A: Opening trigger instructs Kai to fully reproduce the problem**

In `generateInterviewOpeningTrigger()`:
```ts
// Current (problematic):
return `Introduce the problem "${problemTitle}" to the candidate now. 
Warm, professional opening. State the problem clearly and completely. ...`
```
"State the problem clearly and completely" → Kai outputs the full problem statement verbatim, including `**bold**`, `- bullets`, `<=` notation, and raw constraints.

Also in the employer `behaviourBlock` (line ~303):
```ts
// Current (problematic):
"If the candidate asks for clarification on the problem, restate the problem statement verbatim only."
```
"Verbatim" = raw markdown output.

**Layer B: No voice-format rules in the system prompt**  
The system prompt has zero instructions telling Kai:
- Never use markdown formatting
- Never use parenthetical stage directions like `(pauses)`
- Responses are spoken aloud, not displayed as text

Result: Kai writes like a screenplay — `(Takes a brief pause for the candidate to read and ask questions)`.

**Fix required — three parts in `src/lib/interview/interviewer-prompt.ts`:**

**Part 1 — Add `VOICE OUTPUT RULES` block at the top of `generateInterviewerSystemPrompt()`:**  
Insert immediately after the role declaration and before `${guestNote}`:
```
## VOICE OUTPUT RULES — MANDATORY
You are speaking aloud through a text-to-speech engine. Every word you write will be read out verbatim.

STRICTLY FORBIDDEN:
- NO markdown: no **, *, _, #, backticks, ---, bullet points, numbered lists, headers
- NO parenthetical stage directions: (pauses), (smiles), (leans forward), etc.
- NO code blocks — describe code concepts verbally instead
- DO NOT recite the problem statement verbatim — introduce it conversationally

REQUIRED FORMAT:
- Plain spoken sentences only, as you would say them in a room
- Constraints spoken out: "less than or equal to" not "<=", "to the power of" not "^"
- Keep responses concise — this is a voice channel, not a document
```

**Part 2 — Fix `generateInterviewOpeningTrigger()`:**
```ts
// Change "State the problem clearly and completely" to:
return `Introduce the problem "${problemTitle}" to the candidate now. 
Warm, professional opening. Describe the problem conversationally — do NOT recite 
the problem statement verbatim or use markdown. Explain the goal, mention one 
example naturally, and highlight the key constraint in spoken language. 
Invite clarifying questions.`;
```

**Part 3 — Fix employer "verbatim" instruction (line ~303):**
```ts
// Change:
"restate the problem statement verbatim only."
// To:
"summarize the key objective and constraints clearly in plain spoken language."
```

---

### BUG-4 — Polly Returns 401 for Unauthenticated/Guest Sessions
**Status:** Not fixed — decision required  
**File:** `src/app/api/voice/synthesize-polly/route.ts` lines 20-21

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Impact:**  
If the demo is shown to judges using any guest/unauthenticated flow, Polly silently fails and falls back to browser TTS. The fallback response body currently lacks `"fallback": "browser"`, so the client receives a plain 401 and may not handle it gracefully.

**Two fix options:**

**Option A (Recommended for demo — zero code change):**  
Always use an authenticated owner account. Never show guest flow to judges unless you have verified browser TTS quality is acceptable.

**Option B (Code change — if guest flow must work):**  
Add `fallback: 'browser'` to the 401 response so the client degrades cleanly:
```ts
if (!user) return NextResponse.json({ error: 'Unauthorized', fallback: 'browser' }, { status: 401 });
```
Do NOT remove the auth check entirely — that opens unlimited Polly cost to anyone.

---

## 🟠 HIGH — BEDROCK MODEL VERIFICATION

---

### ISSUE-5 — Bedrock Model IDs Need Verification
**Status:** Manual action required — no code fix  
**Files:** `src/lib/ai/bedrock-client.ts` · `model_routing` table in Supabase

The Bedrock client is DB-driven — model IDs come from the `model_routing` table, not hardcoded. The IDs in that table need verification.

| Model | Suspected ID in DB | AWS Bedrock format | Status |
|-------|------------------|-------------------|--------|
| OSS 120b | `openai.gpt-oss-120b-1:0` | Cross-inference prefix required | ⚠️ Needs verification |
| Haiku 4.5 | `anthropic.claude-haiku-4-5` | Correct format: `anthropic.claude-haiku-4-5-20251001-v1:0` | ❌ Likely wrong |
| Sonnet 3.5 | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Matches standard format | ✅ Likely correct |

**Actions:**
1. AWS Console → Bedrock → Foundation Models → confirm all 3 are **Access granted** in your region
2. Owner Dashboard → Model Config → verify exact IDs match what AWS shows
3. Note: `InvokeModelCommand` (non-streaming) is used — Bedrock responses have a full-request latency before Kai speaks. Ensure `AWS_BEDROCK_REGION` is set to minimize latency

---

### ISSUE-6 — AWS Transcribe Is Batch-Only (Not a Live Demo Issue)
**Status:** No fix needed — informational  
**File:** `src/lib/aws/transcribe.ts`

AWS Transcribe in this codebase is **post-interview batch processing only** (speaker diarization, accuracy enrichment). It is **not** in the real-time interview flow.

Real-time STT pipeline is:
```
Silero VAD (browser) → Groq Whisper → /api/voice/transcribe → transcript
```
AWS Transcribe has zero impact on the live demo experience. Nothing to fix.

---

## 🟡 MEDIUM — FLOW & QUALITY ISSUES

---

### ISSUE-7 — TTS Preprocessor Missing Patterns (Defence-in-Depth)
**Status:** Not fixed — covered by BUG-2 Part B above  
**File:** `src/lib/voice/tts-preprocessor.ts`

Even after fixing BUG-3 (Kai prompt rules), sprint mode edge cases and any future prompt changes could let symbols leak through. The preprocessor is the last line of defence and should cover all cases. See BUG-2 Part B for the exact patterns to add.

---

### ISSUE-8 — Sprint Timer Must Not Reset on Problem 2 Transition
**Status:** Not fixed — paired with BUG-1 above  
**File:** `src/components/interview/InterviewSession.tsx` lines 188-189

After BUG-1 is fixed by adding `resetTurns()` to `useInterviewLimits`, this issue is automatically resolved — because:

- `reset()` resets **both** `turnsUsed` AND `elapsedTime` to 0
- `resetTurns()` resets **only** `turnsUsed` to 0, leaving the timer running
- Sprint is 45 minutes **total shared budget** — the timer must keep running through both problems
- `InterviewSession.tsx:188` already calls `resetTurns?.()` — it just needs the method to exist

**No change needed in `InterviewSession.tsx` itself** — only the `useInterviewLimits` addition from BUG-1 is required.

---

### ISSUE-9 — Chat Route: Misleading `preferredModel` Comment
**Status:** Not fixed — cosmetic, no runtime impact  
**File:** `src/app/api/chat/route.ts` line ~103

```ts
preferredModel: 'gemini' as any, // Start with fastest Gemini, fall to Groq automatically
```

The comment is incorrect when `ENABLE_AWS_BEDROCK` is `true`. In that case Bedrock is tried first regardless of this value (the flag check precedes DB routing). The comment should read:

```ts
// Ignored when Bedrock flag is enabled (Bedrock is tried first); 
// fallback hint for DB-driven routing only
```

No runtime bug — misleading comment only.

---

### ISSUE-10 — Demo Tour: Verify Data-Tour Attribute Coverage
**Status:** Verification required — no code fix identified  
**File:** `src/lib/tour/index.ts`

Tour auto-trigger is already disabled. Manual verification of each step's `data-tour` target is needed.

| Tour Step | Attribute | Element Found In Codebase | Status |
|-----------|-----------|--------------------------|--------|
| Step 1 | `home-hero-cta` | `src/app/page.tsx:205` | ✅ |
| Step 2 | `difficulty-mode-selector` | `src/components/practice/DifficultyModeSelector.tsx:79` | ✅ |
| Step 3 | `problem-list` | `src/app/practice/page.tsx:292` | ✅ |
| Step 4 | `problem-panel` | `src/components/interview/InterviewSession.tsx:692` | ✅ |
| Step 5 | `begin-button` | `src/components/interview/InterviewSession.tsx:783` | ✅ |
| Step 6 | `language-select` | `src/components/interview/CodeEditor.tsx:203` | ✅ |
| Step 7 | `cognitive-profile` | `src/app/dashboard/page.tsx:226` | ✅ |
| Step 8 | `performance-insights` | `src/components/dashboard/StatsOverview.tsx:86` | ✅ |
| Step 9 | `journey-progress` | `src/components/dashboard/SessionTimeline.tsx:30` | ✅ |
| Step 10 | `history-list` | `src/app/dashboard/page.tsx:326` | ✅ |
| Step 11 | `insights` | `src/components/dashboard/InsightsPanel.tsx:54,68` | ✅ |
| Step 12 | `voice-capabilities` | `src/components/settings/VoiceSettings.tsx:154` | ✅ |

All `data-tour` attributes are present in the DOM. Manual walkthrough still recommended to verify routing and element visibility in each step.

---

### ISSUE-11 — `CampaignInterviewSession` Has Mode Mismatch
**Status:** Not fixed — enterprise path only  
**File:** `src/components/enterprise/CampaignInterviewSession.tsx` line 400

```ts
config: { mode: 'employer', difficultyMode: 'practice' } as any,
// Disabled for simplicity in multi-question, or hook up settings
```

`mode: 'employer'` and `difficultyMode: 'practice'` are contradictory. The `as any` cast suppresses the type error. In employer mode surveys, the system prompt will be built with practice-mode behaviour blocks instead of employer-mode blocks. This affects scoring logic and hint rules in employer campaign sessions.

**Not a demo blocker** unless the employer campaign flow is part of the demo. Flag for post-demo cleanup.

---

## 🟢 LOW — PRE-DEMO CHECKLIST

These are not bugs — they are verification items:

- [ ] Owner Dashboard → `ENABLE_AWS_BEDROCK = true`
- [ ] Owner Dashboard → `ENABLE_AWS_POLLY_TTS = true`
- [ ] Owner Dashboard → `ENABLE_WHISPER_STT = true`
- [ ] `AWS_BEDROCK_REGION` env var set correctly (verify latency from your deployment region)
- [ ] All 3 Bedrock model IDs verified live against AWS Console
- [ ] `model_routing` table: Bedrock model priorities lower (higher priority) than Groq/Gemini fallbacks
- [ ] Sprint mode: select two different easy problems, confirm both load and Problem 2 starts
- [ ] Polly voice: confirm "Kajal" (Indian English Neural) appears as active voice in settings
- [ ] Kajal is available in both `ap-south-1` and `us-east-1` — no region switch needed
- [ ] Full candidate flow: login → select problem → sprint mode → P1 → P2 → analysis → FSRS queue
- [ ] Analysis page: 8-dimension radar chart renders correctly with real session data
- [ ] PDF export: generate from a real completed session
- [ ] Demo account is authenticated (not guest) before presenting to judges — required for Polly

---

## ADDITIONAL BUGS FOUND DURING REVIEW

---

### BUG-5 — `LearnSessionClient` Speaks Hindi Intro Without Preprocessing
**Status:** Not fixed  
**File:** `src/app/learn/LearnSessionClient.tsx` line ~64

```ts
const introMsg = `Namaste! Main Kai hoon, aapka DSA tutor. Aaj hum ${problem.title} samjhenge.`;
if (voice.speak) voice.speak(introMsg);
```

This calls `voice.speak()` directly (the `LearnSession` hook's thin wrapper) **not** `useTTS`. The problem title injected here (e.g. "Two Sum", "Longest Substring Without Repeating Characters") passes through with no preprocessing. If the title contains special characters or numbers it will be poorly pronounced.

More critically, this path **bypasses the entire `useTTS` hook**, so even after BUG-2 is fixed, this call will not benefit from `preprocessForTTS`. It uses the browser `SpeechSynthesis` API directly.

**Fix:** Apply `preprocessForTTS` to `introMsg` before passing it to `voice.speak`, or ensure the LearnSession voice wrapper calls `preprocessForTTS` internally.

---

### BUG-6 — `useInterview` Has Its Own Duplicate Round/Time Limit System
**Status:** Not fixed  
**File:** `src/hooks/useInterview.ts` lines 94-95, 470-471

```ts
const INTERVIEW_MAX_ROUNDS = options.config.maxTurnsPerProblem;
const INTERVIEW_MAX_MS = options.config.maxDurationMs;
// ...
const roundLimitHit = newRoundCount >= INTERVIEW_MAX_ROUNDS;
const timeLimitHit = elapsedMs >= INTERVIEW_MAX_MS;
```

`useInterview` maintains its own internal round counter (`roundCount`) and checks limits independently of `useInterviewLimits`. This means there are **two separate limit systems** running in parallel during a session:

1. `useInterviewLimits` (in `InterviewSession.tsx`) — drives the visible UI timer and the sprint transition effect
2. `useInterview`'s internal `roundCount` / `elapsedMs` — drives `isLimitReached` and `SUBMIT_SOLUTION` transition

If these two systems drift out of sync (e.g. turns are reset in one but not the other), one system may show the session as ongoing while the other has already triggered termination. After BUG-1 is fixed, the `resetTurns` call resets `useInterviewLimits.turnsUsed` but does **not** reset `useInterview`'s internal `roundCount`. This could cause `isLimitReached` to fire on Problem 2 before the new 10-turn budget is used.

**Fix:** In `startInterview()` inside `useInterview.ts`, reset `roundCount` to `0` and `interviewStartTime` to `Date.now()` whenever the function is called for a sprint problem 2 transition (detectable via `sprintProblemIndex === 1`).

---

## RECOMMENDED ATTACK ORDER

Fix in this exact sequence — each is independent, no merge conflicts:

| # | File | Issue | Estimated Time |
|---|------|-------|----------------|
| 1 | `src/hooks/useInterviewLimits.ts` | Add `resetTurns` export (BUG-1 + ISSUE-8) | 10 min |
| 2 | `src/lib/interview/interviewer-prompt.ts` | Add VOICE OUTPUT RULES + fix opening trigger + fix employer verbatim (BUG-3) | 20 min |
| 3 | `src/lib/voice/tts-preprocessor.ts` | Add 7 missing patterns (BUG-2 Part B + ISSUE-7) | 10 min |
| 4 | `src/hooks/useTTS.ts` | Use `preprocessForTTS` in both speak paths (BUG-2 Part A) | 10 min |
| 5 | `src/hooks/useInterview.ts` | Reset internal `roundCount` on sprint P2 start (BUG-6) | 15 min |
| 6 | Supabase DB | Verify/fix Bedrock model IDs in `model_routing` table (ISSUE-5) | 15 min |
| 7 | Owner Dashboard | Manual Bedrock model test + verify all three flags | 10 min |

**Total: ~90 minutes of focused work**

---

## THE THREE THINGS JUDGES WILL DEFINITELY EVALUATE

1. **Kai's voice quality** — If Kai speaks clean sentences with no `**bold**`, no `(pauses)`, no `10 caret 4`, that alone demonstrates production quality. BUG-3 + BUG-2 directly protect this.

2. **Sprint mode working end-to-end** — Two problems loading cleanly, timer running through both, smooth transition. BUG-1 is the single most likely demo-killer.

3. **Bedrock powering responses** — Visible in the model badge on the UI. ISSUE-5 verification is required before demo day.
