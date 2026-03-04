# AlgoMind — Voice System Implementation Plan
> Last written: March 4, 2026  
> Status: Ready to execute  
> Scope: Fixes, deletions, new Zoom-style transcript, clean architecture

---

## Ground Rules

1. **Do not touch anything that is currently working.** The mic activates after TTS. VAD captures audio. Whisper transcribes. Auto-submit fires after 5s. These work. Only change what is listed below.
2. **Every change is either a deletion, a bugfix, or a new component.** Nothing is speculative.
3. **Changes are numbered in the order they must be executed.** Later changes depend on earlier ones.

---

## Part 1 — Deletions (Execute First, No New Code Needed)

These are removed with no replacement. Removing them cannot break anything because they are either dead code or explicitly replaced in Part 2.

---

### 1.1 — Remove Text Input Fallback (InterviewSession.tsx)

**Why:** Voice-only product. Text input contradicts the product. User is never going to type.

**Remove from state declarations (lines ~154–155):**
```typescript
// DELETE BOTH OF THESE
const [showTextInput, setShowTextInput] = useState(false);
const [textInput, setTextInput] = useState('');
```

**Remove from handleStart (~line 384):**
```typescript
// DELETE THIS LINE inside the mic denied block
setShowTextInput(true);
// Keep the error message — just don't offer text fallback
```

**Remove the entire showTextInput JSX block (~lines 821–860):**  
Delete from `{showTextInput ? (` all the way through the closing `)}` of that conditional, including:
- The textarea element
- The "Type instead" keyboard button
- The `(showTextInput && textInput.trim())` conditions inside the Send button logic

**After deletion, the Send button condition simplifies to:**
```typescript
{micStoppedManually && voice.transcript && (
    <Button onClick={() => submitUserResponse(voice.transcript, ...)}>
        {sendCountdown !== null ? `Sending in ${sendCountdown}s…` : 'Send'}
    </Button>
)}
```

---

### 1.2 — Remove Duplicate VAD System (ConversationView.tsx)

**Why:** Two systems both subscribe to the same VAD singleton. Every speech segment fires Whisper twice. The system in `useInterview` is the correct one. `ConversationView`'s copy is the duplicate.

**Remove the import:**
```typescript
// DELETE
import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';
```

**Remove the import:**
```typescript
// DELETE
import { InterruptionManager } from '@/lib/voice/interruption-manager';
```

**Remove state and refs (~lines 82–85):**
```typescript
// DELETE
const [isInterrupting, setIsInterrupting] = useState(false);
const interruptionManagerRef = useRef<InterruptionManager | null>(null);
```

**Remove `isVadFlagEnabled`, `isVadSupported`, `isVadEnabled` (~lines 92–96):**
```typescript
// DELETE all three
const isVadFlagEnabled = useGlobalFeatureFlag('ENABLE_VAD_INTERRUPTIONS', true);
const isVadSupported = true;
const isVadEnabled = isVadFlagEnabled && propVadEnabled;
```

**Remove the entire `handleInterruption` useCallback (~lines 99–119):**
```typescript
// DELETE — this whole callback
const handleInterruption = useCallback(() => { ... }, [...]);
```

**Remove the entire `useVoiceActivityDetection` call (~lines 121–148):**
```typescript
// DELETE — this entire hook invocation
useVoiceActivityDetection({ ... });
```

**Remove the VAD analytics effect (~lines 150–157):**
```typescript
// DELETE
useEffect(() => {
    if (isVadEnabled) { debugLog('vad_init', ...) }
}, [isVadEnabled, isVadSupported]);
```

**Remove the VAD cleanup effect (~lines 161–170):**
```typescript
// DELETE
useEffect(() => {
    if (!isVadEnabled) {
        if (interruptionManagerRef.current) { ... }
    }
}, [...]);
```

**Remove from ConversationViewProps interface:**
```typescript
// DELETE these props — they were only needed for the InterruptionManager
vadEnabled?: boolean;
onInterrupt?: () => void;
interruptedMessageIndices?: Set<number>;
onContinuePreviousResponse?: () => void;
onVadError?: (err: Error) => void;
onUserSpeaking?: () => void;
onSpeechEnd?: (audio: Float32Array) => void;
```

**Remove from function parameters:**
```typescript
// DELETE all of these from the destructured props
vadEnabled: propVadEnabled = false,
onInterrupt,
interruptedMessageIndices,
onContinuePreviousResponse,
onVadError,
onUserSpeaking,
onSpeechEnd,
```

**Update the ConversationView call in InterviewSession.tsx (~line 946):**

Before (remove all of this):
```typescript
<ConversationView
    messages={messages}
    isAISpeaking={voice.isSpeaking}
    vadEnabled={vadEnabled && vadMode === 'vad' && !vadFailed && hasStarted}
    onInterrupt={() => {
        voice.stopSpeaking();
        handleInterruption();
    }}
    onContinuePreviousResponse={() => { ... }}
    onVadError={(err) => { ... }}
    onSpeechEnd={(audio) => { ... }}
/>
```

After (clean):
```typescript
<ConversationView
    messages={messages}
    isAISpeaking={voice.isSpeaking}
    isProcessing={isProcessing}
/>
```

**Remove from InterviewSession.tsx state declarations:**
```typescript
// DELETE — only existed to control ConversationView's dead VAD system
const [vadMode, setVadMode] = useState<'vad' | 'simple'>('vad');
```

**Remove from InterviewSession.tsx:**
```typescript
// DELETE — no longer needed after ConversationView props cleanup
const vadEnabled = useGlobalFeatureFlag('ENABLE_VAD_INTERRUPTIONS', true);
```

**Remove the dead InterruptionManager wiring in InterviewSession.tsx:**
```typescript
// DELETE — the isSpeaking+isListening guard was a workaround for the duplicate VAD
useEffect(() => {
    if (isSpeaking && isListening && !vadEnabled) {
        stopListening();
    }
}, [isSpeaking, isListening, stopListening, vadEnabled]);
```

**Clean up now-unused destructuring in InterviewSession.tsx:**
```typescript
// REMOVE vadFailed from the useInterview destructure (it's still in useInterview, 
// but InterviewSession no longer needs to read it directly)
// REMOVE handleInterruption from the destructure (smart pause handles this internally)
```

---

### 1.3 — Remove Dead State from useInterview.ts

**Remove `autoSubmitEnabled` / `setAutoSubmitEnabled`:**
```typescript
// DELETE state declaration
const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);

// DELETE the guard in the auto-submit effect:
if (!autoSubmitEnabled) return;   // DELETE this line only

// DELETE from return object:
autoSubmitEnabled,
setAutoSubmitEnabled,
```

**Remove `hasPendingSend` / `hasPendingRef`:**
```typescript
// DELETE
const [hasPendingSend, setHasPendingSend] = useState(false);
const hasPendingRef = useRef(false);
useEffect(() => { hasPendingRef.current = hasPendingSend; }, [hasPendingSend]);

// DELETE from return:
hasPendingSend,
```

**Remove `handleMicStop` from return object:**
```typescript
// DELETE — was a duplicate of what toggleMic does; nobody calls it correctly
handleMicStop: () => { ... }
```

**Remove `sendPendingTranscript` from return object:**
```typescript
// DELETE — existed only to pair with the deleted text input and hasPendingSend
sendPendingTranscript: () => { ... }
```

**Remove `voice.transcribeVADAudio` from voice return object:**
```typescript
// DELETE from voice sub-object
transcribeVADAudio,
```
This was only exposed so ConversationView's (now deleted) `onSpeechEnd` prop could call it. VAD transcription is handled internally by useInterview's own `onSpeechEnd` callback.

**Remove `voice.submitCurrentTranscript` from voice return object:**
```typescript
// DELETE — same reason as above
submitCurrentTranscript: () => { ... }
```

**Remove `voice.startListening()` direct call path:**
```typescript
// In the voice sub-object, REPLACE:
startListening: () => {
    if (isSpeaking) return;
    setMicIntent('user-on');       // ← KEEP this
    setMicStoppedManually(false);  // ← KEEP this
    setSendCountdown(null);        // ← KEEP this
    startListening();              // ← DELETE: mic sync effect handles this
    if (sttProvider === 'whisper') vad.startListening(); // ← DELETE: mic sync effect handles this
},

// BECOMES:
startListening: () => {
    if (isSpeaking) return;
    setMicIntent('user-on');
    setMicStoppedManually(false);
    setSendCountdown(null);
},
```

**Same fix for `voice.stopListening()`:**
```typescript
// REPLACE:
stopListening: () => {
    setMicIntent('off');
    setMicStoppedManually(true);
    stopListening();              // ← DELETE: mic sync effect handles stop
    if (sttProvider === 'whisper') vad.stopListening(); // ← DELETE
},

// BECOMES:
stopListening: () => {
    setMicIntent('off');
    setMicStoppedManually(true);
},
```

The mic sync effect already handles actual start/stop. Intent changes are the only signals needed.

---

## Part 2 — Bug Fixes (Execute Second)

These are surgical single-line or small block changes to existing working code.

---

### 2.1 — Fix: ttsError Never Resets (useInterview.ts)

**File:** `src/hooks/useInterview.ts`  
**Location:** Top of `submitUserResponse` callback, before the stopListening call.

**Add this line:**
```typescript
const submitUserResponse = useCallback(async (userText, problemContext) => {
    if (stateMachine.current.getState() === 'completed') return;
    if (!userText.trim()) return;

    setTtsError(false);   // ← ADD THIS: clear any previous TTS error banner

    stopListening();
    setMicIntent('paused-for-ai');
    // ... rest unchanged
```

---

### 2.2 — Fix: sendCountdown Auto-Send Ignores isSpeaking (useInterview.ts)

**File:** `src/hooks/useInterview.ts`  
**Location:** Inside the sendCountdown interval, the `prev <= 1` branch (~line 463).

**Before:**
```typescript
if (text && currentProblemRef.current && !isProcessingRef.current) {
    submitUserResponse(text, currentProblemRef.current);
}
```

**After:**
```typescript
if (text && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
    submitUserResponse(text, currentProblemRef.current);
}
```

---

### 2.3 — Fix: Smart Pause Grace Timer Races With speakAndWait (useInterview.ts)

**Why:** When user interrupts mid-AI-speech, three things set `micIntent('auto-on')`:
1. The grace timer (1500ms)
2. `speakAndWait` resolving (because interrupted = success = true)
3. VAD `onSpeechEnd` firing (because user spoke)

All three fire within milliseconds. The `isListeningRef` guard prevents double `startListening()`, but the state churn is noisy and fragile.

**Fix:** Cancel the grace timer inside `submitUserResponse` (the natural place where the interrupt cycle completes), and cancel it when `speakAndWait` resolves.

**In `submitUserResponse`, at the very top (after the early returns):**
```typescript
// Cancel any pending smart pause timer — user response has arrived
if (smartPauseTimerRef.current) {
    clearTimeout(smartPauseTimerRef.current);
    smartPauseTimerRef.current = null;
}
smartPauseActiveRef.current = false;
```

**After `speakAndWait` resolves in both `startInterview` and `submitUserResponse`:**
```typescript
const ttsOk = await speakAndWait(responseText, 3);

// Cancel grace timer if smart pause fired mid-TTS — speakAndWait already resolved
if (smartPauseTimerRef.current) {
    clearTimeout(smartPauseTimerRef.current);
    smartPauseTimerRef.current = null;
}
smartPauseActiveRef.current = false;

setMicStoppedManually(false);
setMicIntent('auto-on');
```

---

### 2.4 — Fix: handleStart Gracefully Handles Mic Denied (InterviewSession.tsx)

**Before (sets showTextInput which we deleted):**
```typescript
if (perm.state === 'denied') {
    setError('Microphone access is blocked...');
    setShowTextInput(true);  // ← this is deleted
}
```

**After:**
```typescript
if (perm.state === 'denied') {
    setError(
        'Microphone access is blocked. ' +
        'Please click the camera/mic icon in your browser address bar to enable it, then refresh.'
    );
    // Interview can still start — user will see the error and know why mic won't work
}
```

---

### 2.5 — Fix: VAD Push-to-Talk Fallback UI Signal (useInterview.ts return)

Currently when `vadFailed = true`, the user gets no indication. The mic button just looks normal but VAD isn't running — they have to manually press mic before and after each turn.

**Add to return object:**
```typescript
// Already exists: vadFailed, vadMode
// Add: explicit push-to-talk flag for UI
isPushToTalk: vadFailed || sttProvider === 'browser',
```

This single boolean tells the UI "user must manually control the mic" without leaking implementation details.

---

## Part 3 — New Component: ZoomTranscript (Execute Third)

This replaces `TranscriptViewer.tsx` entirely. The old file is deleted. The new component is a sliding-window conversation view showing the last AI turn and the current user turn, live, with status indicators.

---

### 3.1 — New File: `src/components/voice/ZoomTranscript.tsx`

**Visual design (what the user sees):**

```
┌─────────────────────────────────────────────┐
│  Kai                                         │
│  "Alright, let's talk about binary search.   │
│   Given a sorted array, what's your first    │  ← last AI message, full text
│   instinct on how to find a target value?"   │
│                                              │
│  ░░░ speaking...                             │  ← pulse dots, only when isSpeaking
├─────────────────────────────────────────────┤
│  You                                         │
│  "So I would start by checking the middle    │  ← accumulated transcript so far
│   element and then..."                       │
│                                              │
│  ● listening                                 │  ← green dot, only when mic is on
└─────────────────────────────────────────────┘
```

**States for the "You" row:**

| Condition | What shows |
|---|---|
| `isProcessing = true` | "Kai is thinking..." (amber dot, animated) |
| `isSpeaking = true` and mic off | Nothing in You row (AI turn) |
| `isListening = true`, no transcript yet | "● listening..." (green, pulsing) |
| `isListening = true`, transcript building | transcript text + "● listening" below |
| `isPushToTalk = true`, mic off | "Tap mic to speak" (zinc, static) |
| `micStoppedManually = true`, has transcript | transcript + "⏸ tap Send or press mic again" |

**States for the "Kai" row:**

| Condition | What shows |
|---|---|
| `isSpeaking = true` | Full text + `░░░ speaking...` pulse below |
| `isSpeaking = false`, has last message | Full text, no indicator |
| `isProcessing = true`, no last message yet | "Kai is thinking..." animated |
| No messages yet | Empty / placeholder |

**Component props:**
```typescript
interface ZoomTranscriptProps {
    // AI state
    lastAiMessage: string | null;    // content of last assistant message
    isSpeaking: boolean;             // TTS is playing
    isProcessing: boolean;           // waiting for AI API response

    // User state
    transcript: string;              // accumulated final transcript
    interimTranscript: string;       // in-flight words (browser STT only)
    isListening: boolean;            // mic is on
    micStoppedManually: boolean;     // user pressed stop, waiting for send
    isPushToTalk: boolean;           // VAD failed, manual mic mode

    // Scroll
    className?: string;
}
```

**Implementation:**

```typescript
'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ZoomTranscript({
    lastAiMessage,
    isSpeaking,
    isProcessing,
    transcript,
    interimTranscript,
    isListening,
    micStoppedManually,
    isPushToTalk,
    className,
}: ZoomTranscriptProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when any content changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lastAiMessage, transcript, interimTranscript, isSpeaking, isProcessing, isListening]);

    const hasUserContent = transcript || interimTranscript;

    return (
        <div
            ref={scrollRef}
            className={cn(
                'w-full overflow-y-auto rounded-xl border border-white/5',
                'bg-zinc-900/40 backdrop-blur-sm',
                'scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent',
                // Responsive height: min 160px on mobile, max 300px on desktop
                'min-h-[160px] max-h-[300px]',
                className
            )}
        >
            <div className="flex flex-col gap-0 p-3 pb-2 min-h-full">

                {/* ── KAI ROW ─────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {(lastAiMessage || isProcessing) && (
                        <motion.div
                            key="kai-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-3"
                        >
                            {/* Speaker label */}
                            <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-4 h-4 rounded-full bg-indigo-600/40 flex items-center justify-center">
                                    <span className="text-[7px] font-black text-indigo-300">K</span>
                                </div>
                                <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Kai</span>
                            </div>

                            {/* Message text */}
                            {lastAiMessage ? (
                                <p className="text-sm text-zinc-200 leading-relaxed pl-5.5 whitespace-pre-wrap">
                                    {lastAiMessage}
                                </p>
                            ) : (
                                // isProcessing, no message yet
                                <p className="text-sm text-zinc-500 italic pl-5.5">
                                    thinking...
                                </p>
                            )}

                            {/* Speaking indicator — only while TTS is playing */}
                            <AnimatePresence>
                                {isSpeaking && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-1.5 mt-1.5 pl-5.5"
                                    >
                                        {[0, 1, 2].map(i => (
                                            <motion.span
                                                key={i}
                                                className="w-1 h-1 rounded-full bg-indigo-400/60"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{
                                                    duration: 1.2,
                                                    delay: i * 0.2,
                                                    repeat: Infinity,
                                                }}
                                            />
                                        ))}
                                        <span className="text-[9px] text-indigo-400/60">speaking</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── USER ROW ────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {/* Don't show user row while AI is thinking and there's no transcript */}
                    {(!isProcessing || hasUserContent) && (
                        <motion.div
                            key="user-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-auto"
                        >
                            {/* Speaker label */}
                            <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-4 h-4 rounded-full bg-zinc-600/40 flex items-center justify-center">
                                    <span className="text-[7px] font-black text-zinc-300">Y</span>
                                </div>
                                <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">You</span>
                            </div>

                            {/* Transcript content */}
                            <div className="pl-5.5">
                                {hasUserContent ? (
                                    <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
                                        {transcript}
                                        {interimTranscript && (
                                            <span className="text-zinc-500 italic"> {interimTranscript}</span>
                                        )}
                                    </p>
                                ) : null}

                                {/* Status indicator below transcript */}
                                <div className="mt-1.5">
                                    {isListening && (
                                        <motion.div
                                            className="flex items-center gap-1.5"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            <motion.div
                                                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                                                animate={{ opacity: [1, 0.3, 1] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                            />
                                            <span className="text-[9px] text-emerald-400/70">
                                                {hasUserContent ? 'listening' : 'listening...'}
                                            </span>
                                        </motion.div>
                                    )}

                                    {micStoppedManually && hasUserContent && (
                                        <p className="text-[9px] text-zinc-500 italic">
                                            ⏸ press mic again to continue, or Send
                                        </p>
                                    )}

                                    {isPushToTalk && !isListening && !hasUserContent && !isSpeaking && !isProcessing && (
                                        <p className="text-[9px] text-zinc-600">
                                            tap mic to speak
                                        </p>
                                    )}

                                    {!isListening && !hasUserContent && !isSpeaking && !isProcessing && !isPushToTalk && (
                                        <p className="text-[9px] text-zinc-600 italic">
                                            mic will activate automatically
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty state — nothing has happened yet */}
                {!lastAiMessage && !isProcessing && !hasUserContent && (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-[10px] text-zinc-600 italic">
                            Interview will appear here
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
```

---

### 3.2 — Wire ZoomTranscript into InterviewSession.tsx

**Replace the entire `TranscriptViewer` import:**
```typescript
// DELETE:
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';

// ADD:
import { ZoomTranscript } from '@/components/voice/ZoomTranscript';
```

**In `useInterview` destructure, make sure we get:**
```typescript
const {
    ...
    isPushToTalk,   // ← new flag from Part 2.5
    ...
} = useInterview({ ... });
```

**Replace the TranscriptViewer usage in renderInteractionArea (~lines 808–820):**

Before:
```typescript
<div className="flex-1 bg-zinc-900/40 rounded-xl border border-white/5 ...">
    <div className="absolute inset-0 p-1">
        <TranscriptViewer
            transcript={voice.transcript}
            interimTranscript={voice.interimTranscript}
        />
    </div>
</div>
```

After:
```typescript
<ZoomTranscript
    lastAiMessage={
        [...messages].reverse().find(m => m.role === 'assistant')?.content ?? null
    }
    isSpeaking={voice.isSpeaking}
    isProcessing={isProcessing}
    transcript={voice.transcript}
    interimTranscript={voice.interimTranscript}
    isListening={voice.isListening}
    micStoppedManually={micStoppedManually}
    isPushToTalk={isPushToTalk}
    className="flex-none"
/>
```

**Delete the old label and badge wrapper** that surrounded TranscriptViewer (the "Live Transcript" label and the `Active` badge). The ZoomTranscript component self-labels with "Kai" and "You".

---

### 3.3 — Delete TranscriptViewer.tsx

After `ZoomTranscript` is wired and confirmed working:
```bash
rm src/components/voice/TranscriptViewer.tsx
```

---

## Part 4 — ConversationView Simplification (Execute Fourth)

After the deletions in Part 1.2, ConversationView becomes a clean, props-light chat history renderer. Its only job is showing message history. It no longer touches VAD.

**Updated ConversationViewProps:**
```typescript
interface ConversationViewProps {
    messages: Message[];
    isAISpeaking: boolean;
    isProcessing: boolean;
    chunkProgress?: number;
    interruptedMessageIndices?: Set<number>;      // keep for visual interrupted state
    onContinuePreviousResponse?: () => void;       // keep for "Continue" button on interrupted messages
}
```

**What stays in ConversationView:**
- Message rendering with proper styling
- Auto-scroll to bottom on new messages
- The "interrupted" message visual treatment (badge + "Continue" button)
- The `chunkProgress` indicator if it exists

**What is completely gone from ConversationView:**
- All VAD hooks and imports (removed in 1.2)
- All InterruptionManager code (removed in 1.2)
- All feature flag reads (removed in 1.2)
- The `debugLog` function if it only existed for VAD events

---

## Part 5 — Owner Panel Voice Config (Execute Last, Separate PR)

This is intentionally last. Do not start this until all previous parts are confirmed working in production.

**What the panel will expose:**

| Parameter | Current default | What it controls | Label in UI |
|---|---|---|---|
| `positiveSpeechThreshold` | 0.7 | How confident VAD must be before deciding "speech started" | Speech sensitivity |
| `negativeSpeechThreshold` | 0.25 | How low confidence must drop before declaring "speech stopped" | Speech end sensitivity |
| `redemptionMs` | 1500 | How long to wait after speech dips before closing the audio segment | Pause tolerance |
| `minSpeechMs` | 800 | Minimum length to count as speech (filters coughs, pops) | Min speech length |
| `graceMs` | 500 | How long AI must have been speaking before user can interrupt | Interrupt grace |
| `debounceMs` | 1000 | Minimum gap between successive interruptions | Interrupt cooldown |

**Problem to solve first:** Currently `getVoiceConfig()` is read once during `VADManager.init()` and baked into the MicVAD instance. Changing localStorage after init has no effect.

**Solution:** Add a `reconfigureVAD()` function that:
1. Calls `vadManager.destroy()`
2. Clears the singleton
3. Calls `getVADManager()` to create a fresh instance
4. Calls `manager.init()` with the new config

This is a page-reload-equivalent for VAD only. The interview must not be active when this is called (owner panel only, not during a live session).

**UI:** Simple sliders or number inputs in the existing `voice-debug-tab.tsx`. Save button writes to localStorage via `setVoiceConfig()`, then calls `reconfigureVAD()`. Current values shown alongside defaults.

---

## Execution Checklist

```
Part 1 — Deletions
  [ ] 1.1  Remove text input (InterviewSession.tsx)
  [ ] 1.2  Remove duplicate VAD (ConversationView.tsx + InterviewSession.tsx)
  [ ] 1.3  Remove dead state (useInterview.ts)

Part 2 — Bug Fixes
  [ ] 2.1  ttsError auto-resets on new turn
  [ ] 2.2  sendCountdown checks isSpeaking before firing
  [ ] 2.3  Smart pause grace timer cancelled on speakAndWait resolve
  [ ] 2.4  handleStart mic-denied message updated
  [ ] 2.5  isPushToTalk flag added to useInterview return

Part 3 — ZoomTranscript
  [ ] 3.1  Create src/components/voice/ZoomTranscript.tsx
  [ ] 3.2  Wire into InterviewSession.tsx
  [ ] 3.3  Delete TranscriptViewer.tsx

Part 4 — ConversationView Cleanup
  [ ] 4.1  Update props interface
  [ ] 4.2  Remove dead code confirmed gone

Part 5 — Owner Panel (separate, after everything above ships)
  [ ] 5.1  Add reconfigureVAD() to vad-manager.ts
  [ ] 5.2  Build voice config UI in voice-debug-tab.tsx
```

---

## What Is Explicitly NOT Changed

| Thing | Why untouched |
|---|---|
| `speakAndWait` serial await pattern | Core of working mic gating — correct as-is |
| VAD `onSpeechEnd → stt.transcribeAudio` in useInterview | This is the one correct transcription path |
| VAD config defaults (0.7 / 0.25 / 1500ms) | Working well, tunable later via owner panel |
| TTSEngine invId race condition fix | Correct and needed |
| isListeningRef synchronous update | Correct guard against double-starts |
| 350ms mic sync delay | Correct — needed for React state settling |
| The smart pause 1500ms grace timer logic | Correct — only racing fixed in 2.3 |
| Whisper WAV encoding (float32ToWav) | Fixed before, working correctly |
| Auto-submit 5s silence timer | Correct behaviour, keep as-is |
| All API routes (/api/voice/transcribe, /api/voice/synthesize-polly) | Not touched |
| MicrophoneButton component | Not touched |
| MicPulse component | Not touched |
