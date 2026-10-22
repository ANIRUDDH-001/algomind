# Voice Engine v2 — Stage 1 (free-only): reliable, instrumented, fast turn loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AlgoMind's voice interview trustworthy on free infrastructure. The mic never silently dies, Kai never speaks the wrong language or goes silent, every failure is recorded where we can see it, and the gap between the candidate finishing and Kai speaking drops from ~12–15 s today to ~2–3 s.

**Architecture:** Keep the verified interview brain (`/api/chat`, prompts, assessment) and replace the fragile voice plumbing underneath it. Two engines each become the **single owner** of a browser resource:
- `SpeechQueue` owns `speechSynthesis`.
- `MicController` owns the mic and the Silero VAD.

Both sit under the existing `useTTS` / `useVAD` hook APIs, so the live Interview and Learn pipelines inherit the fixes. On top of that:
- Kai speaks sentence by sentence while the reply is still streaming.
- A content-aware turn detector replaces the fixed 5 s auto-submit.
- A per-turn timeline is recorded to `system_events`, so every future bug report carries numbers.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, @ricky0123/vad-web 0.0.30 (Silero v5 ONNX, already vendored in `public/vad/`), browser `speechSynthesis`, Groq Whisper (free tier), Groq/Gemini free-tier LLMs, Upstash Redis, Supabase.

**Spec:** [`ALGOMIND_VOICE_PLAN.md`](../../../ALGOMIND_VOICE_PLAN.md), plus the decisions of 2026-09-27 recorded in its §6 ("Decisions & corrections").

## Global Constraints

- **Free only.** No paid API, SaaS or tier upgrade. The providers are Groq free, Gemini free, and in-browser engines.
- **No new npm dependencies in Stage 1.** Everything needed is already installed: `@ricky0123/vad-web`, `onnxruntime-web`, `zod`, `@playwright/test`.
- **The dev server talks to PRODUCTION Supabase** (`wfdgsmhuglmrxcmwcylz`). Use only `@algomind.test` accounts. Never change global flags or rows belonging to real users from the dev box.
- **The user commits and pushes.** Every task ends with a verification checkpoint, not a commit. Leave the changes staged-ready and report the diff.
- **Upstash auto-JSON-parses values on `get`.** `"123"` comes back as the number 123 and `"true"` as boolean true. Always coerce with `Number(v)` / `String(v)`, or accept both shapes.
- **Never echo API keys** in code, logs, telemetry or chat.
- **Existing code style.** Keep the `@codesage` header block on new files, 4-space indentation, and `console.info('[PIPE][…]')` for pipeline logs.
- **Run after every task:** `npx vitest run <task test files>`, `npx tsc --noEmit`, `npx eslint <touched files>`. Before the final hand-off: the full `npx vitest run` (baseline 1321 passing).

## Review Focus

1. **Candidate pauses mid-thought** ("so the approach would be… [2–3 s thinking] …a hash map"). Kai must not jump in. An unfinished sentence waits 2.8 s, a filler waits 4 s, and resuming speech before the send merges both parts into one turn. Pinned in Task 9, Step 1 and Task 12 scenario (a2).
2. **Speakers, no headphones.** Kai's own voice must never be transcribed as the candidate. The mic is paused while `SpeechQueue` is speaking, and interruption is manual (Stop button or Esc) in Stage 1. Pinned in Task 9, Step 5 and Task 11 scenario (e).
3. **A machine whose default voice is non-English, or whose voices load late** (Windows with a Hindi default, Chrome loading voices asynchronously). Kai must use an English voice, or visibly fall back to text. It must never produce "gibberish". Pinned in Task 6, Step 1 (`picks English even when default voice is Hindi`, `waits for late voices`).
4. **Chrome refusing speech before a user gesture** (`not-allowed`). The candidate sees "Tap to enable Kai's voice" and the mic keeps working. Pinned in Task 6, Step 1 and Task 11 scenario (f).
5. **Groq free quota exhausted mid-interview.** The turn is still answered through Gemini, and later turns do not re-pay the failed Groq round trips. Pinned in Task 4, Step 1.

---

## Stage 1 at a glance

| # | Task | Fixes (root cause from the live run) |
|---|------|------|
| 1 | Voice master switch + typed composer | Prod safety: text-only until verified. Also restores typing, whose toast pointed at a keyboard icon that no longer exists |
| 2 | Delete dead voice code | 7 unused voice files that duplicate logic and confuse fixes |
| 3 | Central reasoning strip + Groq reasoning params | `memory-generator` crash on `<think>`; gpt-oss thinking delays the first token |
| 4 | Provider cooldown memory + chat-model filter | Every turn paid 3 failed Groq calls (429 TPD) before Gemini; a safety classifier was in the chat pool |
| 5 | Lean STT route (key pool, parallel preamble, Server-Timing) | 3.1–3.7 s transcription |
| 6 | `SpeechQueue`, the single owner of speechSynthesis | cancel→speak race (`spokenOk=false` in ~70 ms); non-English default voice ("gibberish"); `onvoiceschanged` clobbered by 3 files |
| 7 | Sentence streaming (speak while generating) | Kai waited for the whole reply before speaking |
| 8 | `MicController`, the single owner of the mic/VAD | 3.5 s deferred-stop race killed the mic; sticky VAD `ERROR`; mic only came back after switching tabs |
| 9 | Turn detector + real mute | Fixed 5 s silence before sending; the mic button could not keep the mic off |
| 10 | Turn timeline telemetry → `system_events` | Voice failures were visible only in the candidate's console |
| 11 | `/voice-check` self-test page | No way to verify mic/STT/speaker before an interview |
| 12 | Playwright voice regression suite | Voice bugs were caught by a live mock instead of CI |
| 13 | Live verification run + flag flip | Evidence before voice returns to prod |

**Latency budget after Stage 1** (candidate stops → Kai's first audio):
- VAD end-of-speech: 0.8 s (was 1.9 s)
- Whisper: ~0.5–0.9 s (was 3.1–3.7 s)
- Turn commit: 0–1.3 s depending on content (was a fixed 5 s)
- LLM first sentence: ~0.4–0.8 s on Groq; ~1–2 s on Gemini overflow (was 2.4–3.5 s)
- speechSynthesis start: ~0.1 s

**Typical total: ≈ 2–3 s.** Stage 2 (a separate plan) targets ≈ 1.5 s with Kokoro WebGPU voices, automatic barge-in, semantic end-of-turn (Smart Turn v3), and a speculative LLM start.

**Free-tier capacity (measured by the Task 10 telemetry, not guessed):**
- Groq Whisper: 2,000 requests/day and 28,800 audio-seconds/day **per Groq org**, with each request billed as at least 10 s. That is roughly 25–40 interviews/day/org.
- Groq gpt-oss: 200K tokens/day per model per org.
- Overflow goes to Gemini `flash-lite`.
- If real traffic outgrows free tiers, that is a business decision for later. The telemetry will show when.

---

### Task 1: Voice master switch + typed composer (prod safety first)

**Files:**
- Modify: `src/lib/feature-flags.ts` (add `ENABLE_VOICE_MODE` after `ENABLE_GUEST_MODE`)
- Create: `src/components/interview/InterviewComposer.tsx`
- Modify: `src/hooks/useInterview.ts` (read the flag, gate TTS/VAD/mic effect, return `voiceEnabled`)
- Modify: `src/components/interview/InterviewSession.tsx:540-560` (skip the mic permission prompt when voice is off), `:1008-1050` (composer in place of the mic block; "Type instead" toggle when voice is on)
- Modify: `src/app/learn/[slug]/LearnSessionPageClient.tsx:83-172` (gate voice)
- Test: `src/components/interview/__tests__/InterviewComposer.test.tsx`
- Test: `src/hooks/__tests__/useInterview.voice-flag.test.ts`

**Interfaces:**
- Produces: `FEATURE_FLAGS.ENABLE_VOICE_MODE` (default `false`); `useInterview(...).voiceEnabled: boolean`; `<InterviewComposer onSend(text) disabled placeholder? autoFocus? />`.

- [ ] **Step 1: Write the failing composer test**

```tsx
// src/components/interview/__tests__/InterviewComposer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InterviewComposer } from '../InterviewComposer';

describe('InterviewComposer', () => {
    it('sends trimmed text on Enter and clears the box', () => {
        const onSend = vi.fn();
        render(<InterviewComposer onSend={onSend} />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: '  use a hash map  ' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('use a hash map');
        expect((box as HTMLTextAreaElement).value).toBe('');
    });

    it('Shift+Enter inserts a newline instead of sending', () => {
        const onSend = vi.fn();
        render(<InterviewComposer onSend={onSend} />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: 'line one' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send while disabled or when empty', () => {
        const onSend = vi.fn();
        const { rerender } = render(<InterviewComposer onSend={onSend} disabled />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: 'x' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        rerender(<InterviewComposer onSend={onSend} />);
        fireEvent.change(box, { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));
        expect(onSend).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/components/interview/__tests__/InterviewComposer.test.tsx`
Expected: FAIL, "Failed to resolve import ../InterviewComposer".

- [ ] **Step 3: Implement the composer**

```tsx
// src/components/interview/InterviewComposer.tsx
/**
 * @codesage
 * @file      src/components/interview/InterviewComposer.tsx
 * @purpose   Typed answer box for interviews (text-only mode, and "Type instead" while voice is on).
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/hooks/useDraftPersistence; rendered by InterviewSession
 * @apis      none
 * @db        none
 * @state     Draft text persisted per tab via useDraftPersistence
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';

import React, { useRef } from 'react';
import { Send } from 'lucide-react';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InterviewComposerProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
}

export function InterviewComposer({ onSend, disabled = false, placeholder = 'Type your answer…', autoFocus = false, className }: InterviewComposerProps) {
    const [input, setInput, clearDraft] = useDraftPersistence('interview-composer');
    const ref = useRef<HTMLTextAreaElement>(null);

    const send = () => {
        const text = input.trim();
        if (!text || disabled) return;
        onSend(text);
        clearDraft();
        if (ref.current) ref.current.style.height = 'auto';
    };

    return (
        <div className={cn('flex gap-2 w-full', className)}>
            <textarea
                ref={ref}
                aria-label="Your answer"
                value={input}
                autoFocus={autoFocus}
                disabled={disabled}
                rows={1}
                placeholder={placeholder}
                onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    setInput(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                className="flex-1 resize-none rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 min-h-[44px]"
            />
            <Button aria-label="Send" onClick={send} disabled={disabled || !input.trim()} className="h-[44px] w-[44px] p-0 rounded-xl shrink-0">
                <Send className="w-4 h-4" />
            </Button>
        </div>
    );
}
```

- [ ] **Step 4: Run the composer test and confirm it passes**

Run: `npx vitest run src/components/interview/__tests__/InterviewComposer.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Add the flag**

In `src/lib/feature-flags.ts`, add after `ENABLE_GUEST_MODE`:

```ts
    // Master voice switch for Interview + Learn. OFF → typed chat only (Kai's replies shown as text).
    // Stays OFF in prod until Voice Engine v2 passes the live verification run (plan Task 13).
    ENABLE_VOICE_MODE: {
        storageKey: 'feature_ENABLE_VOICE_MODE',
        defaultValue: false,
        description: 'Spoken interviews and Learn sessions (mic + Kai voice). Off = typed chat only.',
        requiresBrowserSupport: false,
    },
```

The server compiles this default in whenever no `global_feature_flags` row exists (`src/lib/feature-flags-server.ts:34-37`). Deploying therefore turns voice off in prod with no DB write, and the owner flag panel can turn it back on without a deploy.

- [ ] **Step 6: Write the failing hook test**

```ts
// src/hooks/__tests__/useInterview.voice-flag.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const speak = vi.fn().mockResolvedValue(undefined);
const speakAndWait = vi.fn().mockResolvedValue(true);
const vadStart = vi.fn();
let flagValue = false;

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (key: string, def: boolean) => (key === 'ENABLE_VOICE_MODE' ? flagValue : def),
}));
vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => ({ speak, speakAndWait, stop: vi.fn(), isSpeaking: false, provider: 'browser', enqueue: vi.fn(), whenIdle: () => Promise.resolve() }),
}));
vi.mock('@/hooks/useVAD', () => ({
    useVAD: (o: { enabled: boolean }) => ({ mode: 'onnx', isListening: false, isReady: true, status: 'off', startListening: o.enabled ? vadStart : vi.fn(), stopListening: vi.fn(), poke: vi.fn() }),
}));

import { useInterview } from '../useInterview';

describe('useInterview + ENABLE_VOICE_MODE', () => {
    beforeEach(() => { speak.mockClear(); vadStart.mockClear(); });

    it('exposes voiceEnabled=false and never speaks when the flag is off', async () => {
        flagValue = false;
        const { result } = renderHook(() => useInterview({} as never));
        expect(result.current.voiceEnabled).toBe(false);
        await result.current.voice.speak('hello');
        expect(speak).not.toHaveBeenCalled();
    });

    it('exposes voiceEnabled=true and speaks when the flag is on', async () => {
        flagValue = true;
        const { result } = renderHook(() => useInterview({} as never));
        expect(result.current.voiceEnabled).toBe(true);
        await result.current.voice.speak('hello');
        expect(speak).toHaveBeenCalledWith('hello');
    });
});
```

(If `useInterview({} as never)` throws on a missing option, copy the minimal options object from `src/hooks/__tests__/useInterview.state-ownership.test.ts`.)

- [ ] **Step 7: Run it and confirm it fails**

Run: `npx vitest run src/hooks/__tests__/useInterview.voice-flag.test.ts`
Expected: FAIL, `result.current.voiceEnabled` is `undefined`.

- [ ] **Step 8: Gate voice in `useInterview`**

In `src/hooks/useInterview.ts`, right after the `whisperEnabled` line (~254):

```ts
    // Master switch — OFF means typed chat only: no TTS, no VAD, no mic.
    const voiceEnabled = useGlobalFeatureFlag('ENABLE_VOICE_MODE', false);
    const voiceEnabledRef = useRef(voiceEnabled);
    voiceEnabledRef.current = voiceEnabled;
```

Change the VAD options (~298): `enabled: sttProvider === 'whisper',` becomes `enabled: voiceEnabled && sttProvider === 'whisper',`.

Replace the "Legacy aliases" `speak` / `speakAndWait` lines (~362-363) with:

```ts
    const speak = useCallback(async (text: string) => {
        if (!voiceEnabledRef.current) return;
        await tts.speak(text);
    }, [tts.speak]);
    const speakAndWait = useCallback(async (text: string, retries?: number) => {
        if (!voiceEnabledRef.current) return true; // nothing to play is not a failure
        return tts.speakAndWait(text, retries);
    }, [tts.speakAndWait]);
```

At the top of the mic sync effect (~1143), before the idle/completed gate:

```ts
        if (!voiceEnabled) {
            if (isListeningRef.current) stopListening();
            vad.stopListening();
            return;
        }
```

Add `voiceEnabled` to that effect's dependency array. Add `voiceEnabled,` to the returned object (next to `sttProvider`).

- [ ] **Step 9: Render the composer in `InterviewSession`**

1. Destructure `voiceEnabled` from the `useInterview(...)` result.
2. Wrap the mic-permission pre-prompt (~555-559) in `if (voiceEnabled) { … }`.
3. Add `const [typing, setTyping] = useState(false);` near the other UI state.
4. Replace the `{/* Microphone / Interactions */}` block's condition. The existing mic block renders only when `voiceEnabled && !typing`. Otherwise render:

```tsx
<div className="flex flex-col items-center gap-2 pb-6 w-full px-2">
    <InterviewComposer
        autoFocus
        disabled={isProcessing}
        placeholder={voiceEnabled ? 'Type instead of speaking…' : 'Type your answer…'}
        onSend={(text) => submitUserResponse(text, { problemTitle: activeProblem.title, problemContent: activeProblem.description })}
    />
    {voiceEnabled && (
        <button type="button" onClick={() => setTyping(false)} className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
            Back to voice
        </button>
    )}
</div>
```

5. Next to `<MicrophoneButton>` (inside the voice block), add a keyboard toggle that the existing toast ("tap the keyboard icon below") refers to:

```tsx
<button type="button" aria-label="Type instead" onClick={() => { voice.stopListening(); setTyping(true); }}
    className="absolute top-1/2 -translate-y-1/2 -left-16 p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5">
    <Keyboard className="w-5 h-5" />
</button>
```

Import `Keyboard` from `lucide-react` and `InterviewComposer` from `./InterviewComposer`.

- [ ] **Step 10: Gate Learn**

In `src/app/learn/[slug]/LearnSessionPageClient.tsx`:
- Add `const voiceEnabled = useGlobalFeatureFlag('ENABLE_VOICE_MODE', false);` (import from `@/hooks/useGlobalFeatureFlag`).
- Change `enabled: true` to `enabled: voiceEnabled` in `useUnifiedVoice({...})`.
- `onSpeakMessage`: `if (voiceEnabled) await voice.speak(text);`.
- In the "Sync Voice State" effect: `if (voiceEnabled && session.state === 'active' && !session.kaiTyping) voice.start(); else voice.stop(true);`, and add `voiceEnabled` to its deps.
- Render the mic button (~line 515) only when `voiceEnabled`. The text form stays.

- [ ] **Step 11: Verify**

Run: `npx vitest run src/components/interview/__tests__/InterviewComposer.test.tsx src/hooks/__tests__/useInterview.voice-flag.test.ts src/components/interview/__tests__ src/app/learn` then `npx tsc --noEmit`.
Expected: all pass; 0 type errors. Existing orchestrator tests that mock `useInterview` may need `voiceEnabled: true` added to their mock return. Add it and don't change their assertions.

- [ ] **Step 12: Browser check** (the in-app Claude browser is fine here; this step needs no audio)

`preview_start` the dev server. Log in as a `@algomind.test` account and start a practice interview.
Expected:
- No mic permission prompt.
- The composer is visible.
- Typing an answer produces Kai's streamed reply in text.
- No `[PIPE][TTS]` or `[PIPE][VAD]` lines in the console.

Screenshot for the hand-off.

---

### Task 2: Delete dead voice code

These files are imported only by each other or by nothing. Verified 2026-09-27 with `grep -rl` over `src` excluding tests.

**Files:**
- Delete:
  - `src/hooks/useInterviewVoice.ts`
  - `src/hooks/useInterviewControl.ts`
  - `src/hooks/useInterviewApi.ts`
  - `src/hooks/useInterviewMessages.ts`
  - `src/hooks/useVoiceActivityDetection.ts`
  - `src/components/interview/TextInterviewMode.tsx`
  - `src/lib/voice/interruption-manager.ts`
- Delete their tests: `src/hooks/__tests__/useInterviewVoice.test.ts`, `src/hooks/__tests__/useInterviewControl.test.ts`, and any `src/lib/voice/__tests__/interruption-manager*.test.ts`.
- Modify: `src/hooks/useInterview.ts:11` (the `@issues` header no longer mentions the duplicates).

- [ ] **Step 1: Prove they are dead.** Run:

```bash
cd /d/Projects/algomind && for f in useInterviewVoice useInterviewControl useInterviewApi useInterviewMessages useVoiceActivityDetection TextInterviewMode interruption-manager; do echo "== $f"; grep -rl "$f" src --include=*.ts --include=*.tsx | grep -v __tests__; done
```

Expected: each name appears only in the files of the set itself (plus a comment in `useInterview.ts:11` and `useUnifiedVoice.ts:6`). If any other file appears, **stop and report it**. Do not delete.

- [ ] **Step 2: Delete** the files listed above with `git rm`. Remove the `alternative to useInterviewVoice` phrase from the `useUnifiedVoice.ts` header, and change `useInterview.ts:11` to `@issues    Very large file; voice plumbing lives in useTTS/useVAD/useSTT.`

- [ ] **Step 3: Verify.** Run `npx tsc --noEmit && npx vitest run`.
Expected: 0 type errors. The test count drops only by the deleted test files, and nothing else fails.

---

### Task 3: Central reasoning strip + Groq reasoning params (fixes the `<think>` JSON crash)

**Root cause:**
- `memory-generator.ts:175` calls `generateCompletion`, which, unlike `generateResponse`, does not strip reasoning. Qwen returned `<think>…`, and `JSON.parse` threw at `memory-generator.ts:186`.
- With `maxTokens: 300`, the think block can be cut off unclosed, and the existing closed-tag regex (`client.ts:583-589`) can't remove that.
- Separately, gpt-oss on Groq reasons at the default (medium) effort before its first content token. That inflates the time to first token on every chat turn.

**Files:**
- Create: `src/lib/ai/reasoning.ts`
- Modify: `src/lib/ai/client.ts` (`stripThinkingTokens` delegates to `stripReasoning`; `generateCompletion` strips before returning; both Groq request bodies spread `groqReasoningParams(modelId)`)
- Modify: `src/lib/ai/memory-generator.ts:175-186` (`maxTokens: 800`, `extractJsonObject`)
- Test: `src/lib/ai/__tests__/reasoning.test.ts`

**Interfaces:**
- Produces: `stripReasoning(raw: string): string`, `extractJsonObject<T>(raw: string): T` (throws `SyntaxError`), `groqReasoningParams(modelId: string): Record<string, unknown>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/reasoning.test.ts
import { describe, it, expect } from 'vitest';
import { stripReasoning, extractJsonObject, groqReasoningParams } from '../reasoning';

describe('stripReasoning', () => {
    it('removes closed think/thinking/reasoning blocks', () => {
        expect(stripReasoning('<think>hmm</think>Answer')).toBe('Answer');
        expect(stripReasoning('<thinking a="1">x</thinking> A <reasoning>y</reasoning>B')).toBe('A B');
    });
    it('removes an unclosed think block cut off by max_tokens', () => {
        expect(stripReasoning('{"a":1}<think>He wants JSON so I')).toBe('{"a":1}');
        expect(stripReasoning('<think>He wants JSON so I')).toBe('');
    });
    it('removes an orphan closing tag and everything before it', () => {
        expect(stripReasoning('partial thought</think>{"a":1}')).toBe('{"a":1}');
    });
    it('leaves normal text alone', () => {
        expect(stripReasoning('Use a hash map; O(n) time.')).toBe('Use a hash map; O(n) time.');
    });
});

describe('extractJsonObject', () => {
    it('parses JSON wrapped in think tags and code fences', () => {
        expect(extractJsonObject<{ a: number }>('<think>He</think>```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    });
    it('parses JSON with leading prose', () => {
        expect(extractJsonObject<{ ok: boolean }>('Here you go: {"ok": true} thanks')).toEqual({ ok: true });
    });
    it('throws SyntaxError when there is no object', () => {
        expect(() => extractJsonObject('<think>still thinking')).toThrow(SyntaxError);
    });
});

describe('groqReasoningParams', () => {
    it('gpt-oss: low effort, reasoning excluded', () => {
        expect(groqReasoningParams('openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low', include_reasoning: false });
    });
    it('qwen: hidden format, no reasoning effort', () => {
        expect(groqReasoningParams('qwen/qwen3.8-27b')).toEqual({ reasoning_format: 'hidden', reasoning_effort: 'none' });
    });
    it('other models: no extra params', () => {
        expect(groqReasoningParams('llama-3.3-70b-versatile')).toEqual({});
    });
});
```

- [ ] **Step 2: Run and confirm it fails.** Run: `npx vitest run src/lib/ai/__tests__/reasoning.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/reasoning.ts
/**
 * @codesage
 * @file      src/lib/ai/reasoning.ts
 * @purpose   One place to remove model reasoning from outputs and to request hidden reasoning from Groq.
 * @tech      TypeScript
 * @connects  Used by src/lib/ai/client.ts and JSON-producing generators (memory-generator)
 * @apis      Groq reasoning params (reasoning_format / include_reasoning / reasoning_effort)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */

const REASONING_TAGS = ['think', 'thinking', 'reasoning'] as const;

/** Remove <think>/<thinking>/<reasoning> content: closed blocks, unclosed tails (max_tokens cut) and orphan closers. */
export function stripReasoning(raw: string): string {
    let out = raw ?? '';
    for (const tag of REASONING_TAGS) {
        out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
        out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, 'i'), '');
        out = out.replace(new RegExp(`^[\\s\\S]*?</${tag}>`, 'i'), '');
    }
    return out.replace(/\s{2,}/g, ' ').trim();
}

/** Parse the first {...} object in a model reply after removing reasoning and code fences. */
export function extractJsonObject<T = unknown>(raw: string): T {
    const text = stripReasoning(raw).replace(/```(?:json)?/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new SyntaxError(`No JSON object in model output: "${text.slice(0, 80)}"`);
    }
    return JSON.parse(text.slice(start, end + 1)) as T;
}

/**
 * Groq request params that keep reasoning out of `content` and keep it short.
 * gpt-oss does not accept reasoning_format; qwen does. They are mutually exclusive with include_reasoning.
 */
export function groqReasoningParams(modelId: string): Record<string, unknown> {
    if (modelId.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
    if (modelId.startsWith('qwen/')) return { reasoning_format: 'hidden', reasoning_effort: 'none' };
    return {};
}
```

(The `\s{2,}` collapse in `stripReasoning` makes `'A <reasoning>y</reasoning>B'` → `'A B'`, matching the test.)

- [ ] **Step 4: Run the tests.** Expected: 10 passed.

- [ ] **Step 5: Wire into the client**
  - `client.ts` `stripThinkingTokens(raw)` body becomes `return stripReasoning(raw);` (import from `./reasoning`).
  - In `generateCompletion` (line 139), just before each `return` of a successful result object, add `if (result.response) result.response = stripReasoning(result.response);`. Use a small local `finalize(result)` helper so there is one call site.
  - In the non-streaming Groq body (~line 433) and the streaming body (~line 945), spread `...groqReasoningParams(modelId)` after `temperature`.

- [ ] **Step 6: Fix memory-generator.** In `src/lib/ai/memory-generator.ts`:
  - `maxTokens: 300` becomes `maxTokens: 800` (reasoning tokens still count against the cap).
  - The two parse lines become `return extractJsonObject<KaiMemoryStructured>(result.response);` (import from `./reasoning`).

- [ ] **Step 7: Verify.** Run `npx vitest run src/lib/ai src/lib/interview && npx tsc --noEmit`. Expected: all pass. If a `client` test asserts the exact Groq request body, update the expected body to include the reasoning params. That is an intended change.

---

### Task 4: Provider cooldown memory + chat-model filter

**Root cause:** `streamGroq` (`client.ts:916-960`) tries every Groq model in order on every turn with a round-robin key, and it has no memory of a (key, model) pair that already returned `429 tokens per day`. In the live run, each turn paid three failed round trips (`gpt-oss-safeguard-20b`, `120b`, `20b`) before falling back to Gemini. `gpt-oss-safeguard-20b` is a safety-policy classifier and must never be a chat candidate.

**Files:**
- Create: `src/lib/ai/provider-cooldown.ts`
- Modify: `src/lib/ai/client.ts` (export `groqKeyPool`; rewrite the candidate loop in `streamGroq` and in the non-streaming Groq call; filter non-chat models)
- Test: `src/lib/ai/__tests__/provider-cooldown.test.ts`
- Test: `src/lib/ai/__tests__/client.groq-cooldown.test.ts`

**Interfaces:**
- Produces:
  - `loadCooldowns(provider: 'groq' | 'gemini'): Promise<CooldownMap>`
  - `isCooling(map: CooldownMap, keyIndex: number, model: string, now?: number): boolean`
  - `markCooldown(provider, keyIndex, model, seconds): Promise<void>`
  - `parseRetryAfterSeconds(headers: Headers, bodyText: string): number`
  - `isChatModel(modelId: string): boolean`
  - `type CooldownMap = Record<string, number>` (pair key `${keyIndex}:${model}` → epoch ms until)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/provider-cooldown.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(async (k: string) => store.get(k) ?? null),
    redisSet: vi.fn(async (k: string, v: string) => { store.set(k, JSON.parse(v)); }), // Upstash auto-parses JSON on get
}));

import { loadCooldowns, isCooling, markCooldown, parseRetryAfterSeconds, isChatModel, __resetCooldownMemory } from '../provider-cooldown';

describe('provider-cooldown', () => {
    beforeEach(() => { store.clear(); __resetCooldownMemory(); });

    it('remembers a cooled (key, model) pair across loads, even when Redis returns a parsed object', async () => {
        await markCooldown('groq', 1, 'openai/gpt-oss-120b', 600);
        __resetCooldownMemory(); // simulate a fresh serverless instance
        const map = await loadCooldowns('groq');
        expect(isCooling(map, 1, 'openai/gpt-oss-120b')).toBe(true);
        expect(isCooling(map, 0, 'openai/gpt-oss-120b')).toBe(false);
        expect(isCooling(map, 1, 'openai/gpt-oss-20b')).toBe(false);
    });

    it('expires cooldowns', async () => {
        await markCooldown('groq', 0, 'm', 1);
        const map = await loadCooldowns('groq');
        expect(isCooling(map, 0, 'm', Date.now() + 2_000)).toBe(false);
    });

    it('parses retry-after header and Groq "try again in" text', () => {
        expect(parseRetryAfterSeconds(new Headers({ 'retry-after': '42' }), '')).toBe(42);
        expect(parseRetryAfterSeconds(new Headers(), 'Please try again in 7m12.5s.')).toBeCloseTo(432.5);
        expect(parseRetryAfterSeconds(new Headers(), 'try again in 1h2m3s')).toBe(3723);
        expect(parseRetryAfterSeconds(new Headers(), 'no hint')).toBe(60);
    });

    it('never treats guard/safeguard/whisper/tts models as chat models', () => {
        expect(isChatModel('openai/gpt-oss-120b')).toBe(true);
        expect(isChatModel('openai/gpt-oss-safeguard-20b')).toBe(false);
        expect(isChatModel('meta-llama/llama-prompt-guard-2-86m')).toBe(false);
        expect(isChatModel('whisper-large-v3-turbo')).toBe(false);
        expect(isChatModel('canopylabs/orpheus-v1-english')).toBe(false);
    });
});
```

```ts
// src/lib/ai/__tests__/client.groq-cooldown.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/lib/upstash/client', () => ({
    redisGet: vi.fn(async (k: string) => store.get(k) ?? null),
    redisSet: vi.fn(async (k: string, v: string) => { store.set(k, JSON.parse(v)); }),
    redisDel: vi.fn(), redisIncr: vi.fn(),
}));
vi.mock('@/lib/ai/model-registry', async (orig) => ({
    ...(await orig<object>()),
    getActiveModels: async () => [
        { id: 'openai/gpt-oss-safeguard-20b', provider: 'groq', tier: 0 },
        { id: 'openai/gpt-oss-120b', provider: 'groq', tier: 1 },
        { id: 'openai/gpt-oss-20b', provider: 'groq', tier: 2 },
    ],
}));

describe('streamGroq cooldown', () => {
    beforeEach(() => { store.clear(); process.env.GROQ_API_KEYS = 'k0,k1'; vi.restoreAllMocks(); });

    it('skips the safeguard model and does not retry a pair that returned 429 TPD on a previous turn', async () => {
        const calls: string[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            const body = JSON.parse(String((init as RequestInit).body));
            const auth = String(((init as RequestInit).headers as Record<string, string>).Authorization);
            calls.push(`${auth.slice(-2)}|${body.model}`);
            if (body.model === 'openai/gpt-oss-120b') {
                return new Response('{"error":{"message":"Rate limit reached for tokens per day (TPD). Please try again in 7m12.5s."}}', { status: 429 });
            }
            return new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        });
        const { UnifiedAIClient } = await import('../client');
        const client = new UnifiedAIClient();
        const drain = async () => { let s = ''; for await (const t of client.generateStream([{ role: 'user', content: 'q' }], { preferredProvider: 'groq' } as never)) s += t; return s; };

        await drain();
        expect(calls.some(c => c.includes('safeguard'))).toBe(false);
        const firstTurn120 = calls.filter(c => c.endsWith('gpt-oss-120b')).length;
        calls.length = 0;
        await drain();
        const secondTurn120 = calls.filter(c => c.endsWith('gpt-oss-120b')).length;
        expect(firstTurn120).toBeGreaterThanOrEqual(1);
        expect(secondTurn120).toBeLessThan(firstTurn120 + 1); // cooled pairs are skipped
        expect(calls[0]).toContain('gpt-oss-20b'); // second turn goes straight to a healthy model
    });
});
```

(Match `generateStream`'s real option name to the actual signature in `client.ts`. The assertions are what matter.)

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run src/lib/ai/__tests__/provider-cooldown.test.ts src/lib/ai/__tests__/client.groq-cooldown.test.ts`. Expected: FAIL (module missing; safeguard called).

- [ ] **Step 3: Implement `provider-cooldown.ts`**

```ts
// src/lib/ai/provider-cooldown.ts
/**
 * @codesage
 * @file      src/lib/ai/provider-cooldown.ts
 * @purpose   Remember (provider, key, model) pairs that hit a quota so later turns skip them instead of re-paying the 429.
 * @tech      TypeScript, Upstash Redis
 * @connects  Used by src/lib/ai/client.ts (chat) and src/app/api/voice/transcribe/route.ts (STT)
 * @apis      none
 * @db        none
 * @state     One Redis JSON value per provider + 5s in-memory cache per instance
 * @env       none
 * @issues    Upstash auto-parses JSON on get — accept both object and string
 * @audit     CODESAGE-v1
 */
import { redisGet, redisSet } from '@/lib/upstash/client';

export type CooldownMap = Record<string, number>;
type Provider = 'groq' | 'gemini';

const MAX_COOLDOWN_S = 24 * 3600;
const MEMORY_TTL_MS = 5_000;
const memory = new Map<Provider, { map: CooldownMap; loadedAt: number }>();
const redisKey = (p: Provider) => `ai:cooldowns:${p}`;
const pair = (keyIndex: number, model: string) => `${keyIndex}:${model}`;

export function __resetCooldownMemory(): void { memory.clear(); }

function coerce(raw: unknown): CooldownMap {
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw) as CooldownMap; } catch { return {}; } }
    if (typeof raw === 'object') return raw as CooldownMap;
    return {};
}

export async function loadCooldowns(provider: Provider): Promise<CooldownMap> {
    const cached = memory.get(provider);
    if (cached && Date.now() - cached.loadedAt < MEMORY_TTL_MS) return cached.map;
    let map: CooldownMap = cached?.map ?? {};
    try { map = { ...map, ...coerce(await redisGet(redisKey(provider))) }; } catch { /* Redis down → memory only */ }
    const now = Date.now();
    for (const [k, until] of Object.entries(map)) if (Number(until) <= now) delete map[k];
    memory.set(provider, { map, loadedAt: now });
    return map;
}

export function isCooling(map: CooldownMap, keyIndex: number, model: string, now = Date.now()): boolean {
    return Number(map[pair(keyIndex, model)] ?? 0) > now;
}

export async function markCooldown(provider: Provider, keyIndex: number, model: string, seconds: number): Promise<void> {
    const s = Math.min(Math.max(1, Math.ceil(seconds)), MAX_COOLDOWN_S);
    const map = await loadCooldowns(provider);
    map[pair(keyIndex, model)] = Date.now() + s * 1000;
    memory.set(provider, { map, loadedAt: Date.now() });
    try { await redisSet(redisKey(provider), JSON.stringify(map), MAX_COOLDOWN_S); } catch { /* best effort */ }
    console.warn(`[PIPE][AI] cooldown ${provider} key#${keyIndex} ${model} for ${s}s`);
}

/** Groq 429s carry `retry-after` (s) and text like "Please try again in 7m12.5s". */
export function parseRetryAfterSeconds(headers: Headers, bodyText: string): number {
    const h = Number(headers.get('retry-after'));
    if (Number.isFinite(h) && h > 0) return h;
    const m = /try again in\s*(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(bodyText ?? '');
    if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    return 60;
}

/** Models that must never serve a conversation (classifiers, guards, speech). */
export function isChatModel(modelId: string): boolean {
    return !/(safeguard|prompt-guard|llama-guard|whisper|orpheus|tts|distil-whisper)/i.test(modelId);
}
```

- [ ] **Step 4: Rewrite the Groq candidate loops in `client.ts`**
  - Export the pool: `export function groqKeyPool()` (line ~51).
  - Add a module-level `let groqKeyCursor = 0;`.
  - In `streamGroq`:

```ts
        const models = await getActiveModels();
        const groqModels = models.filter(m => m.provider === 'groq' && isChatModel(m.id));
        const candidates = groqModels.length ? groqModels.map(m => m.id) : ['openai/gpt-oss-20b'];
        const keys = groqKeyPool();
        const cooldowns = await loadCooldowns('groq');
        const startKey = groqKeyCursor++ % keys.length;

        let response: Response | null = null;
        let lastErr = '';
        outer: for (const modelId of candidates) {
            for (let n = 0; n < keys.length; n++) {
                const keyIndex = (startKey + n) % keys.length;
                if (isCooling(cooldowns, keyIndex, modelId)) continue;
                try {
                    const r = await fetch(this.GROQ_API_URL, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${keys[keyIndex]}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: modelId,
                            messages: apiMessages,
                            max_tokens: options.maxTokens ?? 4096,
                            temperature: options.temperature ?? 0.7,
                            ...groqReasoningParams(modelId),
                            stream: true,
                        }),
                        signal: options.signal ?? AbortSignal.timeout(30000),
                    });
                    if (r.ok && r.body) { response = r; this.lastStream = { model: modelId, provider: 'groq' }; break outer; }
                    const text = await r.text().catch(() => '');
                    if (r.status === 429) await markCooldown('groq', keyIndex, modelId, parseRetryAfterSeconds(r.headers, text));
                    lastErr = `Groq ${modelId} key#${keyIndex} (${r.status}): ${text.slice(0, 120)}`;
                } catch (e) {
                    lastErr = `Groq ${modelId} key#${keyIndex}: ${e instanceof Error ? e.message : String(e)}`;
                }
            }
        }
```

  - Apply the same pattern to the non-streaming Groq call (~lines 420-470): filter with `isChatModel`, skip cooled pairs, `markCooldown` on 429.
  - Log `[PIPE][AI] groq skipped N cooled pairs` once per call when N > 0.

- [ ] **Step 5: Run the tests.** Expected: both files pass. Then run `npx vitest run src/lib/ai && npx tsc --noEmit`, which must be all green.

---

### Task 5: Lean STT route (key pool, parallel preamble, Server-Timing)

**Root cause:** `/api/voice/transcribe` does four serial awaits before it contacts Groq: auth `getUser`, then the IP rate-limit, then the flag lookup, then `formData`. It uses a single key (`GROQ_API_KEY`), not the pool, and has no quota memory. The client measured 3.1–3.7 s, while Groq itself takes about 0.2–0.5 s for a 5 s clip.

**Files:**
- Modify: `src/app/api/voice/transcribe/route.ts`
- Test: `src/app/api/voice/transcribe/__tests__/route.test.ts` (create if absent; extend if present)

**Interfaces:**
- Consumes: `groqKeyPool`, `loadCooldowns`, `isCooling`, `markCooldown`, `parseRetryAfterSeconds` (Task 4).
- Produces: a response header `Server-Timing: pre;dur=<ms>, groq;dur=<ms>`, and JSON `{ text, model, confidence, duration, keyIndex }`.

- [ ] **Step 1: Write the failing test.** With `fetch` mocked:
  - Key #0 returns 429 with "try again in 30s", and key #1 returns `{ text: 'hello', duration: 1.2, segments: [] }`.
  - Assert the response has `text: 'hello'` and a `Server-Timing` header matching `/pre;dur=\d+, groq;dur=\d+/`.
  - Call a second time. Key #0 must not be called again (cooldown).
  - Mock `createServerSupabase` (user present), `checkIpRateLimit` (allowed) and `getGlobalFeatureFlag` (true) the way the existing API route tests in `src/app/api/**/__tests__` do.

- [ ] **Step 2: Run and confirm failure** (single key; no header).

- [ ] **Step 3: Implement.**
  - Run the preamble concurrently: `const [auth, rate, whisperEnabled, formData] = await Promise.all([supabase.auth.getUser(), checkIpRateLimit(...), getGlobalFeatureFlag('ENABLE_WHISPER_STT'), req.formData()]);`. The rate-limit and flag rejections keep their current responses.
  - Loop `models × keys` exactly as in Task 4 Step 4, keyed by provider `'groq'` so chat and STT share key health. Whisper TPD/ASD limits are per model, and the pair key keeps them distinct.
  - Time the preamble (`pre`) and the Groq call (`groq`) with `performance.now()`. Set the `Server-Timing` header and extend the existing `[PIPE][STT-server]` log with both numbers and `key#`.
  - Keep `response_format: 'verbose_json'` (it is used for confidence).

- [ ] **Step 4: Client reads the timing.** In `src/lib/voice/whisper-stt.ts` (~line 91), after `res.json()`, read `res.headers.get('server-timing')` and return it as `serverTiming?: string`. `useSTT.transcribeAudio` passes it to the turn timeline in Task 10.

- [ ] **Step 5: Verify.** Run `npx vitest run src/app/api/voice && npx tsc --noEmit`.

---

### Task 6: `SpeechQueue`, the single owner of `speechSynthesis`

**Root causes (live run: every line `spokenOk=false` with 22 voices, then "gibberish" at the end):**
1. `TTSEngine.speak()` always calls `speechSynthesis.cancel()` and then `speak()` right away. In Chrome, a speak issued within ~100 ms of a cancel is dropped or errored, and the `canceled`/`interrupted` error was muted in the logs (`tts-engine.ts:262`).
2. Three files assign the global `speechSynthesis.onvoiceschanged` property: `useTTS.ts:112`, `VoiceSettings.tsx:90`, and `tour/index.ts:322`, which even nulls it. The engine's voice therefore stayed `null`. No `utt.lang` was set, so the OS default voice read English text; on a Windows machine with a Hindi default that sounds like gibberish.
3. `tour/index.ts` and `VoiceSettings.tsx` call `cancel()`/`speak()` directly, so several owners race on one global engine.

**Files:**
- Create: `src/lib/voice/speech-queue.ts`
- Modify: `src/lib/voice/voice-utils.ts` (add `pickEnglishVoice`)
- Modify: `src/hooks/useTTS.ts` (thin wrapper over the queue; same return shape plus `enqueue`, `whenIdle`, `blocked`, `unlock`)
- Modify: `src/lib/tour/index.ts:290-335` and `src/components/settings/VoiceSettings.tsx:85-160` (use `getSpeechQueue()`; remove every `onvoiceschanged` assignment)
- Modify: `src/components/interview/InterviewSession.tsx` (call `unlock()` inside the Start click handler; "Tap to enable Kai's voice" banner when `blocked`)
- Modify: `eslint.config.mjs` (ban direct `speechSynthesis.speak/cancel/onvoiceschanged` outside `speech-queue.ts`)
- Delete: `src/lib/voice/tts-engine.ts` once nothing imports it (Polly is paid and flag-off; its API route stays but is no longer called)
- Test: `src/lib/voice/__tests__/speech-queue.test.ts`

**Interfaces:**
- Produces:

```ts
export type SpeechQueueEvent =
    | { type: 'speaking'; value: boolean }
    | { type: 'first-audio'; latencyMs: number; voice: string | null }
    | { type: 'error'; code: string }            // synthesis-failed, audio-busy, watchdog, no-english-voice, …
    | { type: 'blocked' };                        // 'not-allowed' — needs a user gesture
export class SpeechQueue {
    enqueue(text: string): void;
    stop(): void;
    unlock(): void;                               // call inside a click handler
    whenIdle(): Promise<void>;
    readonly speaking: boolean;
    on(fn: (e: SpeechQueueEvent) => void): () => void;
    configure(o: { preferredVoiceName?: string | null; rate?: number; pitch?: number }): void;
}
export function getSpeechQueue(): SpeechQueue;   // window singleton
export function pickEnglishVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | null;
```

- `useTTS()` returns `{ speak(text): Promise<void>, speakAndWait(text, retries?): Promise<boolean>, enqueue(text): void, whenIdle(): Promise<void>, stop(): void, unlock(): void, isSpeaking: boolean, blocked: boolean, provider: 'browser' }`.

- [ ] **Step 1: Write the failing tests** (a fake synth that reproduces Chrome's behaviour)

```ts
// src/lib/voice/__tests__/speech-queue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechQueue } from '../speech-queue';
import { pickEnglishVoice } from '../voice-utils';

type Utt = { text: string; lang: string; voice: SpeechSynthesisVoice | null; rate: number; pitch: number; volume: number;
    onstart: (() => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

const voice = (name: string, lang: string, isDefault = false) =>
    ({ name, lang, default: isDefault, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

/** Mimics Chrome: speak() within 100 ms of cancel() is silently dropped (no events). */
class FakeSynth {
    voices: SpeechSynthesisVoice[] = [];
    spoken: Utt[] = [];
    dropped: Utt[] = [];
    current: Utt | null = null;
    lastCancelAt = -Infinity;
    notAllowed = false;
    speaking = false; pending = false; paused = false;
    private listeners = new Set<() => void>();
    getVoices() { return this.voices; }
    addEventListener(_: 'voiceschanged', fn: () => void) { this.listeners.add(fn); }
    removeEventListener(_: 'voiceschanged', fn: () => void) { this.listeners.delete(fn); }
    fireVoicesChanged() { this.listeners.forEach(fn => fn()); }
    resume() { /* noop */ }
    speak(u: Utt) {
        if (Date.now() - this.lastCancelAt < 100) { this.dropped.push(u); return; }
        if (this.notAllowed) { setTimeout(() => u.onerror?.({ error: 'not-allowed' }), 0); return; }
        this.spoken.push(u); this.current = u; this.speaking = true;
        setTimeout(() => u.onstart?.(), 5);
    }
    finishCurrent() { const u = this.current; this.current = null; this.speaking = false; u?.onend?.(); }
    cancel() { this.lastCancelAt = Date.now(); const u = this.current; this.current = null; this.speaking = false; u?.onerror?.({ error: 'canceled' }); }
}

class FakeUtterance implements Utt {
    lang = ''; voice: SpeechSynthesisVoice | null = null; rate = 1; pitch = 1; volume = 1;
    onstart = null; onend = null; onerror = null;
    constructor(public text: string) {}
}

const make = (synth: FakeSynth) => new SpeechQueue({ synth: synth as unknown as SpeechSynthesis, Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance });

describe('SpeechQueue', () => {
    let synth: FakeSynth;
    beforeEach(() => { vi.useFakeTimers(); synth = new FakeSynth(); synth.voices = [voice('Google US English', 'en-US')]; });
    afterEach(() => vi.useRealTimers());

    it('speaks queued sentences in order, one at a time', async () => {
        const q = make(synth);
        q.enqueue('First sentence here.'); q.enqueue('Second sentence here.');
        await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken.map(u => u.text)).toEqual(['First sentence here.']);
        synth.finishCurrent(); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken.map(u => u.text)).toEqual(['First sentence here.', 'Second sentence here.']);
    });

    it('never speaks inside Chrome\'s post-cancel window (the live-run bug)', async () => {
        const q = make(synth);
        q.enqueue('Old reply sentence.'); await vi.advanceTimersByTimeAsync(10);
        q.stop();
        q.enqueue('New reply sentence.'); await vi.advanceTimersByTimeAsync(400);
        expect(synth.dropped).toHaveLength(0);
        expect(synth.spoken.at(-1)?.text).toBe('New reply sentence.');
    });

    it('does not report an error for the cancel it caused itself', async () => {
        const q = make(synth); const events: string[] = [];
        q.on(e => events.push(e.type));
        q.enqueue('Some sentence to stop.'); await vi.advanceTimersByTimeAsync(10);
        q.stop(); await vi.advanceTimersByTimeAsync(10);
        expect(events).not.toContain('error');
    });

    it('always sets an English lang/voice even when the OS default voice is Hindi', async () => {
        synth.voices = [voice('Microsoft Hemant - Hindi (India)', 'hi-IN', true), voice('Microsoft Zira - English (United States)', 'en-US')];
        const q = make(synth);
        q.enqueue('Hello there candidate.'); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].voice?.lang).toBe('en-US');
        expect(synth.spoken[0].lang).toBe('en-US');
    });

    it('waits for late-loading voices before the first utterance', async () => {
        synth.voices = [];
        const q = make(synth);
        q.enqueue('Late voices sentence.'); await vi.advanceTimersByTimeAsync(200);
        expect(synth.spoken).toHaveLength(0);
        synth.voices = [voice('Google UK English Female', 'en-GB')]; synth.fireVoicesChanged();
        await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].voice?.name).toBe('Google UK English Female');
    });

    it('falls back to lang=en-US and emits no-english-voice when no English voice exists', async () => {
        synth.voices = [voice('Hindi', 'hi-IN', true)];
        const q = make(synth); const codes: string[] = [];
        q.on(e => { if (e.type === 'error') codes.push(e.code); });
        q.enqueue('Anything at all here.'); await vi.advanceTimersByTimeAsync(10);
        expect(codes).toContain('no-english-voice');
        expect(synth.spoken[0].lang).toBe('en-US');
        expect(synth.spoken[0].voice).toBeNull();
    });

    it('emits blocked on not-allowed (needs a user gesture) and keeps the queue usable', async () => {
        synth.notAllowed = true;
        const q = make(synth); const types: string[] = [];
        q.on(e => types.push(e.type));
        q.enqueue('Blocked sentence here.'); await vi.advanceTimersByTimeAsync(10);
        expect(types).toContain('blocked');
        expect(q.speaking).toBe(false);
    });

    it('watchdog recovers when an utterance never ends', async () => {
        const q = make(synth); const codes: string[] = [];
        q.on(e => { if (e.type === 'error') codes.push(e.code); });
        q.enqueue('Stuck.'); q.enqueue('Next one after stuck.');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(codes).toContain('watchdog');
        expect(synth.spoken.at(-1)?.text).toBe('Next one after stuck.');
    });

    it('splits sentences longer than 200 chars (Chrome ~15s cut-off) at commas', async () => {
        const q = make(synth);
        const long = 'a'.repeat(120) + ', ' + 'b'.repeat(120) + '.';
        q.enqueue(long); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].text.length).toBeLessThanOrEqual(200);
    });

    it('whenIdle resolves after the last utterance ends', async () => {
        const q = make(synth); let idle = false;
        q.enqueue('Only sentence here.'); void q.whenIdle().then(() => { idle = true; });
        await vi.advanceTimersByTimeAsync(10); expect(idle).toBe(false);
        synth.finishCurrent(); await vi.advanceTimersByTimeAsync(10); expect(idle).toBe(true);
    });
});

describe('pickEnglishVoice', () => {
    it('prefers natural/Google voices, then en-US, en-GB, en-IN, never non-English', () => {
        const vs = [voice('Hindi', 'hi-IN', true), voice('Microsoft David', 'en-US'), voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US')];
        expect(pickEnglishVoice(vs)?.name).toContain('Natural');
        expect(pickEnglishVoice([voice('Hindi', 'hi-IN', true)])).toBeNull();
        expect(pickEnglishVoice(vs, 'Microsoft David')?.name).toBe('Microsoft David');
        expect(pickEnglishVoice(vs, 'Hindi')?.lang.startsWith('en')).toBe(true); // a non-English preference is ignored
    });
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run src/lib/voice/__tests__/speech-queue.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `pickEnglishVoice` in `voice-utils.ts`**

```ts
const ENGLISH_VOICE_PRIORITY: RegExp[] = [
    /\(Natural\)/i,                 // Edge online neural voices (free, high quality)
    /^Google US English$/i,
    /^Google UK English (Female|Male)$/i,
    /^(Samantha|Alex|Daniel|Karen)$/i,  // macOS/iOS
    /Microsoft (Aria|Jenny|Guy|Zira|David|Mark)/i,
];

/** Best English voice; returns null when the device has no English voice at all. */
export const pickEnglishVoice = (voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | null => {
    const english = (voices ?? []).filter(v => /^en([-_]|$)/i.test(v.lang));
    if (!english.length) return null;
    if (preferredName) {
        const pref = english.find(v => v.name === preferredName);
        if (pref) return pref;
    }
    for (const re of ENGLISH_VOICE_PRIORITY) {
        const hit = english.find(v => re.test(v.name));
        if (hit) return hit;
    }
    return english.find(v => /en[-_]US/i.test(v.lang))
        ?? english.find(v => /en[-_]GB/i.test(v.lang))
        ?? english.find(v => /en[-_]IN/i.test(v.lang))
        ?? english[0];
};
```

- [ ] **Step 4: Implement `speech-queue.ts`**

```ts
// src/lib/voice/speech-queue.ts
/**
 * @codesage
 * @file      src/lib/voice/speech-queue.ts
 * @purpose   The ONLY owner of window.speechSynthesis: ordered sentence queue, no cancel→speak race, English voice guarantee, watchdog.
 * @tech      Web Speech API (SpeechSynthesis)
 * @connects  useTTS, tour, VoiceSettings preview — nothing else may call speechSynthesis directly (ESLint-enforced)
 * @apis      none
 * @db        none
 * @state     window singleton
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { pickEnglishVoice } from './voice-utils';
import { preprocessForTTS } from './tts-preprocessor';

export type SpeechQueueEvent =
    | { type: 'speaking'; value: boolean }
    | { type: 'first-audio'; latencyMs: number; voice: string | null }
    | { type: 'error'; code: string }
    | { type: 'blocked' };

interface Deps { synth: SpeechSynthesis; Utterance: typeof SpeechSynthesisUtterance; }

const CANCEL_SETTLE_MS = 250;   // Chrome drops speak() issued right after cancel()
const VOICES_TIMEOUT_MS = 1500;
const MAX_CHARS = 200;          // Chrome network voices stop after ~15 s
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function sanitize(text: string): string {
    return preprocessForTTS(text ?? '')
        .replace(/\$\$?([^$]*)\$\$?/g, '$1')
        .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
        .replace(/\^2\b/g, ' squared').replace(/\^3\b/g, ' cubed')
        .replace(/\bO\(([^)]+)\)/g, 'O of $1')
        .replace(/[`*_#>~$]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function splitForChrome(text: string): string[] {
    const out: string[] = [];
    let rest = text;
    while (rest.length > MAX_CHARS) {
        const win = rest.slice(0, MAX_CHARS);
        const comma = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
        const at = comma > 40 ? comma + 1 : Math.max(win.lastIndexOf(' '), 1);
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
    return out;
}

/** ~14 chars/s at rate 1 — used only for the watchdog. */
const estimateMs = (text: string, rate: number) => (text.length / 14) * 1000 / Math.max(rate, 0.5);

export class SpeechQueue {
    private queue: string[] = [];
    private current: SpeechSynthesisUtterance | null = null;
    private generation = 0;
    private settleUntil = 0;
    private voice: SpeechSynthesisVoice | null = null;
    private voicesReady: Promise<void>;
    private preferredVoiceName: string | null = null;
    private rate = 1;
    private pitch = 1;
    private firstAudioFrom: number | null = null;
    private listeners = new Set<(e: SpeechQueueEvent) => void>();
    private idleWaiters: Array<() => void> = [];
    private pumping = false;
    private reportedNoEnglish = false;
    private announcedSpeaking = false;   // guarantees exactly one speaking:true / speaking:false pair

    constructor(private deps: Deps) {
        this.voicesReady = this.waitForVoices();
        // Keep a persistent listener (addEventListener never clobbers other owners).
        deps.synth.addEventListener?.('voiceschanged', () => {
            this.voice = pickEnglishVoice(deps.synth.getVoices(), this.preferredVoiceName) ?? this.voice;
        });
    }

    get speaking(): boolean { return this.current !== null || this.queue.length > 0; }

    on(fn: (e: SpeechQueueEvent) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    private emit(e: SpeechQueueEvent) { this.listeners.forEach(fn => { try { fn(e); } catch { /* listener bug must not break audio */ } }); }

    configure(o: { preferredVoiceName?: string | null; rate?: number; pitch?: number }) {
        if (o.preferredVoiceName !== undefined) {
            this.preferredVoiceName = o.preferredVoiceName;
            this.voice = pickEnglishVoice(this.deps.synth.getVoices(), o.preferredVoiceName);
        }
        if (o.rate !== undefined) this.rate = Math.max(0.5, Math.min(2, o.rate));
        if (o.pitch !== undefined) this.pitch = Math.max(0.5, Math.min(2, o.pitch));
    }

    enqueue(text: string): void {
        const clean = sanitize(text);
        if (!clean) return;
        this.queue.push(...splitForChrome(clean));
        if (!this.announcedSpeaking) {
            this.announcedSpeaking = true;
            this.firstAudioFrom = now();
            this.emit({ type: 'speaking', value: true });
        }
        void this.pump();
    }

    whenIdle(): Promise<void> {
        if (!this.speaking) return Promise.resolve();
        return new Promise(r => this.idleWaiters.push(r));
    }

    stop(): void {
        const hadAudio = this.current !== null || this.deps.synth.speaking || this.deps.synth.pending;
        this.generation++;
        this.queue = [];
        this.current = null;
        if (hadAudio) {
            this.deps.synth.cancel();
            this.settleUntil = now() + CANCEL_SETTLE_MS;
        }
        this.becomeIdle();
    }

    /** Satisfies Chrome's user-activation rule. Call synchronously inside a click handler. */
    unlock(): void {
        try {
            const u = new this.deps.Utterance(' ');
            u.volume = 0;
            this.deps.synth.speak(u);
        } catch { /* ignore */ }
    }

    private becomeIdle() {
        if (this.speaking || !this.announcedSpeaking) return;
        this.announcedSpeaking = false;
        this.firstAudioFrom = null;
        this.emit({ type: 'speaking', value: false });
        const waiters = this.idleWaiters; this.idleWaiters = [];
        waiters.forEach(w => w());
    }

    private waitForVoices(): Promise<void> {
        return new Promise<void>((resolve) => {
            const synth = this.deps.synth;
            const done = () => { this.voice = pickEnglishVoice(synth.getVoices(), this.preferredVoiceName); resolve(); };
            if (synth.getVoices().length > 0) { done(); return; }
            const onChange = () => {
                if (synth.getVoices().length === 0) return;
                synth.removeEventListener?.('voiceschanged', onChange);
                clearTimeout(timer); done();
            };
            synth.addEventListener?.('voiceschanged', onChange);
            const timer = setTimeout(() => { synth.removeEventListener?.('voiceschanged', onChange); done(); }, VOICES_TIMEOUT_MS);
        });
    }

    private async pump(): Promise<void> {
        if (this.pumping) return;
        this.pumping = true;
        try {
            while (!this.current && this.queue.length > 0) {
                const gen = this.generation;
                await this.voicesReady;
                const wait = this.settleUntil - now();
                if (wait > 0) await sleep(wait);
                if (gen !== this.generation || this.current || this.queue.length === 0) continue;
                await this.speakOne(this.queue.shift()!, gen);
            }
        } finally {
            this.pumping = false;
        }
    }

    /** Resolves when this utterance ends, errors, or the watchdog fires. */
    private speakOne(text: string, gen: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const utt = new this.deps.Utterance(text);
            if (!this.voice && !this.reportedNoEnglish) { this.reportedNoEnglish = true; this.emit({ type: 'error', code: 'no-english-voice' }); }
            utt.lang = this.voice?.lang ?? 'en-US';
            if (this.voice) utt.voice = this.voice;
            utt.rate = this.rate; utt.pitch = this.pitch; utt.volume = 1;
            this.current = utt;

            let settled = false;
            const finish = (outcome: string) => {
                if (settled) return; settled = true;
                clearTimeout(watchdog);
                if (this.current === utt) this.current = null;
                if (outcome === 'watchdog') {
                    this.deps.synth.cancel();
                    this.settleUntil = now() + CANCEL_SETTLE_MS;
                }
                if (!this.speaking) this.becomeIdle();
                resolve();
            };
            const watchdog = setTimeout(() => { this.emit({ type: 'error', code: 'watchdog' }); finish('watchdog'); }, estimateMs(text, this.rate) * 2 + 4000);

            utt.onstart = () => {
                if (this.firstAudioFrom !== null) {
                    this.emit({ type: 'first-audio', latencyMs: Math.round(now() - this.firstAudioFrom), voice: this.voice?.name ?? null });
                    this.firstAudioFrom = null;
                }
            };
            utt.onend = () => finish('end');
            utt.onerror = (e: SpeechSynthesisErrorEvent | { error: string }) => {
                const code = e.error;
                // A cancel we caused ourselves (stop() or the watchdog) is not an error.
                if ((code === 'canceled' || code === 'interrupted') && (gen !== this.generation || this.current !== utt)) { finish('stopped'); return; }
                if (code === 'not-allowed') { this.queue = []; this.emit({ type: 'blocked' }); }
                else this.emit({ type: 'error', code });
                finish(code);
            };
            try { this.deps.synth.resume(); } catch { /* noop */ }
            console.info(`[PIPE][TTS] utter len=${text.length} voice=${this.voice?.name ?? 'lang:en-US'}`);
            this.deps.synth.speak(utt);
        });
    }
}

export function getSpeechQueue(): SpeechQueue {
    const w = window as unknown as { __ALGOMIND_SPEECH_QUEUE__?: SpeechQueue };
    if (!w.__ALGOMIND_SPEECH_QUEUE__) {
        w.__ALGOMIND_SPEECH_QUEUE__ = new SpeechQueue({ synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance });
    }
    return w.__ALGOMIND_SPEECH_QUEUE__;
}
```

- [ ] **Step 5: Run the queue tests.** Expected: 11 passed. If `'watchdog recovers'` is flaky, check that the fake's `speak` for `'Stuck.'` never calls `onend`. It shouldn't: nothing calls `finishCurrent`.

- [ ] **Step 6: Rewrite `useTTS.ts` over the queue.** Keep the export name and the options.
  - Remove Polly and `TTSEngine`.
  - On mount: `const q = getSpeechQueue(); q.configure({ preferredVoiceName: opts.voiceName ?? null, rate: opts.voiceRate ?? 1, pitch: opts.voicePitch ?? 1 });`. Subscribe with `q.on`: `speaking` sets `isSpeaking` and calls `onSpeakStart`/`onSpeakEnd`; `blocked` sets `blocked=true`; `first-audio` and `error` are forwarded to `opts.onEvent?.(e)` (a new optional option used by Task 10).
  - Return:
    - `enqueue: (t) => q.enqueue(t)`
    - `speak: async (t) => { q.enqueue(t); }`
    - `speakAndWait: async (t) => { q.enqueue(t); await q.whenIdle(); return !blockedRef.current; }`
    - `stop: () => q.stop()`
    - `unlock: () => { q.unlock(); setBlocked(false); }`
    - `whenIdle: () => q.whenIdle()`
    - `isSpeaking`, `blocked`, `provider: 'browser' as const`
  - Delete the `onvoiceschanged` effect entirely.

- [ ] **Step 7: Migrate the other owners.**
  - `tour/index.ts:290-335`: replace `speechSynthesis.cancel()` with `getSpeechQueue().stop()`, and `speak(utt)` with `getSpeechQueue().enqueue(text)`. Delete the `onvoiceschanged` block.
  - `VoiceSettings.tsx`: load voices with `addEventListener('voiceschanged', h)`/`removeEventListener`; the preview button calls `const q = getSpeechQueue(); q.configure({ preferredVoiceName: selected, rate, pitch }); q.stop(); q.enqueue(sample)`.

- [ ] **Step 8: Wire `unlock` and the blocked banner in `InterviewSession`.**
  - In the Start-interview click handler, before any `await`, call `voice.unlock?.()`. Expose `unlock` and `blocked` through `useInterview().voice` by passing `tts.unlock` and `tts.blocked`.
  - When `voice.blocked`, render a button banner: "Kai's voice is blocked by the browser. Tap to enable." `onClick = voice.unlock`, then re-enqueue the last assistant message.

- [ ] **Step 9: ESLint guard.** In `eslint.config.mjs`, add a config object:

```js
{
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/voice/speech-queue.ts', 'src/**/__tests__/**', 'src/test-utils/**'],
    rules: {
        'no-restricted-syntax': ['error',
            { selector: "MemberExpression[object.property.name='speechSynthesis'][property.name=/^(speak|cancel|onvoiceschanged)$/]", message: 'Use getSpeechQueue() — speech-queue.ts is the only owner of speechSynthesis.' },
            { selector: "MemberExpression[object.name='speechSynthesis'][property.name=/^(speak|cancel|onvoiceschanged)$/]", message: 'Use getSpeechQueue() — speech-queue.ts is the only owner of speechSynthesis.' },
        ],
    },
},
```

Run `npx eslint src`. Expected: 0 errors. Any hit is a leftover owner; migrate it.

- [ ] **Step 10: Verify.** Run `npx vitest run src/lib/voice src/hooks src/components && npx tsc --noEmit && npx eslint src`. Update the tests that mocked `TTSEngine` so they mock `getSpeechQueue`. Keep their behavioural assertions.

---

### Task 7: Sentence streaming (Kai speaks while the reply is still generating)

**Root cause:** `submitUserResponse` and `startInterview` call `speak(responseText)` only after `callChatApi` returns the complete reply (`useInterview.ts:780`, `:1043`). The candidate hears nothing during the whole generation.

**Files:**
- Create: `src/lib/voice/sentence-streamer.ts`
- Modify: `src/hooks/useInterview.ts`:
  - `callChatApi` gains `onDelta?: (delta: string) => void`, called where `fullText += parsed.delta` (~line 557).
  - In `submitUserResponse` and `startInterview`, create a `SentenceStreamer` per reply; each delta goes to `streamer.push(delta).forEach(tts.enqueue)`; after the stream, `streamer.flush().forEach(tts.enqueue)`; remove the later `speak(responseText)` calls.
- Test: `src/lib/voice/__tests__/sentence-streamer.test.ts`

**Interfaces:**
- Produces: `class SentenceStreamer { push(delta: string): string[]; flush(): string[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/voice/__tests__/sentence-streamer.test.ts
import { describe, it, expect } from 'vitest';
import { SentenceStreamer } from '../sentence-streamer';

const run = (deltas: string[]) => {
    const s = new SentenceStreamer(); const out: string[] = [];
    for (const d of deltas) out.push(...s.push(d));
    out.push(...s.flush());
    return out;
};

describe('SentenceStreamer', () => {
    it('emits a sentence as soon as it is complete', () => {
        const s = new SentenceStreamer();
        expect(s.push('Great, let us start with the ')).toEqual([]);
        expect(s.push('constraints. What is')).toEqual(['Great, let us start with the constraints.']);
        expect(s.flush()).toEqual(['What is']);
    });
    it('does not split decimals, O(n log n), or abbreviations', () => {
        expect(run(['It runs in O(n log n) time, e.g. merge sort. That is 1.5x faster.']))
            .toEqual(['It runs in O(n log n) time, e.g. merge sort.', 'That is 1.5x faster.']);
    });
    it('merges very short fragments with the next sentence', () => {
        expect(run(['Okay. Walk me through your approach.'])).toEqual(['Okay. Walk me through your approach.']);
    });
    it('never speaks code blocks', () => {
        expect(run(['Try this:\n```python\ndef f(x):\n  return x\n```\nWhat is its complexity?']))
            .toEqual(['Try this:', 'What is its complexity?']);
    });
    it('strips TERMINATE_INTERVIEW even when split across deltas', () => {
        expect(run(['Thanks for your time today. TERMINATE_', 'INTERVIEW'])).toEqual(['Thanks for your time today.']);
    });
    it('treats newlines as boundaries and skips empty lines', () => {
        expect(run(['First point is here.\n\nSecond point is here.'])).toEqual(['First point is here.', 'Second point is here.']);
    });
    it('cuts run-on text longer than 220 chars at a comma', () => {
        const out = run([`${'word '.repeat(30)}, ${'more '.repeat(30)}`]);
        expect(out.every(s => s.length <= 220)).toBe(true);
    });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

```ts
// src/lib/voice/sentence-streamer.ts
/**
 * @codesage
 * @file      src/lib/voice/sentence-streamer.ts
 * @purpose   Turn streamed LLM deltas into speakable sentences so TTS starts before generation finishes.
 * @tech      TypeScript
 * @connects  useInterview (chat SSE → SpeechQueue)
 * @apis      none
 * @db        none
 * @state     Per-reply buffer
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
const CONTROL_TOKENS = ['TERMINATE_INTERVIEW'];
const ABBREVIATION_END = /\b(e\.g|i\.e|etc|vs|approx|Dr|Mr|Mrs|Ms|No)\.$/i;
const MIN_CHARS = 12;
const MAX_CHARS = 220;
const FENCE = '```';

function split(text: string, final: boolean): { sentences: string[]; rest: string } {
    const sentences: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;
        const next = text[i + 1];
        if (next === undefined && !final) break;                  // need lookahead
        if (ch !== '\n' && next !== undefined && !/\s/.test(next)) continue; // 1.5, O(n).x
        const candidate = text.slice(start, i + 1);
        if (!candidate.trim()) { start = i + 1; continue; }
        if (ch === '.' && ABBREVIATION_END.test(candidate.trim())) continue;
        // Merge short fragments ("Okay.") with the next sentence: always while streaming,
        // and on flush only if more text follows.
        const hasMore = text.slice(i + 1).trim().length > 0;
        if (candidate.trim().length < MIN_CHARS && ch !== '\n' && (hasMore || !final)) continue;
        sentences.push(candidate.trim());
        start = i + 1;
    }
    let rest = text.slice(start);
    while (rest.length > MAX_CHARS) {
        const win = rest.slice(0, MAX_CHARS);
        const comma = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
        const at = comma > 40 ? comma + 1 : win.lastIndexOf(' ');
        if (at <= 0) break;
        sentences.push(rest.slice(0, at).trim());
        rest = rest.slice(at);
    }
    if (final && rest.trim()) { sentences.push(rest.trim()); rest = ''; }
    return { sentences, rest };
}

export class SentenceStreamer {
    private buffer = '';
    private inFence = false;

    push(delta: string): string[] { this.buffer += delta ?? ''; return this.drain(false); }
    flush(): string[] { return this.drain(true); }

    private drain(final: boolean): string[] {
        for (const t of CONTROL_TOKENS) this.buffer = this.buffer.split(t).join('');
        const out: string[] = [];
        for (;;) {
            if (this.inFence) {
                const close = this.buffer.indexOf(FENCE);
                if (close === -1) { this.buffer = final ? '' : this.buffer.slice(-2); break; }
                this.buffer = this.buffer.slice(close + FENCE.length);
                this.inFence = false;
                continue;
            }
            const open = this.buffer.indexOf(FENCE);
            if (open !== -1) {
                out.push(...split(this.buffer.slice(0, open), true).sentences);
                this.buffer = this.buffer.slice(open + FENCE.length);
                this.inFence = true;
                continue;
            }
            // Hold back a possible partial control token / fence at the tail.
            const { sentences, rest } = split(this.buffer, final);
            out.push(...sentences);
            this.buffer = rest;
            break;
        }
        return out.map(s => s.replace(/^[-*•]\s+/, '').trim()).filter(s => s.length > 0);
    }
}
```

- [ ] **Step 4: Run the tests.** Expected: 7 passed. If "cuts run-on" fails, check that `split()` is reached with `final=true` from `flush()`. The `while (rest.length > MAX_CHARS)` loop must run before the final push.

- [ ] **Step 5: Wire into `useInterview`**
  - `callChatApi(prompt, sys, ctx, streamingMessageId?, onDelta?)`: after `fullText += parsed.delta;`, add `onDelta?.(parsed.delta);`.
  - In `submitUserResponse` (~line 711):

```ts
            const streamer = new SentenceStreamer();
            const speakDelta = (d: string) => {
                if (!voiceEnabledRef.current) return;
                for (const s of streamer.push(d)) tts.enqueue(s);
            };
            const responseText = await callChatApi(prompt, currentSysPrompt, problemContext, streamingMsgId, speakDelta);
            if (voiceEnabledRef.current) for (const s of streamer.flush()) tts.enqueue(s);
```

    Then **delete** the later `speak(responseText).catch(...)` block (~780). The TERMINATE branch no longer needs special speech handling: the closing lines were already spoken, and the streamer removed the token.
  - Do the same in `startInterview` (~1043). The guest intro keeps `speakAndWait(GUEST_INTRO_TEXT)`.
  - `isSpeaking` now reflects the queue (Task 6), so the mic effect naturally waits until the last sentence has played.

- [ ] **Step 6: Verify.** Run `npx vitest run src/lib/voice src/hooks && npx tsc --noEmit`. Orchestrator tests that asserted `speak(fullText)` must now assert `enqueue` calls whose concatenation equals the spoken text.

---

### Task 8: `MicController`, the single owner of the mic and VAD

**Root causes (live run: "mic not working" mid-interview; the mic came back only after switching tabs):**
1. **Deferred-stop race** (`useVAD.ts:188-205`). `stopListening()` during speech schedules a forced pause 3.5 s later. A `startListening()` 50 ms later sees `LISTENING` and returns without cancelling that timer, so the timer pauses the VAD mid-interview.
2. **Two truths.** The mic sync effect (`useInterview.ts:1154`) checks `stt.isListening`, not the VAD state. After the timer paused the VAD, `stt.isListening` stayed true, so nothing restarted it. The only recovery was the tab-visibility handler, which is exactly what the candidate saw.
3. **Sticky error.** `VADManager` in `ERROR` throws on every `start()` forever (`vad-manager.ts:350`), and `useVAD` permanently downgrades to push-to-talk.

**Fix:**
- Enable vad-web's own `submitUserSpeechOnPause`. Pausing mid-speech then delivers the audio through `onSpeechEnd`, so the deferred-stop hack is deleted.
- Put every start and stop behind one serialized controller that reconciles the *desired* state.
- Self-heal from errors, dead AudioContexts and unplugged devices.

**Files:**
- Create: `src/lib/voice/mic-controller.ts`
- Modify: `src/lib/voice/vad-manager.ts`:
  - `model: 'v5'`
  - pass `submitUserSpeechOnPause: true`
  - add a public `lastFrameAt` updated on every frame, before the early return at line 249
  - on `init()` failure set state `IDLE` (not a sticky `ERROR`), so a fresh manager can retry
- Modify: `src/hooks/useVAD.ts`. Same public API (`mode, isListening, isReady, startListening, stopListening`) plus `status` and `poke`. Internals become `MicController`, and the deferred-stop code is deleted.
- Modify: `src/hooks/useInterview.ts:1087-1111`. The visibility handler calls `vad.poke('visible')` on becoming visible.
- Test: `src/lib/voice/__tests__/mic-controller.test.ts`

**Interfaces:**
- Produces:

```ts
export type MicIntent = 'listen' | 'mute' | 'off';
export type MicStatus = 'off' | 'starting' | 'listening' | 'muted' | 'recovering' | 'failed';
export interface VadHandle { start(): Promise<void>; pause(): Promise<void>; destroy(): Promise<void>; lastFrameAt(): number; }
export interface VadCallbacks { onSpeechStart(): void; onSpeechEnd(audio: Float32Array): void; onFrame(prob: number): void; }
export type VadFactory = (cb: VadCallbacks) => Promise<VadHandle>;
export class MicController {
    constructor(o: { createVad: VadFactory; onStatus?(s: MicStatus, detail?: string): void; onSpeechStart?(): void;
        onSpeechEnd?(a: Float32Array): void; onFrame?(p: number): void; retryDelaysMs?: number[]; watchdogMs?: number; now?(): number });
    setIntent(i: MicIntent): Promise<void>;
    poke(reason: string): Promise<void>;
    readonly status: MicStatus;
    dispose(): Promise<void>;
}
export const createBrowserVad: VadFactory;
```

- `useVAD()` returns `{ mode, isListening, isReady, status, startListening(), stopListening(force?), poke(reason) }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/voice/__tests__/mic-controller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MicController, type VadCallbacks, type VadHandle } from '../mic-controller';

function fakeVadFactory() {
    const state = { listening: false, starts: 0, pauses: 0, destroys: 0, failStartsRemaining: 0, lastFrame: 0, created: 0 };
    let cb: VadCallbacks | null = null;
    const factory = vi.fn(async (c: VadCallbacks): Promise<VadHandle> => {
        cb = c; state.created++;
        return {
            start: async () => { state.starts++; if (state.failStartsRemaining > 0) { state.failStartsRemaining--; throw new Error('NotReadableError'); } state.listening = true; state.lastFrame = Date.now(); },
            pause: async () => { state.pauses++; state.listening = false; },
            destroy: async () => { state.destroys++; state.listening = false; },
            lastFrameAt: () => state.lastFrame,
        };
    });
    return { factory, state, cb: () => cb! };
}

describe('MicController', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stop→start within 50ms ends LISTENING (regression: deferred-stop race)', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory });
        await mic.setIntent('listen');
        void mic.setIntent('off');
        await vi.advanceTimersByTimeAsync(50);
        await mic.setIntent('listen');
        await vi.advanceTimersByTimeAsync(5_000); // any stray timer would pause it here
        expect(mic.status).toBe('listening');
        expect(f.state.listening).toBe(true);
    });

    it('recovers from a start failure with backoff', async () => {
        const f = fakeVadFactory(); f.state.failStartsRemaining = 2;
        const statuses: string[] = [];
        const mic = new MicController({ createVad: f.factory, retryDelaysMs: [100, 200, 400], onStatus: s => statuses.push(s) });
        const p = mic.setIntent('listen');
        await vi.advanceTimersByTimeAsync(1_000); await p;
        expect(mic.status).toBe('listening');
        expect(statuses).toContain('recovering');
        expect(f.state.created).toBeGreaterThanOrEqual(2); // fresh VAD after failure, never a sticky ERROR
    });

    it('reports failed after retries are exhausted, and a poke retries again', async () => {
        const f = fakeVadFactory(); f.state.failStartsRemaining = 99;
        const mic = new MicController({ createVad: f.factory, retryDelaysMs: [10, 10] });
        const p = mic.setIntent('listen'); await vi.advanceTimersByTimeAsync(500); await p;
        expect(mic.status).toBe('failed');
        f.state.failStartsRemaining = 0;
        await mic.poke('user-retry');
        expect(mic.status).toBe('listening');
    });

    it('watchdog restarts a VAD that stopped producing frames (suspended AudioContext / unplugged mic)', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory, watchdogMs: 3_000 });
        await mic.setIntent('listen');
        f.state.lastFrame = Date.now() - 10_000; // frames stopped
        await vi.advanceTimersByTimeAsync(1_500);
        expect(f.state.created).toBe(2);
        expect(mic.status).toBe('listening');
    });

    it('mute pauses immediately and stays paused until intent changes', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory });
        await mic.setIntent('listen');
        await mic.setIntent('mute');
        expect(mic.status).toBe('muted');
        expect(f.state.listening).toBe(false);
        await mic.poke('visible');
        expect(f.state.listening).toBe(false);
    });

    it('forwards speech end audio even when paused mid-utterance', async () => {
        const f = fakeVadFactory(); const got: number[] = [];
        const mic = new MicController({ createVad: f.factory, onSpeechEnd: a => got.push(a.length) });
        await mic.setIntent('listen');
        f.cb().onSpeechEnd(new Float32Array(16000));
        await mic.setIntent('off');
        f.cb().onSpeechEnd(new Float32Array(8000)); // submitUserSpeechOnPause tail
        expect(got).toEqual([16000, 8000]);
    });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `mic-controller.ts`**

```ts
// src/lib/voice/mic-controller.ts
/**
 * @codesage
 * @file      src/lib/voice/mic-controller.ts
 * @purpose   The ONLY owner of the microphone + Silero VAD. Serialized start/stop, self-healing, watchdog.
 * @tech      TypeScript
 * @connects  useVAD (React wrapper); vad-manager (createBrowserVad)
 * @apis      none
 * @db        none
 * @state     Desired intent + observed status
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { getVADManager, resetVADManager } from './vad-manager';

export type MicIntent = 'listen' | 'mute' | 'off';
export type MicStatus = 'off' | 'starting' | 'listening' | 'muted' | 'recovering' | 'failed';
export interface VadHandle { start(): Promise<void>; pause(): Promise<void>; destroy(): Promise<void>; lastFrameAt(): number; }
export interface VadCallbacks { onSpeechStart(): void; onSpeechEnd(audio: Float32Array): void; onFrame(prob: number): void; }
export type VadFactory = (cb: VadCallbacks) => Promise<VadHandle>;

interface Options {
    createVad: VadFactory;
    onStatus?(s: MicStatus, detail?: string): void;
    onSpeechStart?(): void;
    onSpeechEnd?(audio: Float32Array): void;
    onFrame?(prob: number): void;
    retryDelaysMs?: number[];
    watchdogMs?: number;
    now?(): number;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class MicController {
    private intent: MicIntent = 'off';
    private _status: MicStatus = 'off';
    private vad: VadHandle | null = null;
    private chain: Promise<void> = Promise.resolve();
    private watchdog: ReturnType<typeof setInterval> | null = null;
    private readonly retry: number[];
    private readonly watchdogMs: number;
    private readonly now: () => number;

    constructor(private o: Options) {
        this.retry = o.retryDelaysMs ?? [500, 1500, 4000];
        this.watchdogMs = o.watchdogMs ?? 4000;
        this.now = o.now ?? (() => Date.now());
    }

    get status(): MicStatus { return this._status; }

    setIntent(next: MicIntent): Promise<void> { this.intent = next; return this.serial(() => this.reconcile()); }
    poke(reason: string): Promise<void> {
        if (this._status === 'failed' && this.intent === 'listen') this._status = 'off';
        console.info(`[PIPE][MIC] poke (${reason}) intent=${this.intent} status=${this._status}`);
        return this.serial(() => this.reconcile());
    }

    async dispose(): Promise<void> {
        this.intent = 'off';
        await this.serial(async () => { this.stopWatchdog(); await this.teardown(); this.setStatus('off'); });
    }

    private serial(op: () => Promise<void>): Promise<void> {
        this.chain = this.chain.then(op, op).catch(err => console.error('[PIPE][MIC] op failed', err));
        return this.chain;
    }

    private setStatus(s: MicStatus, detail?: string) {
        if (this._status === s) return;
        this._status = s;
        console.info(`[PIPE][MIC] status=${s}${detail ? ` (${detail})` : ''}`);
        this.o.onStatus?.(s, detail);
    }

    private async reconcile(): Promise<void> {
        if (this.intent === 'listen') {
            if (this._status === 'failed') return;              // wait for poke()
            if (this._status === 'listening' && this.vad) return;
            await this.startWithRetry();
            return;
        }
        this.stopWatchdog();
        if (this.vad && (this._status === 'listening' || this._status === 'starting' || this._status === 'recovering')) {
            try { await this.vad.pause(); } catch { /* pausing a dead VAD is fine */ }
        }
        this.setStatus(this.intent === 'mute' ? 'muted' : 'off');
    }

    private async startWithRetry(): Promise<void> {
        for (let attempt = 0; ; attempt++) {
            this.setStatus(attempt === 0 ? 'starting' : 'recovering');
            try {
                if (!this.vad) this.vad = await this.o.createVad(this.callbacks());
                await this.vad.start();
                if (this.intent !== 'listen') { await this.vad.pause(); await this.reconcile(); return; }
                this.setStatus('listening');
                this.startWatchdog();
                return;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[PIPE][MIC] start failed (attempt ${attempt + 1}): ${msg}`);
                await this.teardown();
                if (attempt >= this.retry.length) { this.setStatus('failed', msg); return; }
                await sleep(this.retry[attempt]);
                if (this.intent !== 'listen') { await this.reconcile(); return; }
            }
        }
    }

    private callbacks(): VadCallbacks {
        return {
            onSpeechStart: () => { if (this.intent === 'listen') this.o.onSpeechStart?.(); },
            onSpeechEnd: (audio) => this.o.onSpeechEnd?.(audio),   // includes the submit-on-pause tail
            onFrame: (p) => this.o.onFrame?.(p),
        };
    }

    private async teardown(): Promise<void> {
        const v = this.vad; this.vad = null;
        if (v) { try { await v.destroy(); } catch { /* ignore */ } }
    }

    private startWatchdog() {
        this.stopWatchdog();
        this.watchdog = setInterval(() => {
            if (this._status !== 'listening' || !this.vad) return;
            if (this.now() - this.vad.lastFrameAt() > this.watchdogMs) {
                console.warn('[PIPE][MIC] watchdog: no VAD frames — restarting mic');
                void this.serial(async () => { this.stopWatchdog(); await this.teardown(); this.setStatus('recovering'); await this.reconcile(); });
            }
        }, 1000);
    }

    private stopWatchdog() { if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; } }
}

/** Real implementation: a fresh VADManager per (re)start — never reuses one that may be broken. */
export const createBrowserVad: VadFactory = async (cb) => {
    await resetVADManager();
    const mgr = getVADManager();
    const unsubs = [mgr.onSpeechStart(cb.onSpeechStart), mgr.onSpeechEnd(cb.onSpeechEnd), mgr.onFrameProcessed(cb.onFrame)];
    try {
        await mgr.init();
    } catch (e) {
        unsubs.forEach(u => u());
        throw e;
    }
    return {
        start: () => mgr.start(),
        pause: () => mgr.stop(),
        destroy: async () => { unsubs.forEach(u => u()); await mgr.destroy(); },
        lastFrameAt: () => mgr.lastFrameAt,
    };
};
```

The watchdog test expects `mic.status === 'listening'` after the restart. In `reconcile`, the `'recovering'` status plus `intent === 'listen'` takes the `startWithRetry` path, because the `listening && vad` shortcut does not apply after teardown.

- [ ] **Step 4: Adjust `vad-manager.ts`**
  - `DEFAULT_CONFIG.model: 'v5'`.
  - In `MicVAD.new({...})`: add `submitUserSpeechOnPause: true`.
  - Add `lastFrameAt = 0;` (public). In `onFrameProcessed`, set `this.lastFrameAt = Date.now();` as the first line, before the early return. In `start()`, set `this.lastFrameAt = Date.now();` on success so the watchdog gets a grace period.
  - In `init()`'s catch: `this._state = VADState.IDLE; this._micVAD = null;` instead of `ERROR`. Keep `_error` for diagnostics.

  If the Silero v5 model misbehaves in Task 13 (for example, clipped first words), revert only `model`, back to `'legacy'`. Everything else stays.

- [ ] **Step 5: Rewrite `useVAD.ts` over `MicController`.** Keep the exports.
  - One `MicController` per hook instance, created in `useState(() => new MicController({ createVad: createBrowserVad, … }))`. Callbacks go through `optsRef`.
  - `startListening = () => mic.setIntent('listen')`; `stopListening = () => mic.setIntent('off')`; `poke = (r) => mic.poke(r)`.
  - `isListening = status === 'listening'`. `mode = status === 'failed' ? 'push-to-talk' : 'onnx'`.
  - When `status` becomes `'failed'`, call `opts.onFallback?.()` once.
  - Unmount calls `mic.dispose()`.
  - Also register `navigator.mediaDevices.addEventListener('devicechange', () => mic.poke('devicechange'))`.
  - Delete `pendingStopRef`, `stopFallbackTimerRef` and the whole deferred-stop block.

- [ ] **Step 6: Visibility.** In `useInterview.ts:1087-1111`, keep `stopSpeaking()` on hide. On visible, add `vad.poke('visible');` next to `setMicIntent('auto-on')`.

- [ ] **Step 7: Verify.** Run `npx vitest run src/lib/voice src/hooks && npx tsc --noEmit`. The old `useVAD` tests that asserted deferred-stop timings are **replaced** by the MicController tests above. Delete those assertions, not the files, and keep any test that checks callbacks reach the parent.

---

### Task 9: Turn detector + real mute (replace the fixed 5 s auto-submit)

**Root causes:**
- After each transcript, `useInterview.ts:840-857` waits a **fixed 5 s** of silence before sending. On top of a 1.9 s VAD redemption (`voice-config.ts:70`), that is ~7 s of dead air on every turn.
- The mic button's "off" was overridden by the `setMicIntent('auto-on')` calls after each Kai reply (`:794, :808, :830, :1051, :1065`). The candidate therefore saw the mic as "always on".

**Files:**
- Create: `src/lib/voice/turn-detector.ts`
- Modify: `src/config/voice-config.ts:70-77`:
  - `vadSilenceWindowMs: 800` (was 1900)
  - `vadRedemptionMs: 800` (was 1600)
  - `vadMinSpeechMs: 250` (was 600, so short answers like "yes" count)
- Modify: `src/hooks/useInterview.ts`:
  - Replace both 5 s effects (`:840-897`) with a turn-commit scheduler.
  - Add `userMuted` state.
  - Route every `setMicIntent('auto-on')` through `autoArmMic()`, which respects `userMuted`.
  - Late continuation: if the candidate speaks after commit but before Kai's first audio, abort the chat request and merge the words into the same turn.
- Modify: `src/components/interview/InterviewSession.tsx:1011-1037`:
  - The mic button toggles `voice.toggleMute()`, and its label says "Muted" or "Listening".
  - It is not `disabled` while processing.
  - Add a keyboard shortcut: **Esc** stops Kai speaking.
- Test: `src/lib/voice/__tests__/turn-detector.test.ts`

**Interfaces:**
- Produces:
  - `requiredSilenceMs(transcript: string): number`
  - `decideTurn({ transcript, silenceMs }): { action: 'commit' } | { action: 'wait'; remainingMs: number }`
  - `TURN_TIMING = { completeMs: 900, incompleteMs: 2800, fillerOnlyMs: 4000 }`
  - `useInterview().voice.toggleMute()` and `.isMuted`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/voice/__tests__/turn-detector.test.ts
import { describe, it, expect } from 'vitest';
import { decideTurn, requiredSilenceMs, TURN_TIMING } from '../turn-detector';

describe('turn detector', () => {
    it('commits a complete sentence after a short silence', () => {
        expect(requiredSilenceMs('I would use a hash map to store the complements.')).toBe(TURN_TIMING.completeMs);
        expect(decideTurn({ transcript: 'What are the constraints?', silenceMs: 1500 })).toEqual({ action: 'commit' });
    });
    it('waits longer when the candidate trails off mid-thought', () => {
        for (const t of ['So the approach would be', 'I think we can sort it and', 'Let me think', 'um', 'The time complexity is...', 'First, we iterate,'] ) {
            expect(requiredSilenceMs(t)).toBeGreaterThanOrEqual(TURN_TIMING.incompleteMs);
        }
        expect(decideTurn({ transcript: 'So the approach would be', silenceMs: 1500 })).toEqual({ action: 'wait', remainingMs: TURN_TIMING.incompleteMs - 1500 });
    });
    it('filler-only utterances wait the longest', () => {
        expect(requiredSilenceMs('Hmm.')).toBe(TURN_TIMING.fillerOnlyMs);
    });
    it('never commits an empty transcript', () => {
        expect(decideTurn({ transcript: '   ', silenceMs: 99_999 })).toEqual({ action: 'wait', remainingMs: Infinity });
    });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

```ts
// src/lib/voice/turn-detector.ts
/**
 * @codesage
 * @file      src/lib/voice/turn-detector.ts
 * @purpose   Decide when the candidate has finished their turn, from transcript content + silence length.
 * @tech      TypeScript
 * @connects  useInterview turn-commit scheduler
 * @apis      none
 * @db        none
 * @state     none (pure)
 * @env       none
 * @issues    Stage 2 replaces the text heuristic with Smart Turn v3 (audio prosody)
 * @audit     CODESAGE-v1
 */
export const TURN_TIMING = { completeMs: 900, incompleteMs: 2800, fillerOnlyMs: 4000 } as const;

const FILLER_ONLY = /^(um+|uh+|hmm+|er+|erm|okay|ok|so|well|right|let me think|let me see|give me a (second|sec|moment))[\s.,!?…]*$/i;
const TRAILING_INCOMPLETE = new RegExp(
    '(' + [
        '\\b(and|or|but|so|because|then|if|when|while|which|that|where|whether)',
        '\\b(the|a|an|to|of|in|on|with|for|from|by|like|than|into)',
        '\\b(is|are|was|were|be|would|will|can|could|should|might|must|do|does)',
        '\\b(we|i|my|its)',   // not it/this/these/those — "…store it." is a complete sentence
        '\\b(um+|uh+|hmm+|er+|basically|actually|i mean|for example|such as|let me (think|see))',
    ].join('|') + ')[\\s,]*$', 'i');

export function requiredSilenceMs(transcript: string): number {
    const t = (transcript ?? '').trim();
    if (!t) return Infinity;
    if (FILLER_ONLY.test(t)) return TURN_TIMING.fillerOnlyMs;
    if (/(\.\.\.|…)$/.test(t) || /[,;:\-–—]$/.test(t)) return TURN_TIMING.incompleteMs;
    if (TRAILING_INCOMPLETE.test(t.replace(/[.!?]+$/, ''))) return TURN_TIMING.incompleteMs;
    return TURN_TIMING.completeMs;
}

export function decideTurn({ transcript, silenceMs }: { transcript: string; silenceMs: number }):
    { action: 'commit' } | { action: 'wait'; remainingMs: number } {
    const need = requiredSilenceMs(transcript);
    if (!Number.isFinite(need)) return { action: 'wait', remainingMs: Infinity };
    return silenceMs >= need ? { action: 'commit' } : { action: 'wait', remainingMs: need - silenceMs };
}
```

(Whisper often adds a period to "So the approach would be.". The `replace(/[.!?]+$/, '')` before the trailing test handles that.)

- [ ] **Step 4: Run the tests.** Expected: 4 passed.

- [ ] **Step 5: Wire the scheduler + mute into `useInterview`**
  - Add refs:
    - `lastSpeechEndAtRef`: set in VAD `onSpeechEnd` to `Date.now() - getVoiceConfig().vadSilenceWindowMs`, i.e. the moment the voice actually stopped.
    - `commitTimerRef`.
    - `userMutedRef`, plus `const [userMuted, setUserMuted] = useState(false)`.
  - VAD `onSpeechStart`: clear `commitTimerRef`. The candidate resumed, so the new segment appends to the same uncommitted turn. (Merging speech that arrives *after* the commit needs retracting a server-counted turn, so it moves to Stage 2 with the speculative LLM start.)
  - New effect on `[transcript]` (replacing the two 5 s effects):

```ts
    useEffect(() => {
        if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
        const text = transcript.trim();
        if (!text || state === 'idle' || state === 'completed' || isProcessing || isSpeaking) return;
        const schedule = () => {
            const silenceMs = Date.now() - lastSpeechEndAtRef.current;
            const d = decideTurn({ transcript: transcriptRef.current, silenceMs });
            if (d.action === 'commit') {
                const t = transcriptRef.current.trim();
                if (t && currentProblemRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
                    timelineRef.current?.mark('commit', { commitRule: requiredSilenceMs(t) });
                    void submitUserResponse(t, currentProblemRef.current);
                }
                return;
            }
            if (Number.isFinite(d.remainingMs)) commitTimerRef.current = setTimeout(schedule, d.remainingMs);
        };
        schedule();
        return () => { if (commitTimerRef.current) clearTimeout(commitTimerRef.current); };
    }, [transcript, state, isProcessing, isSpeaking, submitUserResponse]);
```

  - `autoArmMic()`: `if (!userMutedRef.current) { setMicStoppedManually(false); setMicIntent('auto-on'); }`. Replace every `setMicStoppedManually(false); setMicIntent('auto-on');` pair with `autoArmMic()`.
  - `toggleMute()`: flip `userMuted`. When muting, call `setMicIntent('off')`; when unmuting, call `autoArmMic()`. Expose `voice.toggleMute` and `voice.isMuted`.
  - Delete `sendCountdown` state and its interval. Keep the "Send Message" button (manual commit), shown whenever a transcript exists; it commits immediately. Remove the `sendCountdown` prop reads in `InterviewSession`.
  - **Echo guard stays in Stage 1.** The mic is `'off'` while `isSpeaking` (the queue is playing). The VAD therefore never hears Kai through speakers, and the "Stop Speaking" button or Esc is the interrupt.

- [ ] **Step 6: Verify.** Run `npx vitest run src/lib/voice src/hooks src/components/interview && npx tsc --noEmit`. Remove the old tests that asserted "auto-submit after 5s" and "Sending in 5s…" copy. Add one to `src/hooks/__tests__/useInterview.state-ownership.test.ts` or a new `useInterview.turns.test.ts`:
  - with fake timers, a transcript `"What are the constraints?"` and `lastSpeechEndAt = now - 900` submit immediately;
  - `"So the approach would be"` submits only after 2,800 ms total silence;
  - a VAD speech start before then prevents the submit.

---

### Task 10: Turn timeline telemetry → `system_events`

**Root cause of our blindness:** every voice failure in the live run was visible only in the candidate's browser console. Nothing reached the DB, so a user report would carry no evidence.

**Files:**
- Create: `src/lib/voice/turn-timeline.ts`
- Create: `src/app/api/voice/telemetry/route.ts`
- Modify: `src/lib/monitoring/events.ts` (add `'voice.turn_timeline'` INFO, `'voice.engine_error'` WARN, `'voice.mic_status'` INFO, all `domain: 'voice', canonical: true`)
- Modify: `src/hooks/useInterview.ts` (create a `TurnTimeline` per turn and mark stages)
- Test: `src/lib/voice/__tests__/turn-timeline.test.ts`
- Test: `src/app/api/voice/telemetry/__tests__/route.test.ts`

**Interfaces:**
- Produces:
  - `class TurnTimeline { constructor(sessionId: string | null, turn: number); mark(stage: TurnStage, data?: Record<string, unknown>): void; finish(outcome: 'spoken' | 'text-only' | 'aborted' | 'error'): TurnTimelinePayload; }`
  - `type TurnStage = 'vad_end' | 'stt_start' | 'stt_done' | 'commit' | 'chat_request' | 'first_token' | 'first_sentence' | 'first_audio' | 'speech_done' | 'mic_rearmed' | 'error'`
  - `sendVoiceTelemetry(payloads: TurnTimelinePayload[]): void` (batched, `navigator.sendBeacon` with a `fetch` keepalive fallback)
  - `POST /api/voice/telemetry` body `{ events: TurnTimelinePayload[] }` (max 20 per request)

- [ ] **Step 1: Write the failing tests.** The timeline test uses fake `performance.now` and asserts:
  - `finish()` returns a `stages` map of ms offsets from `vad_end`;
  - `derived.turnGapMs = first_audio − vad_end`, `sttMs = stt_done − stt_start`, `commitWaitMs = commit − stt_done`, `ttftMs = first_token − chat_request`, `ttfaMs = first_audio − first_sentence`;
  - a missing `first_audio` gives `turnGapMs: null`;
  - `data` from marks is merged under `details` with keys `ttsVoice`, `ttsError`, `sttModel`, `sttServerTiming`, `llmModel`, `llmProvider`, `micStatus`, `commitRule`.

  The route test asserts:
  - a valid batch returns 202, and `logSystemEvent` is called once per event with `type: 'voice.turn_timeline'`;
  - bad shapes return 400;
  - more than 20 events returns 413;
  - the IP rate limit returns 429.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `turn-timeline.ts`**

```ts
// src/lib/voice/turn-timeline.ts
/**
 * @codesage
 * @file      src/lib/voice/turn-timeline.ts
 * @purpose   Per-turn voice timeline (VAD→STT→commit→LLM→TTS) shipped to system_events so every voice bug has numbers.
 * @tech      TypeScript, Beacon API
 * @connects  useInterview; POST /api/voice/telemetry
 * @apis      /api/voice/telemetry
 * @db        system_events (via route)
 * @state     Module-level send buffer
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
export type TurnStage = 'vad_end' | 'stt_start' | 'stt_done' | 'commit' | 'chat_request' | 'first_token'
    | 'first_sentence' | 'first_audio' | 'speech_done' | 'mic_rearmed' | 'error';

export interface TurnTimelinePayload {
    sessionId: string | null;
    turn: number;
    outcome: 'spoken' | 'text-only' | 'aborted' | 'error';
    stages: Partial<Record<TurnStage, number>>;
    derived: { turnGapMs: number | null; sttMs: number | null; commitWaitMs: number | null; ttftMs: number | null; ttfaMs: number | null };
    details: Record<string, unknown>;
    ua: string;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class TurnTimeline {
    private t: Partial<Record<TurnStage, number>> = {};
    private details: Record<string, unknown> = {};
    constructor(private sessionId: string | null, private turn: number) {}

    mark(stage: TurnStage, data?: Record<string, unknown>): void {
        if (this.t[stage] === undefined) this.t[stage] = now();
        if (data) Object.assign(this.details, data);
    }

    finish(outcome: TurnTimelinePayload['outcome']): TurnTimelinePayload {
        const base = this.t.vad_end ?? this.t.commit ?? this.t.chat_request ?? now();
        const rel: Partial<Record<TurnStage, number>> = {};
        for (const [k, v] of Object.entries(this.t)) rel[k as TurnStage] = Math.round((v as number) - base);
        const d = (a: TurnStage, b: TurnStage) => (this.t[a] !== undefined && this.t[b] !== undefined ? Math.round(this.t[b]! - this.t[a]!) : null);
        const payload: TurnTimelinePayload = {
            sessionId: this.sessionId, turn: this.turn, outcome, stages: rel,
            derived: { turnGapMs: d('vad_end', 'first_audio'), sttMs: d('stt_start', 'stt_done'), commitWaitMs: d('stt_done', 'commit'), ttftMs: d('chat_request', 'first_token'), ttfaMs: d('first_sentence', 'first_audio') },
            details: this.details,
            ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'server',
        };
        console.info(`[PIPE][TURN] #${this.turn} ${outcome} gap=${payload.derived.turnGapMs}ms stt=${payload.derived.sttMs} wait=${payload.derived.commitWaitMs} ttft=${payload.derived.ttftMs} ttfa=${payload.derived.ttfaMs}`);
        return payload;
    }
}

let buffer: TurnTimelinePayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function sendVoiceTelemetry(payloads: TurnTimelinePayload[]): void {
    buffer.push(...payloads);
    if (buffer.length >= 5) { flush(); return; }
    if (!flushTimer) flushTimer = setTimeout(flush, 10_000);
}

export function flush(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!buffer.length || typeof window === 'undefined') return;
    const body = JSON.stringify({ events: buffer.splice(0, 20) });
    const ok = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/voice/telemetry', new Blob([body], { type: 'application/json' }));
    if (!ok) void fetch('/api/voice/telemetry', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    if (buffer.length) flush();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
```

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/voice/telemetry/route.ts
/**
 * @codesage
 * @file      src/app/api/voice/telemetry/route.ts
 * @purpose   Accept batched voice turn timelines from the browser and persist them as system_events.
 * @tech      Next.js, zod
 * @connects  @/lib/monitoring/events, @/lib/rate-limit/ip-rate-limiter, @/lib/supabase/server
 * @apis      POST /api/voice/telemetry
 * @db        system_events (insert via logSystemEvent)
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const Event = z.object({
    sessionId: z.string().max(80).nullable(),
    turn: z.number().int().min(0).max(500),
    outcome: z.enum(['spoken', 'text-only', 'aborted', 'error']),
    stages: z.record(z.string(), z.number()),
    derived: z.record(z.string(), z.number().nullable()),
    details: z.record(z.string(), z.unknown()),
    ua: z.string().max(200),
});
const Body = z.object({ events: z.array(Event).min(1) });

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkIpRateLimit(ip, { maxRequests: 30, windowSeconds: 60, endpoint: 'voice-telemetry', failureMode: 'fail-open' });
    if (!rate.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    let json: unknown;
    try { json = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    if (parsed.data.events.length > 20) return NextResponse.json({ error: 'Too many events' }, { status: 413 });

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    await Promise.all(parsed.data.events.map(e => logSystemEvent({
        type: 'voice.turn_timeline',
        userId: user?.id,
        sessionId: e.sessionId ?? undefined,
        latency_ms: e.derived.turnGapMs ?? undefined,
        metadata: { turn: e.turn, outcome: e.outcome, stages: e.stages, derived: e.derived, details: e.details, ua: e.ua },
    })));
    return NextResponse.json({ accepted: parsed.data.events.length }, { status: 202 });
}
```

- [ ] **Step 5: Mark the stages in `useInterview`**
  - `timelineRef = useRef<TurnTimeline | null>(null)`.
  - VAD `onSpeechEnd`: create one if none exists, then `mark('vad_end')`.
  - `useSTT.transcribeAudio`: `mark('stt_start')` before the call; `mark('stt_done', { sttModel, sttServerTiming })` after.
  - The commit scheduler (Task 9): `mark('commit', { commitRule })`.
  - `callChatApi`: `mark('chat_request')`, then `mark('first_token')` at the existing first-token log, then `mark('first_sentence')` on the first `tts.enqueue`.
  - The `useTTS` `onEvent` handler (Task 6): `first-audio` gives `mark('first_audio', { ttsVoice })`; `error` gives `mark('error', { ttsError: code })`.
  - When the queue goes idle after a reply: `mark('speech_done')`, then `sendVoiceTelemetry([timeline.finish(outcome)])`, then `timelineRef.current = null`.
  - Text-only turns (composer) create a timeline at commit and finish with `'text-only'`, so latency is recorded for typed turns too.
  - The `useVAD` `onStatus` handler logs `voice.mic_status` for `failed`/`recovering` through the same endpoint, with `outcome: 'error'` and `details.micStatus`.

- [ ] **Step 6: Owner query.** Add this to `VOICE_RUN_CHECKLIST.md` (replacing the manual console reading):

```sql
select date_trunc('hour', created_at) as hour,
       count(*) as turns,
       percentile_cont(0.5) within group (order by (metadata->'derived'->>'turnGapMs')::int) as p50_gap_ms,
       percentile_cont(0.95) within group (order by (metadata->'derived'->>'turnGapMs')::int) as p95_gap_ms,
       count(*) filter (where metadata->>'outcome' = 'error') as errors
from system_events
where type = 'voice.turn_timeline' and created_at > now() - interval '24 hours'
group by 1 order by 1 desc;
```

(Check the column names against `supabase/migrations`' `system_events` definition. If `metadata` is stored under a different column, adapt only the column reference.)

- [ ] **Step 7: Verify.** Run `npx vitest run src/lib/voice src/app/api/voice src/lib/monitoring && npx tsc --noEmit`. The event-taxonomy contract test must pass with the three new types.

---

### Task 11: `/voice-check` self-test page

**Files:**
- Create: `src/app/voice-check/page.tsx` (server wrapper, `metadata.title = 'Voice check'`)
- Create: `src/components/voice/VoiceCheckClient.tsx`
- Modify: `src/components/interview/InterviewSession.tsx` (a "Check mic & speaker" link on the pre-start screen, visible when `voiceEnabled`)
- Test: `src/components/voice/__tests__/VoiceCheckClient.test.tsx`

**Behaviour:** four rows, run in order, each showing ✓/✗, a number, and a one-line fix hint.
1. **Mic.** `getUserMedia` permission, the device label and a live level meter. Fix hint on ✗: "Allow microphone in the address bar".
2. **Speech detection.** A `MicController` + `createBrowserVad` pass when a speech-end arrives within 10 s ("Say: 'testing one two three'").
3. **Transcription.** POST the captured audio to `/api/voice/transcribe` and show the text, the round-trip ms and the Server-Timing breakdown.
4. **Speaker.** `getSpeechQueue().unlock()` on the button click, then enqueue "This is Kai. If you can hear me, you're all set." Show the chosen voice and the first-audio latency. Offer "Did you hear it? Yes / No", where "No" shows the Windows sound settings hint.

At the end, a **Copy report** button copies a JSON summary (browser, voices count, chosen voice, each row's result and ms) for bug reports.

- [ ] **Step 1: Write the failing test.** Mock `getSpeechQueue`, `MicController` and `fetch`. Render the component and click "Run check". Advance the mocks: the mic granted, the speech end fires, the fetch returns `{text:'testing one two three'}`, and the speech queue emits `first-audio`. Assert four ✓ rows and that the report JSON contains `"transcript":"testing one two three"`. A second test mocks `getUserMedia` rejecting with `NotAllowedError` and asserts row 1 ✗ with the hint text.

- [ ] **Step 2: Run, fail. Step 3: Implement** with the existing UI primitives (`@/components/ui/button`, Tailwind tokens used in `InterviewSession`). **Step 4: Run, pass.**

- [ ] **Step 5: Verify** `npx tsc --noEmit`. Then open `/voice-check` in the dev server with `preview_start`. The in-app browser has no mic, so row 1 must show ✗ with the fix hint and the page must not crash. That still proves the failure path.

---

### Task 12: Playwright voice regression suite (deterministic, no real audio)

**Files:**
- Create: `tests/e2e/voice-pipeline.spec.ts`
- Create: `tests/e2e/helpers/voice-fakes.ts` (init script: a fake `MicVAD` through the existing `window.mockMicVAD` injection point, `vad-manager.ts:187`, plus a fake `speechSynthesis` with Chrome's post-cancel drop behaviour and hooks to fire events)
- Modify: `playwright.config.ts` (add a `voice` project: Chromium only, `testMatch: /voice-.*\.spec\.ts/`)

**Setup inside the spec:**
- `page.route('**/api/voice/transcribe', …)` returns fixed transcripts.
- `page.route('**/api/chat', …)` returns an SSE body with three sentences, sent with 50 ms gaps.
- `page.route('**/api/flags', …)` forces `ENABLE_VOICE_MODE: true`.
- The test drives speech with `page.evaluate(() => window.__fakeVad.speak(1200))`, which fires `onSpeechStart`, 1.2 s of frames, then `onSpeechEnd(Float32Array)`.

**Scenarios** (each an `it`):
- (a) **Happy turn.** Speech then transcript, then commit without the old 5 s wait (assert `/api/chat` is requested within 1,500 ms of speech end). The three sentences reach `speechSynthesis.speak` in order. The mic re-arms after the last `onend`.
- (a2) **Pause mid-thought.** The transcript is "So the approach would be". Assert no `/api/chat` request within 2,500 ms. A second speech segment within that window produces **one** request whose prompt contains both parts.
- (b) **Mute holds.** Click the mic button, and the fake VAD reports paused within 300 ms. After a full Kai reply, the fake VAD is still paused.
- (c) **Cancel race (the live-run bug).** Force the first utterance to error with `canceled` right away. The mic still re-arms within 1 s, and no `speak()` lands inside 100 ms of a `cancel()` (the fake counts drops, which must be 0).
- (d) **Tab hidden then visible.** Kill the fake VAD frames while hidden; after `visibilitychange` to visible, the fake VAD is listening again within 1.5 s.
- (e) **Echo guard.** Fire a speech start while the fake synth is speaking. No transcribe request is made.
- (f) **Blocked speaker.** The fake synth errors with `not-allowed`. The "Tap to enable Kai's voice" banner is visible. Clicking it calls `speak` again.
- (g) **Voice off.** `ENABLE_VOICE_MODE: false`. The composer is visible, there are no `speechSynthesis.speak` calls, and the fake VAD is never started.
- (h) **Telemetry.** After scenario (a), exactly one POST reaches `/api/voice/telemetry`, with `derived.turnGapMs` a number.

**The fakes (`tests/e2e/helpers/voice-fakes.ts`):**

```ts
import type { Page, Route } from '@playwright/test';

/** Fake Silero MicVAD (via window.mockMicVAD) + fake speechSynthesis that reproduces Chrome's post-cancel drop. */
export async function installVoiceFakes(page: Page) {
    await page.addInitScript(() => {
        const w = window as any;
        const vad = { listening: false, starts: 0, pauses: 0, framesOn: true, opts: null as any, timer: 0 as any };
        w.__fakeVad = {
            state: vad,
            async speak(ms: number) {
                if (!vad.opts || !vad.listening) return false;
                vad.opts.onSpeechStart?.();
                await new Promise(r => setTimeout(r, ms));
                vad.opts.onSpeechEnd?.(new Float32Array(Math.round(16 * ms)));
                return true;
            },
            killFrames() { vad.framesOn = false; },
        };
        w.mockMicVAD = {
            new: async (opts: any) => {
                vad.opts = opts;
                return {
                    get listening() { return vad.listening; },
                    start: async () => {
                        vad.listening = true; vad.starts++; vad.framesOn = true;
                        clearInterval(vad.timer);
                        vad.timer = setInterval(() => { if (vad.listening && vad.framesOn) opts.onFrameProcessed?.({ isSpeech: 0.01 }); }, 32);
                    },
                    pause: async () => { vad.listening = false; vad.pauses++; },
                    destroy: async () => { vad.listening = false; clearInterval(vad.timer); },
                };
            },
        };

        const log = { spoken: [] as string[], dropped: 0, cancels: 0, speakAt: [] as number[], mode: 'normal' as 'normal' | 'cancel-first' | 'not-allowed' };
        let current: any = null; let lastCancel = -1e9;
        const voices = [{ name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'g' }];
        const synth = {
            get speaking() { return !!current; }, pending: false, paused: false,
            getVoices: () => voices,
            addEventListener: () => {}, removeEventListener: () => {},
            resume() {}, pause() {},
            cancel() { log.cancels++; lastCancel = performance.now(); const u = current; current = null; u?.onerror?.({ error: 'canceled' }); },
            speak(u: any) {
                if (performance.now() - lastCancel < 100) { log.dropped++; return; }   // Chrome behaviour
                if (u.volume === 0) return;                                            // unlock()
                if (log.mode === 'not-allowed') { setTimeout(() => u.onerror?.({ error: 'not-allowed' }), 0); return; }
                if (log.mode === 'cancel-first') { log.mode = 'normal'; setTimeout(() => u.onerror?.({ error: 'canceled' }), 5); return; }
                log.spoken.push(u.text); log.speakAt.push(performance.now()); current = u;
                setTimeout(() => u.onstart?.(), 10);
                setTimeout(() => { if (current === u) { current = null; u.onend?.(); } }, 60 + u.text.length * 2);
            },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
        w.SpeechSynthesisUtterance = class { lang = ''; voice = null; rate = 1; pitch = 1; volume = 1; onstart: any; onend: any; onerror: any; constructor(public text: string) {} };
        w.__fakeSynth = log;
        navigator.mediaDevices.getUserMedia = async () => new MediaStream();
    });
}

/** Deterministic backend: fixed transcripts, 3-sentence SSE replies, voice flag on. */
export async function mockVoiceApis(page: Page, o: { transcripts: string[]; sentences?: string[]; voiceOn?: boolean }) {
    let t = 0;
    const sentences = o.sentences ?? ['Good thinking.', 'What is the time complexity of that?', 'And how much extra space does it use?'];
    await page.route('**/api/flags', async (route: Route) => {
        const res = await route.fetch(); const json = await res.json();
        json.ENABLE_VOICE_MODE = { value: o.voiceOn ?? true, description: '' };
        await route.fulfill({ json });
    });
    await page.route('**/api/voice/transcribe', (route) =>
        route.fulfill({ json: { text: o.transcripts[Math.min(t++, o.transcripts.length - 1)], model: 'fake', confidence: 0.95, duration: 1.2 } }));
    await page.route('**/api/chat', (route) => {
        const body = sentences.map(s => `data: ${JSON.stringify({ delta: s + ' ' })}\n\n`).join('')
            + `data: ${JSON.stringify({ done: true, fullText: sentences.join(' ') })}\n\n`;
        return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
    });
}
```

**Scenario (a), which the others follow:**

```ts
// tests/e2e/voice-pipeline.spec.ts
import { test, expect } from '@playwright/test';
import { installVoiceFakes, mockVoiceApis } from './helpers/voice-fakes';

const vad = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__fakeVad.state);
const synth = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__fakeSynth);

test.describe('voice pipeline', () => {
    test.beforeEach(async ({ page }) => {
        await installVoiceFakes(page);
        // Log in + open a practice interview exactly as tests/e2e/interview-flow.spec.ts does (reuse its helper).
    });

    test('Happy turn: commit without the 5 s wait, sentences in order, mic re-arms', async ({ page }) => {
        await mockVoiceApis(page, { transcripts: ['I would use a hash map to store the complements.'] });
        await page.getByRole('button', { name: /start/i }).click();
        await expect.poll(async () => (await vad(page)).listening, { timeout: 10_000 }).toBe(true); // intro spoken, mic armed

        const chat = page.waitForRequest('**/api/chat');
        const t0 = Date.now();
        await page.evaluate(() => (window as any).__fakeVad.speak(1200));
        await chat;
        expect(Date.now() - t0).toBeLessThan(1200 + 1500);

        await expect.poll(async () => (await synth(page)).spoken.slice(-3)).toEqual(
            ['Good thinking.', 'What is the time complexity of that?', 'And how much extra space does it use?']);
        await expect.poll(async () => (await vad(page)).listening, { timeout: 3_000 }).toBe(true);
        expect((await synth(page)).dropped).toBe(0);
    });
});
```

- [ ] **Step 1:** Write `voice-fakes.ts` and scenario (a). Run `npx playwright test --project=voice -g "Happy turn"`. The test must **fail** on the current `main` (5 s wait) and pass with Tasks 6–10. If it runs before those tasks land, record the failing output as proof it catches the regression.
- [ ] **Step 2:** Add scenarios (a2) to (h) one at a time, running each.
- [ ] **Step 3:** Run the whole project 3× in a row (`--repeat-each=3`). It must be green with no flakes. Any flake is a real race: fix the code, don't add sleeps to the test.

---

### Task 13: Live verification run, then flag flip (with the user)

**Environment:** localhost dev server, the user's own Chrome, with Claude-in-Chrome attached so I read the console live. **Not** the in-app Claude browser (it has no mic or speaker) and **not** prod. The `ENABLE_VOICE_MODE` flag is forced on for localhost only. Set it through the localStorage override in the user's browser, never through the global flag row.

- [ ] **Step 1: Pre-flight** (me). `npx vitest run` (all green), `npx tsc --noEmit`, `npx eslint src`, and `npx playwright test --project=voice`. Start the dev server with `preview_start`.
- [ ] **Step 2: `/voice-check`** (the user speaks, I read). All four rows must be ✓. Record the voice name and the STT round-trip.
- [ ] **Step 3: Two full mock interviews** (the user), each ≥ 10 turns. Script for interview 1:
  - Answer normally, with one deliberate 3-second thinking pause mid-sentence.
  - Tap mute, wait through one Kai reply, then unmute.
  - Switch tabs for 10 s, then come back.
  - Interrupt Kai once with Esc.
  - Script for interview 2: a quiet room, a normal pace, and at least one very short answer ("yes").
- [ ] **Step 4: Evidence** (me). Run the Task 10 SQL for the session. Pass criteria:
  - **0** turns with `outcome='error'` caused by TTS or mic;
  - **0** `watchdog` or `no-english-voice` codes;
  - `p50 turnGapMs ≤ 3000` and `p95 ≤ 4500`;
  - STT `p50 ≤ 1200 ms`;
  - no transcript containing Kai's own words;
  - the mute test held;
  - the tab-switch test recovered without a click.
- [ ] **Step 5: Decision** (the user). If everything passes, flip `ENABLE_VOICE_MODE` on in prod from the owner flag panel (no deploy needed), or set `defaultValue: true` in a follow-up commit. If anything fails, the telemetry names the stage. Fix it, add a Playwright scenario for it, and re-run from Step 1.

---

## Stage 2 (separate plan, written after Task 13 passes)

Each item is free and needs no new paid service:
- **Kokoro-82M in-browser neural voice** for capable devices. A device benchmark gate is mandatory: Intel iGPUs take ~3.5 s to first audio and can run out of memory. Audio plays through Web Audio, which makes Chrome's echo cancellation work, which in turn unlocks the next item.
- **Automatic voice barge-in** (talk over Kai to interrupt).
- **Smart Turn v3** (8 MB ONNX, ~12 ms CPU) for audio-based end-of-turn detection, replacing the text heuristic.
- **Speculative LLM start** during the commit wait, plus **late-continuation merge**: speech after the commit but before Kai's first word retracts the turn and merges it. This needs a server-side turn retraction so guest and free-tier turn counts stay correct.
- **Chrome on-device `SpeechRecognition`** (`processLocally`) for live captions while speaking.
- **Gemini Live free-tier prototype** behind a flag, for comparison.
- **Consolidate Learn's `useUnifiedVoice`** onto the same turn loop as the interview.
