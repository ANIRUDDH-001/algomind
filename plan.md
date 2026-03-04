# AlgoMind — Unified Implementation Plan

> Written: 2026-03-04
> Priority: Interview Experience → Post-Interview Analysis → Flags/Auth → API/Server
> Source files: plan.md (investigation), phase-1/2/3 (flags+auth), VOICE_SYSTEM_PLAN.md

---

## Table of Contents

1. [Phase A — Interview Experience Fixes](#phase-a--interview-experience-fixes)
   - A1: AI Message Looping / TTS Repeat Fix
   - A2: Mic Stays On in Background
   - A3: Code Writing + Interview Integration
   - A4: Voice System Overhaul (deletions, bugfixes, ZoomTranscript)
   - A5: Interview Hard End Enforcement
   - A6: Guest User Limits (10 min / 10 turns)
2. [Phase B — Post-Interview Analysis Fixes](#phase-b--post-interview-analysis-fixes)
   - B1: Scoring Failure (All 0/10 or 5/10)
   - B2: Minimum Turn Threshold (2 turns, quality over quantity)
   - B3: Two Analysis Views (practice analysis + assessment complete)
   - B4: FSRS / Spaced Repetition Integration on Analysis Page
   - B5: History Tab → Static Transcript Page
   - B6: Replay Route Fix + Fallback
3. [Phase C — Model Routing & AI Tiers](#phase-c--model-routing--ai-tiers)
   - C1: New `model_routing` DB Table + Schema
   - C2: Owner Dashboard — Model Routing Tab
   - C3: DB-Driven Model Selection (remove hardcoded models)
   - C4: Cross-Tier Fallback (chat ↔ analysis)
   - C5: Bedrock Preparation
4. [Phase D — Feature Flags & DB Foundation](#phase-d--feature-flags--db-foundation)
   - D1: Fix Owner PATCH Route (wrong Redis key, no upsert)
   - D2: Fix `check_is_admin` / `is_admin` search_path
   - D3: Seed Missing Flag Rows
5. [Phase E — Permissions & Co-owner Unification](#phase-e--permissions--co-owner-unification)
   - E1: Fix Co-owner RLS Policies
   - E2: Backfill `co_owners.user_id`
   - E3: Auto-link Triggers
   - E4: Standardize `isOwnerOrCoOwner()` + Middleware
   - E5: Fix `get_my_permissions()` + `global_feature_flags` RLS
6. [Phase F — Auth Redundancy & Tab Session](#phase-f--auth-redundancy--tab-session)
   - F1: Session Cache Module
   - F2: AuthProvider Refactor (single subscription)
   - F3: Gut `useSessionPersistence`
   - F4: Middleware Smart Validation (JWT decode)
   - F5: `useAdmin` — Use AuthProvider Context
   - F6: `useGlobalFeatureFlag` — Visibility Gate
7. [DB Schema Changes Summary](#db-schema-changes-summary)
8. [Key Files Map](#key-files-map)

---

## Phase A — Interview Experience Fixes

> Priority: 🔴 HIGHEST — fix what users experience during a live interview
> Prerequisite: None. Start immediately.

---

### A1: AI Message Looping / TTS Repeat Fix ✅ DONE (PR-1)

**Problem**: AI says 10 lines, gets to line 5-6, then restarts from line 1 endlessly.

**Root Causes (3 vectors)**:

| Vector | Severity | Mechanism |
|--------|----------|-----------|
| `isProcessing=false` before TTS | HIGH | `setIsProcessing(false)` fires at line ~378 in `useInterview.ts` BEFORE `speakAndWait()`. During TTS playback, the auto-submit useEffect's guard (`isProcessing`) is gone. VAD picks up TTS audio → transcript generated → auto-submit → new AI call → loop. |
| Browser TTS 30s timeout | HIGH | Long AI responses exceed the browser `SpeechSynthesisUtterance` 30s safety timeout. `speakAndWait` retries up to 3x, each starting from beginning → "gets to line 5-6 then circles back". |
| VAD smart-pause false positive | MEDIUM | TTS audio leaks into mic → VAD detects as "speech" → triggers `tts.stop()` → interrupts AI → mic activates → loop. |

**Fixes**:

1. **Move `setIsProcessing(false)` to AFTER `speakAndWait` completes** in `useInterview.ts`:
   ```
   BEFORE: setIsProcessing(false) → await speakAndWait(text)
   AFTER:  await speakAndWait(text) → setIsProcessing(false)
   ```

2. **Chunk long TTS messages by sentence** in `useTTS.ts`:
   - Split text on sentence boundaries (`. `, `? `, `! `)
   - Speak each chunk sequentially via `speakAndWait`
   - Each chunk stays under 30s browser limit
   - If Polly is available, skip chunking (Polly has no 30s limit)

3. **Add TTS echo guard**: When `isSpeaking=true`, hard-reject any VAD/transcript events at the source (not relying on React state timing):
   ```typescript
   // In VAD onSpeechEnd callback:
   if (isSpeakingRef.current) return; // synchronous ref, not async state
   ```

4. **Add message deduplication**: In `submitUserResponse`, skip if last user message is identical to new one within 3 seconds.

**Files**:
- `src/hooks/useInterview.ts` — fix isProcessing timing, add dedup, add echo guard
- `src/hooks/useTTS.ts` — add sentence chunking
- `src/lib/voice/tts-engine.ts` — expose chunk support

**Verification**:
- Start interview with a medium-difficulty problem
- Let KAI speak a long response (10+ sentences)
- Confirm: KAI completes full response without repeating
- Confirm: no auto-submit fires during TTS playback
- Confirm: VAD does not trigger on TTS audio

---

### A2: Mic Stays On in Background ✅ DONE (PR-1)

**Problem**: Chrome mic indicator (top-left) stays on after interview ends or while KAI speaks.

**Root Causes**:
1. `endInterview()` calls `stopListening()` but never calls `track.stop()` on the raw MediaStream
2. React render cycle delay between `setMicIntent('off')` and the useEffect that actually stops hardware
3. On interview end/page navigation, the underlying `getUserMedia()` stream is never released

**Fixes**:

1. **Explicit MediaStream release on interview end**:
   ```typescript
   // In endInterview() — useInterview.ts:
   setMicIntent('off');
   stopListening();
   stopSpeaking();
   // NEW: kill the raw hardware stream
   if (mediaStreamRef.current) {
       mediaStreamRef.current.getTracks().forEach(t => t.stop());
       mediaStreamRef.current = null;
   }
   ```

2. **useEffect cleanup on unmount** in STT and VAD hooks — call `track.stop()` on all active tracks.

3. **Synchronous mic kill** for `paused-for-ai` — instead of relying on a deferred useEffect, immediately stop STT and VAD using refs:
   ```typescript
   // Synchronous, not state-driven
   sttRef.current?.abort();
   vadRef.current?.pause();
   ```

**Files**:
- `src/hooks/useInterview.ts` — add explicit MediaStream cleanup
- `src/hooks/useSTT.ts` — add track.stop() on cleanup/destroy
- `src/hooks/useVAD.ts` or VAD manager — ensure proper teardown
- `src/components/interview/InterviewSession.tsx` — cleanup on unmount

**Verification**:
- Start interview → speak → end interview → Chrome mic icon disappears
- Start interview → KAI speaks → mic icon disappears during KAI's turn
- Navigate away from interview page → mic icon disappears

---

### A3: Code Writing + Interview Integration ✅ DONE (PR-11, commit ab2fe96)

**Problem**: KAI asks for code but keeps talking while user writes. No pause, no code awareness.

**Current state**: Code editor is a passive panel. No state signal for "user is coding". Silent Observer runs on 15s interval but only checks conversation signals, not code.

**Fixes**:

1. **Add `user-coding` state to interview state machine**:
   ```
   States: idle → problem-intro → user-thinking ⟷ ai-clarifying → 
           user-solving ⟷ ai-feedback → user-coding → solution-review → 
           assessment → completed
   ```
   New transitions:
   - `USER_STARTED_CODING`: from `user-solving` or `ai-feedback` → `user-coding`
   - `USER_SHARED_CODE`: from `user-coding` → `ai-feedback`
   - `USER_STOPPED_CODING`: from `user-coding` → `user-solving`

2. **Signal coding start/stop**:
   - When user switches to Code tab → dispatch `USER_STARTED_CODING`
   - Pause mic intent → `paused-for-coding`
   - Pause auto-submit timer
   - Silent Observer switches to **code analysis mode**

3. **Silent Observer code analysis** (every 30 seconds during `user-coding`):
   - Send current code snapshot to AI (via model_routing `chat` tier — fast model)
   - Max 150 tokens response
   - Return brief inline comments (not interrupt, not submit)
   - Display as `SilentObserverNudge` ("Consider: edge case when array is empty")
   - Does NOT submit the code — user submits explicitly via "Share with KAI"

4. **Auto-resume on code share**: When user clicks "Share with KAI" → code is wrapped in markdown and submitted → interview resumes → back to `ai-feedback` state.

**Files**:
- `src/lib/interview/state-machine.ts` — add `user-coding` state + transitions
- `src/lib/interview/silent-observer.ts` — add `analyzeCode()` function
- `src/hooks/useInterview.ts` — handle coding state, pause mic/auto-submit
- `src/components/interview/InterviewSession.tsx` — signal code tab switch
- `src/components/interview/CodeEditor.tsx` — emit onChange events at 30s intervals

**Verification**:
- Switch to Code tab → mic pauses, auto-submit stops
- Write code for 30s → observer nudge appears (brief code comment)
- Click "Share with KAI" → interview resumes, KAI responds to code
- Switch back to Voice tab → mic resumes

---

### A4: Voice System Overhaul ✅ Parts 1-2+4 DONE (PR-2)

> Integrates the full VOICE_SYSTEM_PLAN.md (all 5 parts)
> Execute parts sequentially: Part 1 → 2 → 3 → 4 → 5

#### Part 1 — Deletions (no new code, execute FIRST) ✅ DONE

| Deletion | File | Reason |
|----------|------|--------|
| Text input fallback (`showTextInput`, `textInput` state, textarea JSX) | `InterviewSession.tsx` | Voice-only product |
| Duplicate VAD system (VAD hook + InterruptionManager imports/state/callbacks/effects) | `ConversationView.tsx` | Two systems subscribe to same VAD singleton → Whisper fires twice. `useInterview`'s copy is correct. |
| VAD-related props from `ConversationViewProps` (`vadEnabled`, `onInterrupt`, `interruptedMessageIndices`, `onContinuePreviousResponse`, `onVadError`, `onUserSpeaking`, `onSpeechEnd`) | `ConversationView.tsx` | Dead after VAD removal |
| Dead state: `autoSubmitEnabled`, `hasPendingSend`, `hasPendingRef`, `handleMicStop`, `sendPendingTranscript`, `submitCurrentTranscript`, `transcribeVADAudio` | `useInterview.ts` | Unused or only for deleted text input/duplicate VAD |
| `vadMode` state, `vadEnabled` flag, dead `isSpeaking+isListening` guard effect | `InterviewSession.tsx` | Only existed for ConversationView's dead VAD system |
| Direct `startListening()`/`stopListening()` calls in voice sub-object | `useInterview.ts` | Mic sync effect handles start/stop from intent — direct calls are redundant |

**Post-deletion ConversationView call**:
```tsx
<ConversationView
    messages={messages}
    isAISpeaking={voice.isSpeaking}
    isProcessing={isProcessing}
/>
```

---

#### Part 2 — Bug Fixes (execute SECOND, after deletions) ✅ DONE

| # | Fix | File | Change |
|---|-----|------|--------|
| 2.1 | `ttsError` never resets | `useInterview.ts` | Add `setTtsError(false)` at top of `submitUserResponse` |
| 2.2 | `sendCountdown` auto-send ignores `isSpeaking` | `useInterview.ts` | Add `!isSpeakingRef.current` guard in countdown `prev <= 1` branch |
| 2.3 | Smart pause grace timer races with `speakAndWait` | `useInterview.ts` | Cancel `smartPauseTimerRef` inside `submitUserResponse` and after `speakAndWait` resolves |
| 2.4 | `handleStart` mic-denied sets deleted `showTextInput` | `InterviewSession.tsx` | Replace with clear error message about enabling mic in browser settings |
| 2.5 | No `isPushToTalk` indicator for UI | `useInterview.ts` return | Add `isPushToTalk: vadFailed \|\| sttProvider === 'browser'` to return object |
| 2.6 | `voice.startListening` / `voice.stopListening` directly call STT/VAD | `useInterview.ts` | Remove direct calls — set intent only, mic sync effect handles hardware |

---

#### Part 3 — ZoomTranscript (execute THIRD, replaces TranscriptViewer) ✅ DONE (PR-10, commit e8560f8)

Replace `TranscriptViewer.tsx` with new `ZoomTranscript.tsx` — a sliding-window conversation view:

```
┌─────────────────────────────────────────────┐
│  Kai                                         │
│  "Let's talk about binary search. Given a    │
│   sorted array, what's your first instinct   │
│   on how to find a target value?"            │
│  ░░░ speaking...                             │
├─────────────────────────────────────────────┤
│  You                                         │
│  "I would start by checking the middle       │
│   element and then..."                       │
│  ● listening                                 │
└─────────────────────────────────────────────┘
```

**Props**: `lastAiMessage`, `isSpeaking`, `isProcessing`, `transcript`, `interimTranscript`, `isListening`, `micStoppedManually`, `isPushToTalk`

**User row states**:
| Condition | Display |
|-----------|---------|
| `isProcessing` | "Kai is thinking..." (amber dot) |
| `isListening`, no transcript | "● listening..." (green, pulsing) |
| `isListening`, has transcript | transcript text + "● listening" |
| `isPushToTalk`, mic off | "tap mic to speak" |
| `micStoppedManually`, has transcript | transcript + "⏸ tap Send or press mic again" |

**Files**:
- Create `src/components/voice/ZoomTranscript.tsx`
- Wire into `InterviewSession.tsx` replacing `TranscriptViewer`
- Delete `src/components/voice/TranscriptViewer.tsx`

---

#### Part 4 — ConversationView Cleanup (execute FOURTH, after Part 1) ✅ DONE

After Part 1 deletions, ConversationView becomes a clean chat history renderer:

**Updated props interface**:
```typescript
interface ConversationViewProps {
    messages: Message[];
    isAISpeaking: boolean;
    isProcessing: boolean;
    chunkProgress?: number;
}
```

All removed: VAD hooks, InterruptionManager code, feature flag reads, `debugLog`.

---

#### Part 5 — Owner Panel Voice Config (separate PR, after Parts 1-4 ship)

Add sliders in voice-debug-tab on owner dashboard for tuning:
| Parameter | Default | What it controls |
|-----------|---------|------------------|
| `positiveSpeechThreshold` | 0.7 | VAD confidence to detect speech start |
| `negativeSpeechThreshold` | 0.25 | VAD confidence to detect speech stop |
| `redemptionMs` | 1500 | Pause tolerance before closing segment |
| `minSpeechMs` | 800 | Min length to count as speech |
| `graceMs` | 500 | Min AI speech before allowing interruption |
| `debounceMs` | 1000 | Min gap between successive interruptions |

Requires `reconfigureVAD()` function — destroys and recreates the VAD singleton.

---

### A5: Interview Hard End Enforcement ✅ DONE (PR-3)

**Problem**: Interview keeps going after timer expires. Modal is dismissible.

**Current behavior**: `useInterviewLimits` sets `isTimeUp`/`isTurnsUp` → modal appears → user can dismiss → interview continues.

**Fixes**:

1. **10-second grace timer after limit hit**:
   ```typescript
   // When isTimeUp OR isTurnsUp:
   // 1. Show modal (existing)
   // 2. Start 10s countdown
   // 3. Display "Auto-submitting in Xs..." in modal
   // 4. After 10s → auto-trigger handleFinish()
   ```

2. **Block all input post-limit**:
   - `micIntent('off')` immediately
   - Code editor set to read-only
   - All interactive buttons disabled
   - Only "View My Assessment" button active

3. **Auto-navigate** to analysis page after assessment saves:
   ```typescript
   router.push(`/interview/analysis?sessionId=${savedId}`);
   ```

**Files**:
- `src/hooks/useInterview.ts` — add hard timer enforcement with 10s grace
- `src/components/interview/InterviewSession.tsx` — auto-trigger finish, disable inputs, add auto-nav

**Verification**:
- Set practice mode → let timer run out → modal appears with countdown
- After 10s → interview auto-ends, analysis page loads
- Cannot speak, type, or edit code after timer expires

---

### A6: Guest User Limits ✅ DONE (PR-3)

**Current**: 5 min / 5 turns. **New**: 10 min / 10 turns.

**Change in `interview-config.ts`**:
```typescript
export function resolveGuestConfig(): InterviewConfig {
    return {
        mode: 'guest',
        difficultyMode: 'practice',
        maxDurationMs: 10 * 60_000,    // was 5 * 60_000
        maxTurnsPerProblem: 10,         // was 5
        isUnlimited: false,
        ragContext: '',
        kaiMemory: '',
        sprint: null,
    };
}
```

**All mode limits (final)**:
| Mode | Time | Turns |
|------|------|-------|
| warm-up | 20 min | 15 |
| practice | 30 min | 20 |
| crunch | 25 min | 12 |
| sprint | 45 min | 10/problem |
| guest | 10 min | 10 |
| admin/owner | 120 min | 999 |

**Files**:
- `src/lib/interview/interview-config.ts` — update `resolveGuestConfig()`

---

## Phase B — Post-Interview Analysis Fixes

> Priority: 🟡 HIGH — fix what users see after the interview
> Prerequisite: Phase C started (C1 at minimum for model routing) for B1

---

### B1: Scoring Failure (All 0/10 or 5/10) ✅ DONE (PR-9, commit 7454c6c)

**Problem**: Two different failure modes visible in screenshots:

1. **All 0/10** (Screenshot 1: "Subarray Sum Equals K" — 1 minute, "Not enough interaction to properly assess skills")
   - `analysisFailure: 'user_fault'` — pre-analysis gate rejected because `userTurns < 3`
   
2. **All 5/10** (Screenshot 2: "Advanced Algorithmic Design" — 10+ min with detailed 2-pointer explanation, "Automated analysis failed. Manual review required.")
   - `analysisFailure: 'system_fault'` — AI analysis threw/timed out, fallback scored all 8 dimensions at 5

**Scoring pipeline**:
```
save-session.ts:
  userTurns < minTurns? → skip analysis, all 0, 'user_fault'
  └→ CognitiveAnalyzer.analyze()
      ├→ success → individual per-skill scores
      ├→ timeout/error → retry 3x
      └→ all retries fail → check word count
           ├→ < 20 words → all 0, 'user_fault'
           └→ >= 20 words → all 5, 'system_fault'
```

**Root cause for all-5 with 10+ min interview**: `CognitiveAnalyzer.analyze()` failed all 3 retries (Gemini timeout or API error). The fallback code saw >= 20 words → assigned 5 to all 8 skills. The actual quality of the conversation was never evaluated.

**Fixes**:

1. **Lower minimum turns to 2** (see B2)

2. **Add retry with fallback model** — when primary model fails, use the model_routing fallback chain (Phase C):
   ```typescript
   // In analyzer.ts callAI():
   // First attempt: uses model_routing 'analysis' priority chain
   // If all analysis-tier models fail → cross-tier fallback to 'chat' models
   // This is handled by the unified AI client after Phase C
   ```

3. **Per-skill scoring even in fallback**: Instead of flat 0 or flat 5, analyze what data IS available:
   ```typescript
   // In fallback path:
   // If user mentioned specific algorithm → algorithmic-thinking gets 3-4 (not 0)
   // If user discussed complexity → complexity-analysis gets 3-4
   // Simple keyword analysis, not full AI — fast and reliable
   ```

4. **Better error communication** on analysis page:
   - `user_fault` → "Your session had too little discussion for accurate scoring. Try engaging more with KAI."
   - `system_fault` → "Our AI analysis is being retried. Scores may update shortly."

5. **Graduated short-session cap** (in score-validator.ts):
   - 2-3 user turns → scores capped at 5
   - 4-5 user turns → scores capped at 6
   - 6+ user turns → no cap (existing behavior)

6. **Background retry**: When analysis fails with `system_fault`, save with `analysis_status: 'pending_retry'`. A cron job or edge function retries later with a different model.

**Files**:
- `src/app/actions/save-session.ts` — lower min turns, add retry, better error messages
- `src/lib/assessment/analyzer.ts` — add model fallback via unified client, improve fallback scoring
- `src/lib/assessment/score-validator.ts` — graduated short-session cap
- `src/components/analysis/AnalysisClient.tsx` — display failure reason prominently, show retry status

**Verification**:
- Interview with 2 detailed turns → meaningful per-skill scores (not all 0)
- Interview with 10+ turns, simulated Gemini failure → retry with Groq 70B → actual scores appear
- Analysis page shows clear message when scores are pending retry

---

### B2: Minimum Turn Threshold ✅ DONE (PR-4)

**Change**: `minTurns` from 3 to **2** for normal users.

```typescript
// save-session.ts
const minTurns = isAdmin ? 1 : 2;  // was: isAdmin ? 1 : 3
```

**Rationale**: A user giving a detailed 2-pointer solution + dry run in 2 exchanges has more than enough data for 8-dimension scoring. Quality > quantity.

**Files**:
- `src/app/actions/save-session.ts` — change `minTurns`

---

### B3: Auto-Navigate to Analysis (Two Views Fix) ✅ DONE (PR-3/PR-4)

**Problem**: After interview ends, user must click a brief 8-second toast to reach the analysis page. If they miss the toast, they have no easy path.

**Two analysis UIs exist**:
1. **Practice analysis** (`/interview/analysis?sessionId=...`) — `AnalysisClient.tsx` — 3-panel layout with gauge, key moments, FSRS, action items
2. **Assessment complete** (`/assess/complete`) — `content.tsx` — for employer campaigns

**Fix**: Auto-navigate to analysis after successful save. Keep toast as backup.

```typescript
// In InterviewSession.tsx handleFinish(), after saveInterviewSession returns:
if (savedSession?.id) {
    router.push(`/interview/analysis?sessionId=${savedSession.id}`);
}
// Keep toast as notification, but user is already navigating
```

**Files**:
- `src/components/interview/InterviewSession.tsx` — add `router.push()` after save

---

### B4: FSRS / Spaced Repetition Integration on Analysis Page

**Current**: SM2/FSRS data is a tiny static card in Panel 3 ("Next review: Mar 4, Target: 2/10 · Rep #0").

**Fix**: Enhance the SM2/FSRS section in `AnalysisClient.tsx` to be more prominent:
- Show next review date with calendar visual
- Difficulty rating from FSRS algorithm
- Repetition count and interval progression
- "Schedule Review" CTA button that adds to dashboard queue
- If no SM2 data: "This problem hasn't been added to your review queue yet. [Add to Queue]"

**Files**:
- `src/components/analysis/AnalysisClient.tsx` — enhance SM2 section design and placement

---

### B5: History Tab → Static Transcript Page ✅ DONE (PR-12, commit 0332472)

**Problem**: History tab redirects to `/interview?...&mode=review` which starts a full interactive interview engine with mic, timer, etc.

**Fix**: Create a dedicated static history transcript page.

**Route**: `/interview/history/[sessionId]`

**Layout**:
```
┌──────────────────────────────────────────────────────────┐
│  Problem Title    MEDIUM    Completed Mar 4, 2026        │
│  Score: 7.2/10    Duration: 12 min    Turns: 8           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PROBLEM DESCRIPTION                                     │
│  [Full problem statement — read-only, at top]            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  TRANSCRIPT                                              │
│  [Chat bubble style — read-only, full history]           │
│  Kai: "Let's discuss two-sum..."                         │
│  You: "I would use a hash map approach..."               │
│  ...                                                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  CODE (if any)                                           │
│  [Read-only syntax-highlighted code snapshot]             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ASSESSMENT SCORES                                       │
│  [8 skill dimension bars — same as analysis page]        │
│                                                          │
│  [View Full Analysis]  [Retry This Problem]              │
└──────────────────────────────────────────────────────────┘
```

**Implementation**:
1. **Server-rendered page** — fetches from `interview_sessions` + `assessments` + `problems` tables
2. **No interview engine** — no mic, no timer, no hooks, no state machine
3. Transcript rendered in chat-bubble style (can reuse `ConversationView` read-only OR simple `<div>` rendering)
4. Problem description shown at top (fetched from `problems` table by `problem_id`)
5. Code snapshot if available (from enriched transcript or `code_attempts` table)
6. Assessment scores: reuse the `SkillBar` components from `AnalysisClient`
7. Links: "View Full Analysis" → `/interview/analysis?sessionId=...`, "Retry" → `/interview?problemId=...`

**Dashboard update**:
```typescript
// dashboard/page.tsx → handleSessionClick:
router.push(`/interview/history/${session.sessionId}`);
// was: router.push(`/interview?problemId=...&sessionId=...&mode=review`)
```

**Files**:
- Create `src/app/interview/history/[sessionId]/page.tsx` — server component
- Create `src/components/interview/HistoryTranscriptView.tsx` — transcript renderer
- Update `src/app/dashboard/page.tsx` — change `handleSessionClick` route

---

### B6: Replay Route Fix + Fallback ✅ DONE (PR-12, commit 0332472)

**Problem**: `/replay/87139de5-...` returns 404 because `session_replays` row only exists if user explicitly clicked "Share".

**Fixes** (both replay AND history work independently):

1. **Fallback in replay page**: If `session_replays.public_token` lookup fails, try `interview_sessions.id`:
   ```typescript
   // In replay/[token]/page.tsx:
   // 1. Try session_replays (existing behavior)
   let replay = await supabase.from('session_replays').select(...)...
   
   // 2. Fallback: try interview_sessions directly
   if (!replay) {
       const { data: session } = await supabase
           .from('interview_sessions')
           .select('problem_title, problem_difficulty, duration, transcript, overall_score')
           .eq('id', token)
           .maybeSingle();
       if (session) {
           // Render transcript WITHOUT annotations
           // Show UI cue: "Direct session link — no AI annotations."
           // Show button: "[Generate AI Annotations]"
       }
   }
   ```

2. **Auto-create basic replay row on session save** (optional):
   - After `saveInterviewSession`, create a `session_replays` row with `public_token = session.id`
   - **Skip** AI annotation generation (expensive) — just create the linkable row
   - Annotations generated lazily when user clicks "Generate" or "Share"

3. **UI cue on replay page**: When viewing via fallback (no annotations):
   - Show banner: "This session doesn't have AI annotations yet."
   - Show button: "[Generate Annotations]" → calls `/api/replay/generate`

**Files**:
- `src/app/replay/[token]/page.tsx` — add fallback lookup to `interview_sessions`
- `src/app/actions/save-session.ts` — optionally auto-create minimal replay row

---

## Phase C — Model Routing & AI Tiers

> Priority: 🟡 HIGH — enables owner-controlled model management, no hardcoded models
> Prerequisite: None for C1-C2. C3 needs C1 done.

---

### C1: New `model_routing` DB Table ✅ DONE

**Purpose**: Maps models to use cases (`chat` / `analysis`) with owner-defined priorities. Fully managed from the owner dashboard.

**SQL Migration**:

```sql
-- New table: model_routing
CREATE TABLE public.model_routing (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    model_id text NOT NULL,                 -- matches model_registry.model_id
    provider text NOT NULL,                 -- 'groq' | 'gemini' | 'bedrock' | etc.
    use_case text NOT NULL,                 -- 'chat' | 'analysis'
    priority integer NOT NULL DEFAULT 100,  -- lower number = higher priority (1 = first choice)
    is_active boolean NOT NULL DEFAULT true,
    max_tokens_override integer,            -- optional per-routing override
    notes text,                             -- owner notes for this routing entry
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT model_routing_use_case_check CHECK (use_case IN ('chat', 'analysis')),
    CONSTRAINT model_routing_unique_model_usecase UNIQUE (model_id, use_case)
);

-- RLS
ALTER TABLE public.model_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read model_routing"
ON public.model_routing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage model_routing"
ON public.model_routing FOR ALL TO authenticated
USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- Performance index
CREATE INDEX idx_model_routing_usecase_priority 
ON public.model_routing (use_case, priority ASC) WHERE is_active = true;

-- Seed initial routing (based on current hardcoded behavior):
INSERT INTO public.model_routing (model_id, provider, use_case, priority) VALUES
    -- Chat tier: fast models, high RPM — for interview conversation turns
    ('llama-3.3-70b-versatile',   'groq',   'chat',     10),
    ('llama-3.1-8b-instant',      'groq',   'chat',     20),
    ('llama-4-scout-17b',         'groq',   'chat',     30),
    ('gpt-oss-120b',              'groq',   'chat',     40),
    ('gpt-oss-20b',               'groq',   'chat',     50),
    ('kimi-k2-instruct',          'groq',   'chat',     60),
    ('gemini-2.0-flash',          'gemini', 'chat',     70),
    -- Analysis tier: intelligent models, structured JSON output — for scoring
    ('gemini-2.5-pro',            'gemini', 'analysis',  10),
    ('gemini-2.5-flash',          'gemini', 'analysis',  20),
    ('gemini-2.0-flash',          'gemini', 'analysis',  30),
    ('gemini-1.5-pro',            'gemini', 'analysis',  40),
    ('llama-3.3-70b-versatile',   'groq',   'analysis',  50),
    ('gpt-oss-120b',              'groq',   'analysis',  60)
ON CONFLICT (model_id, use_case) DO NOTHING;
```

**Files**: New Supabase migration

---

### C2: Owner Dashboard — Model Routing Tab ✅ DONE

**New tab**: "AI Routing" in the owner dashboard Tools section.

**UI Features**:
- Two sub-tabs: `[Chat Models]` `[Analysis Models]`
- Table per use-case showing: Priority #, Model Name, Provider, RPM, Active toggle
- **Drag-to-reorder** rows (priority = row position × 10)
- **Toggle active/inactive** per model per use-case
- **Add model**: dropdown populated from `model_registry` → adds to selected use-case
- **Remove**: soft-delete (set `is_active = false`)
- **Cross-tier fallback toggle**: stored in `system_config` table
- **Save Order** button → PATCH to API

**API Route**: `POST/PATCH/DELETE /api/owner/model-routing`
- `GET` — returns all routing entries grouped by use_case
- `PATCH` — update priorities (batch), toggle active
- `POST` — add new routing entry
- `DELETE` — remove routing entry

**Files**:
- Create `src/components/owner/ModelRoutingTab.tsx`
- Create `src/app/api/owner/model-routing/route.ts` (CRUD)
- Update `src/app/owner/page.tsx` — add "AI Routing" tab

---

### C3: DB-Driven Model Selection (Remove Hardcoded Models) ✅ DONE

**Current**: `providers.ts` has static `CHAT_MODELS` array. `analyzer.ts` hardcodes `preferredProvider: 'gemini'`.

**New architecture**:

1. **New helper**: `src/lib/ai/model-routing.ts`:
   ```typescript
   export async function getModelsForUseCase(useCase: 'chat' | 'analysis'): Promise<RoutedModel[]> {
       // 1. Check Redis cache (key: `model_routing:${useCase}`, TTL 60s)
       // 2. If miss: query model_routing JOIN model_registry 
       //    WHERE use_case = X AND is_active = true 
       //    ORDER BY priority ASC
       // 3. If DB returns empty → log warning, return EMERGENCY_FALLBACK
       // 4. Cache result in Redis
       // Return: Array<{ modelId, provider, priority, rpm, rpd, contextWindow, maxTokens }>
   }
   
   export async function isCrossTierFallbackEnabled(): Promise<boolean> {
       // Read from system_config table, default true
   }
   ```

2. **Update `client.ts` `generateCompletion()`**:
   ```typescript
   // Determine use case from options
   const useCase = (options.category === 'intelligence' || options.category === 'analysis') 
       ? 'analysis' : 'chat';
   
   // Get ordered models from DB (not static array)
   const models = await getModelsForUseCase(useCase);
   
   // Iterate by priority, check rate limits
   for (const model of models) {
       const result = await tryModel(model);
       if (result) return result;
   }
   
   // If all models in primary use-case exhausted:
   if (await isCrossTierFallbackEnabled()) {
       const fallbackModels = await getModelsForUseCase(useCase === 'chat' ? 'analysis' : 'chat');
       for (const model of fallbackModels) {
           const result = await tryModel(model);
           if (result) return result;
       }
   }
   
   throw new Error('All models exhausted');
   ```

3. **Remove hardcoded models**:
   - `providers.ts` `CHAT_MODELS` → rename to `EMERGENCY_FALLBACK_MODELS`, add deprecation comment
   - `analyzer.ts` → remove `preferredProvider: 'gemini'`, use `category: 'analysis'`
   - `score-validator.ts` → remove `preferredProvider: 'gemini'`, use `category: 'analysis'`

**Files**:
- Create `src/lib/ai/model-routing.ts`
- Update `src/lib/ai/client.ts` — DB-driven model selection
- Update `src/lib/ai/providers.ts` — static array becomes emergency fallback only
- Update `src/lib/assessment/analyzer.ts` — remove `preferredProvider`
- Update `src/lib/assessment/score-validator.ts` — remove `preferredProvider`

---

### C4: Cross-Tier Fallback ✅ DONE

When all models in a use-case exhaust rate limits, fall back to the other use-case's models.

**Logic** (in `client.ts`):
```
1. Try all 'chat' models in priority order
2. All exhausted? Check isCrossTierFallbackEnabled()
3. If yes: try 'analysis' models in priority order
4. All exhausted? Throw error
```

Cross-tier fallback enabled by default, toggleable from owner dashboard "AI Routing" tab. Stored in `system_config` table (`key: 'cross_tier_fallback_enabled'`).

**Files**:
- `src/lib/ai/client.ts` — fallback chain
- `src/lib/ai/model-routing.ts` — `isCrossTierFallbackEnabled()` reads `system_config`

---

### C5: Bedrock Preparation (Future — No Code Now)

The `model_routing` table architecture fully supports Bedrock. When ready:

1. Add Bedrock models to `model_registry`:
   ```sql
   INSERT INTO model_registry (model_id, provider, ...) VALUES
       ('anthropic.claude-3-5-haiku-20241022', 'bedrock', ...),
       ('amazon.titan-text-express-v1', 'bedrock', ...);
   ```

2. Add to `model_routing` with desired priorities from owner dashboard:
   - Claude Haiku at priority 5 for `analysis` → highest priority, tried first
   - Titan at priority 5 for `chat` → tried before Groq models

3. Implement `src/lib/ai/providers/bedrock.ts` — AWS SDK integration.

4. No other code changes needed — the model_routing + client pipeline handles it.

---

## Phase D — Feature Flags & DB Foundation

> Integrates `phase-1-flag-writes-and-db-foundation.md` fully
> Priority: 🟠 MEDIUM
> Prerequisite: None

---

### D1: Fix Owner PATCH Route ✅ DONE

**Bug**: Owner toggles flag → `PATCH /api/owner/flags` fires → `isOwnerOrCoOwner()` creates anon client → co_owners RLS blocks → 403. Even if owner passes, route uses `.update()` (not `.upsert()`) and busts wrong Redis key (`algomind:global_flags` vs `global_flag:{key}`).

**Fix**: Replace entire `src/app/api/owner/flags/route.ts`:
- Delegate all DB writes to `setGlobalFeatureFlag()` (uses service role + upsert + correct Redis key `global_flag:{key}`)
- Add flag key validation against `FEATURE_FLAGS` registry
- Add `isEnabled` boolean type check
- Return `{ success: true, key, isEnabled }` on success

**Also verify**: `src/lib/supabase/service.ts` exports `getServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY`.

**Files**:
- `src/app/api/owner/flags/route.ts` — full replacement
- `src/lib/supabase/service.ts` — verify exists and is correct

---

### D2: Fix `check_is_admin` / `is_admin` search_path ✅ DONE

**Bug**: Both functions are `SECURITY DEFINER` without `SET search_path = 'public'` — Supabase security advisory violation (BUG-17).

**SQL Migration**:
```sql
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type IN ('admin', 'owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.co_owners
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND account_type IN ('admin', 'owner'));
$$;
```

**Verify**: `SELECT proname, proconfig FROM pg_proc WHERE proname = 'check_is_admin'` → `proconfig = {search_path=public}`

---

### D3: Seed Missing Flag Rows ✅ DONE

```sql
INSERT INTO public.global_feature_flags (key, is_enabled, notes) VALUES
  ('ENABLE_VAD_INTERRUPTIONS',    true,  'Voice Activity Detection'),
  ('ENABLE_WHISPER_STT',          true,  'Whisper speech-to-text'),
  ('ENABLE_GROQ_TTS',             false, 'Groq TTS provider'),
  ('ENABLE_CHUNKED_RESPONSES',    true,  'Chunked streaming responses'),
  ('ENABLE_AWS_POLLY_TTS',        false, 'AWS Polly TTS'),
  ('ENABLE_AWS_TRANSCRIBE_STT',   false, 'AWS Transcribe STT'),
  ('ENABLE_AWS_S3_STORAGE',       false, 'AWS S3 storage'),
  ('ENABLE_LEARN_MODE',           true,  'Learn mode feature'),
  ('ENABLE_COMPARATIVE_ANALYSIS', true,  'Comparative analysis'),
  ('ENABLE_DIFFICULTY_MODES',     true,  'Difficulty modes'),
  ('ENABLE_HINGLISH_SUPPORT',     true,  'Hinglish language support'),
  ('ENABLE_SILENT_OBSERVER',      true,  'Silent observer mode'),
  ('ENABLE_SMART_ROUTING',        true,  'Smart AI routing'),
  ('ENABLE_RESPONSE_CACHE',       true,  'Response caching')
ON CONFLICT (key) DO NOTHING;
```

---

### D-Done Criteria

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `scripts/verify-flag-write.ts` — ✅ on both checks
- [ ] Manual toggle in owner dashboard updates DB row (verified in Supabase dashboard)
- [ ] No "Failed to update flag" toast
- [ ] SQL: `proconfig = {search_path=public}` on `check_is_admin` and `is_admin`
- [ ] Redis key mismatch eliminated

---

## Phase E — Permissions & Co-owner Unification

> Integrates `phase-2-permissions-and-coowner-unification.md` fully
> Priority: 🟠 MEDIUM
> Prerequisite: Phase D done

---

### E1: Fix Co-owner RLS Policies ✅ DONE

**Bug**: `co_owners` has one RLS policy `is_owner()`. Co-owner users can't read their own row → `isOwnerOrCoOwner()` returns false → 403 (BUG-04).

**SQL Migration** (run as transaction):
```sql
BEGIN;
DROP POLICY IF EXISTS "Owner can manage co_owners" ON public.co_owners;

CREATE POLICY "Owner full access to co_owners"
ON public.co_owners FOR ALL TO authenticated
USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "Co-owner can read own record"
ON public.co_owners FOR SELECT TO authenticated
USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);
COMMIT;
```

---

### E2: Backfill `co_owners.user_id` ✅ DONE

```sql
UPDATE public.co_owners co SET user_id = au.id
FROM auth.users au WHERE co.email = au.email AND co.user_id IS NULL;
```

---

### E3: Auto-link Triggers ✅ DONE

**Trigger 1**: On `co_owners` INSERT → link `user_id` from `auth.users` by email:
```sql
CREATE OR REPLACE FUNCTION public.link_co_owner_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.user_id FROM auth.users WHERE email = NEW.email LIMIT 1;
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_link_co_owner_user_id BEFORE INSERT ON public.co_owners
FOR EACH ROW EXECUTE FUNCTION public.link_co_owner_user_id();
```

**Trigger 2**: On `profiles` INSERT (signup) → backfill `co_owners.user_id`:
```sql
CREATE OR REPLACE FUNCTION public.link_profile_to_co_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    UPDATE public.co_owners SET user_id = NEW.id
    WHERE email = NEW.email AND user_id IS NULL;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_link_profile_to_co_owner AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_co_owner();
```

---

### E4: Standardize `isOwnerOrCoOwner()` + Middleware ✅ DONE

**4 divergent admin check paths → 1 consistent approach**:

| Location | Before | After |
|----------|--------|-------|
| `middleware.ts` | `co_owners.user_id = user.id` | `.or(user_id.eq.${id},email.eq.${email})` |
| `account-type.ts` | Anon client, email only | Service client, `user_id OR email` |
| `owner/page.tsx` | Inline duplicate check | `isOwnerOrCoOwner(user.id)` call |
| `get_my_permissions()` SQL | Email only | `user_id OR email` |

**Files**:
- `src/middleware.ts` — fix co-owner check to use `.or()`
- `src/lib/auth/account-type.ts` — use service client, check both fields
- `src/app/owner/page.tsx` — replace inline check with `isOwnerOrCoOwner()`

---

### E5: Fix `get_my_permissions()` + `global_feature_flags` RLS ✅ DONE

**`get_my_permissions()`**: Check `(user_id = v_uid) OR (user_id IS NULL AND email = v_email)` for co-owner status.

**`global_feature_flags` RLS**: Replace modify policy to use `check_is_admin()`:
```sql
DROP POLICY IF EXISTS "Admins and owners modify flags" ON public.global_feature_flags;
CREATE POLICY "Admins and owners modify flags"
ON public.global_feature_flags FOR ALL TO authenticated
USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
```

---

### E-Done Criteria

- [ ] Co-owner user can access `/owner` without redirect
- [ ] Admin user cannot access `/owner` (redirected to `/dashboard`)
- [ ] `get_my_permissions()` returns correct booleans for all account types
- [ ] Backfill: all co-owner rows have `user_id` populated
- [ ] 2 triggers exist on correct tables
- [ ] 2 RLS policies on `co_owners`

---

## Phase F — Auth Redundancy & Tab Session

> Integrates `phase-3-auth-redundancy-and-tab-session.md` fully
> Priority: 🟢 LOWER — performance optimization
> Prerequisite: Phase E done

---

### F1: Session Cache Module

Create `src/lib/auth/session-cache.ts`:
- Module-level cache: `{ userId, validatedAt, expiresAt }`
- `isSessionTrusted()` → true if validated within 15 min AND JWT > 5 min remaining
- `markSessionValid(userId, jwtExpMs)`, `markRefreshed(userId, newExpMs)`, `clearCache()`

---

### F2: AuthProvider Refactor

**Fix BUG-12**: Remove upfront `getSession()` call. Use only `onAuthStateChange`:
- `INITIAL_SESSION` fires immediately → eliminates double-setState
- Integrate `markSessionValid()` / `markRefreshed()` / `clearCache()` in the handler
- Single subscription for all events: `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`, `INITIAL_SESSION`

**Files**: `src/components/auth/AuthProvider.tsx`

---

### F3: Gut `useSessionPersistence`

Replace with no-op (empty function body). Removes:
- Second `onAuthStateChange` subscription (BUG-08 — double-fire)
- Manual `refreshSession()` interval every 50 min (BUG-11 — fights Supabase auto-refresh)

Move localStorage cleanup to AuthProvider's `signOut` callback.

**Files**: `src/lib/auth/session-manager.ts`

---

### F4: Middleware Smart Validation

**Fix BUG-07**: Skip `getUser()` network call when JWT is healthy:
1. Extract access token from Supabase auth cookie
2. Decode JWT locally via `jwt-decode` library
3. If `exp - now > 5 min` → trust it, construct `user` from decoded `sub` claim, skip network call
4. If near-expiry or decode fails → fall through to `getUser()`

**Dependency**: `npm install jwt-decode`

**Files**: `src/middleware.ts` — replace `getUser()` with JWT decode + fallback

---

### F5: `useAdmin` — Use AuthProvider Context

**Fix BUG-09**: Remove independent `getUser()` call. Use `useAuth()` hook for user object. Add 5-minute module-level cache for `check_is_admin()` RPC result.

**Files**: `src/hooks/useAdmin.ts` — full rewrite

---

### F6: `useGlobalFeatureFlag` — Visibility Gate

**Fix BUG-10**: Stop 30-second polling when tab is hidden:
- `document.visibilityState === 'hidden'` → `clearInterval()`
- `document.visibilityState === 'visible'` → immediate `refresh()` + `setInterval()` restart

**Files**: `src/hooks/useGlobalFeatureFlag.ts` — replace polling useEffect

---

### F-Done Criteria

- [ ] 0 `/auth/v1/user` network calls on tab switch with healthy JWT
- [ ] 0 `/api/flags` calls while tab is hidden
- [ ] No double re-renders on login/page navigation
- [ ] `npm run build` succeeds
- [ ] Session cache unit tests pass (6 cases)

---

## DB Schema Changes Summary

All SQL migrations in recommended execution order:

| # | Phase | Migration | Type | Idempotent? |
|---|-------|-----------|------|-------------|
| 1 | D2 | Fix `check_is_admin()` + `is_admin()` search_path | ALTER FUNCTION | ✅ (CREATE OR REPLACE) |
| 2 | D3 | Seed missing flag rows | INSERT | ✅ (ON CONFLICT DO NOTHING) |
| 3 | E1 | Fix co_owners RLS policies (drop + create 2) | RLS | ⚠️ Run once |
| 4 | E2 | Backfill `co_owners.user_id` | UPDATE | ✅ (WHERE NULL) |
| 5 | E3 | Create `link_co_owner_user_id` trigger | TRIGGER | ✅ (DROP IF EXISTS) |
| 6 | E3 | Create `link_profile_to_co_owner` trigger | TRIGGER | ✅ (DROP IF EXISTS) |
| 7 | E5 | Fix `get_my_permissions()` function | ALTER FUNCTION | ✅ (CREATE OR REPLACE) |
| 8 | E5 | Fix `global_feature_flags` RLS modify policy | RLS | ⚠️ Run once |
| 9 | C1 | Create `model_routing` table + seed data | CREATE TABLE | ✅ (IF NOT EXISTS + ON CONFLICT) |

**No changes** to existing table schemas: `assessments`, `interview_sessions`, `model_registry`, `profiles`, `co_owners` (only triggers/RLS), `global_feature_flags` (only RLS), `session_replays`, `spaced_repetition`, `skill_repetition`.

---

## Key Files Map

| Area | Key Files |
|------|-----------|
| **Interview Engine** | |
| Interview page | `src/app/interview/page.tsx` |
| Main component | `src/components/interview/InterviewSession.tsx` |
| Hook (core) | `src/hooks/useInterview.ts` |
| State machine | `src/lib/interview/state-machine.ts` |
| Config/limits | `src/lib/interview/interview-config.ts` |
| Silent observer | `src/lib/interview/silent-observer.ts` |
| Limits hook | `src/hooks/useInterviewLimits.ts` |
| **Voice** | |
| TTS engine | `src/lib/voice/tts-engine.ts` |
| TTS hook | `src/hooks/useTTS.ts` |
| STT hook | `src/hooks/useSTT.ts` |
| VAD hook/manager | `src/hooks/useVAD.ts` |
| ZoomTranscript (new) | `src/components/voice/ZoomTranscript.tsx` |
| TranscriptViewer (delete) | `src/components/voice/TranscriptViewer.tsx` |
| ConversationView | `src/components/interview/ConversationView.tsx` |
| **Analysis** | |
| Analysis page | `src/app/interview/analysis/page.tsx` |
| Analysis UI | `src/components/analysis/AnalysisClient.tsx` |
| Save session action | `src/app/actions/save-session.ts` |
| Cognitive analyzer | `src/lib/assessment/analyzer.ts` |
| Score validator | `src/lib/assessment/score-validator.ts` |
| Assessment prompts | `src/lib/assessment/prompts.ts` |
| **History/Replay** | |
| History page (new) | `src/app/interview/history/[sessionId]/page.tsx` |
| Transcript view (new) | `src/components/interview/HistoryTranscriptView.tsx` |
| Replay page | `src/app/replay/[token]/page.tsx` |
| Replay generate API | `src/app/api/replay/generate/route.ts` |
| **AI/Models** | |
| AI client | `src/lib/ai/client.ts` |
| Providers (static → emergency fallback) | `src/lib/ai/providers.ts` |
| Model routing (new) | `src/lib/ai/model-routing.ts` |
| Model routing tab (new) | `src/components/owner/ModelRoutingTab.tsx` |
| Model routing API (new) | `src/app/api/owner/model-routing/route.ts` |
| **Flags/Auth** | |
| Owner flags route | `src/app/api/owner/flags/route.ts` |
| Feature flags server | `src/lib/feature-flags-server.ts` |
| Service client | `src/lib/supabase/service.ts` |
| Session cache (new) | `src/lib/auth/session-cache.ts` |
| Auth provider | `src/components/auth/AuthProvider.tsx` |
| Session manager | `src/lib/auth/session-manager.ts` |
| Account type utils | `src/lib/auth/account-type.ts` |
| Middleware | `src/middleware.ts` |
| useAdmin hook | `src/hooks/useAdmin.ts` |
| useGlobalFeatureFlag | `src/hooks/useGlobalFeatureFlag.ts` |
| **Dashboard** | |
| Dashboard | `src/app/dashboard/page.tsx` |
| Owner page | `src/app/owner/page.tsx` |
| FSRS/SM2 | `src/lib/spaced-repetition/fsrs.ts` |
| Spaced rep actions | `src/app/actions/spaced-repetition.ts` |

---

## Execution Order & Dependency Graph

```
Phase A (Interview Experience) ← NO DEPENDENCIES, start immediately
├── A1: AI Looping Fix ← standalone, CRITICAL
├── A2: Mic Fix ← standalone, CRITICAL  
├── A4: Voice Overhaul
│   ├── Part 1: Deletions ← execute first
│   ├── Part 2: Bugfixes ← after Part 1
│   ├── Part 3: ZoomTranscript ← after Part 1
│   └── Part 4: ConversationView cleanup ← after Part 1
├── A5: Hard End Enforcement ← standalone
├── A6: Guest Limits ← standalone, trivial
└── A3: Code Integration ← after A4 (needs state machine changes)

Phase B (Post-Interview Analysis)
├── B2: Min Turn Threshold ← standalone, trivial
├── B3: Auto-Nav to Analysis ← standalone
├── B4: FSRS Enhancement ← standalone
├── B5: History Page ← standalone (new route + component)
├── B6: Replay Fix ← standalone
└── B1: Scoring Fix ← needs C3 done (DB-driven model routing)

Phase C (Model Routing) ← can start in parallel with A
├── C1: DB Table (SQL migration) ← first
├── C2: Owner Dashboard Tab ← after C1
├── C3: DB-Driven Selection ← after C1 + C2
└── C4: Cross-Tier Fallback ← after C3

Phase D (Flags) ← standalone, can parallel with A/C
├── D1: Owner PATCH route fix
├── D2: search_path SQL fix
└── D3: Seed flag rows

Phase E (Permissions) ← requires D done
├── E1: Co-owner RLS (SQL)
├── E2: Backfill user_id (SQL)
├── E3: Auto-link triggers (SQL)
├── E4: Code standardization
└── E5: get_my_permissions + flag RLS (SQL)

Phase F (Auth Performance) ← requires E done
├── F1: Session cache module
├── F2: AuthProvider refactor
├── F3: Gut useSessionPersistence
├── F4: Middleware JWT decode
├── F5: useAdmin context
└── F6: Visibility gate polling
```

---

## Recommended PR Merge Order

| PR # | Contents | Dependencies | Effort |
|------|----------|--------------|--------|
| **PR-1** ✅ | A1 + A2 (AI looping + mic fix) | none | HIGH |
| **PR-2** ✅ | A4 Parts 1-2 (voice deletions + bugfixes) | none | MEDIUM |
| **PR-3** ✅ | A5 + A6 (hard end + guest limits) | none | LOW |
| **PR-4** ✅ | B2 + B3 (min turns + auto-nav) | none | LOW |
| **PR-5** ✅ | D1 + D2 + D3 (flags SQL + route fix) | none | LOW |
| **PR-6** ✅ | C1 + C2 (model_routing table + owner UI) | none | MEDIUM |
| **PR-7** ✅ | E1-E5 (permissions SQL + code) | PR-5 | MEDIUM |
| **PR-8** ✅ | C3 + C4 (DB-driven model selection + fallback) | PR-6 | HIGH |
| **PR-9** | B1 (scoring fix with model fallback) | PR-8 | MEDIUM |
| **PR-10** | A4 Parts 3-4 (ZoomTranscript + ConversationView cleanup) | PR-2 | MEDIUM |
| **PR-11** | A3 (code + interview integration) | PR-2, PR-10 | HIGH |
| **PR-12** | B5 + B6 (history page + replay fix) | none | MEDIUM |
| **PR-13** | B4 (FSRS enhancement on analysis page) | none | LOW |
| **PR-14** | F1-F6 (auth performance optimizations) | PR-7 | MEDIUM |
| **PR-15** | A4 Part 5 (owner voice config panel) | PR-10 | LOW |

---

## What Is Explicitly NOT Changed

| Thing | Why untouched |
|---|---|
| `speakAndWait` serial await pattern | Core of working mic gating — correct |
| VAD `onSpeechEnd → stt.transcribeAudio` in useInterview | The one correct transcription path |
| VAD config defaults (0.7 / 0.25 / 1500ms) | Working, tunable via owner panel later (A4 Part 5) |
| TTSEngine invId race condition fix | Correct and needed |
| 350ms mic sync delay | Correct — React state settling time |
| Smart pause 1500ms grace timer logic | Correct — only racing fixed |
| Whisper WAV encoding (float32ToWav) | Working correctly |
| Auto-submit 5s silence timer core logic | Correct behavior |
| All API routes (`/api/voice/transcribe`, `/api/voice/synthesize-polly`) | Not touched |
| `MicrophoneButton` / `MicPulse` components | Not touched |
| Employer assessment flow (`/assess/*`) | Separate from practice flow |
| Existing DB table schemas | Only new table (`model_routing`), existing are only modified via triggers/RLS |
