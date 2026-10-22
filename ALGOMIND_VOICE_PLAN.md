# AlgoMind Voice Pipeline — Root-Cause Analysis & Rebuild Plan

**Status: PLAN ONLY — nothing implemented. Awaiting approval.**
**Date:** 2026-09-13 · **Evidence:** your live voice run (`[PIPE]` console), the code, dev-server logs.

---

## 1. What your run actually showed (every symptom → a specific mechanism)

| # | Symptom you saw | Log evidence | Root cause (file:line) |
|---|---|---|---|
| 1 | **Speaker silent on every message** | `[PIPE][TTS] speak done … spokenOk=false durationMs=68/73/32`, `browserVoices=22` | `tts-engine.ts:64-71` — `speak()` calls `cancel()` **unconditionally**, then `speechSynthesis.speak()` **immediately**. Chrome/Firefox drop an utterance queued right after `cancel()` (needs ~500 ms; [Mozilla 1522074](https://bugzilla.mozilla.org/show_bug.cgi?id=1522074)). The engine's own comment documents this bug but only delays 100 ms and only when *its own* `_speaking` flag was true — not when the browser engine is busy (e.g. the click-time "unlock" utterance). Result: `onerror('canceled')` fires in ~30 ms with `started=false` → `resolve(false)`; the one retry hits the same race. Error is *suppressed from logs* (`e.error==='canceled'` branch), which is why nothing else printed. |
| 2 | **"Gibberish language" burst at the end** | (no log — happened after the last message) | Two compounding mechanisms: **(a)** `onvoiceschanged` is a single global property assigned by **three** modules (`useTTS.ts:112`, `VoiceSettings.tsx:90`, `tour/index.ts:322` — the tour *nulls* it). If voices load after the first pick, the re-pick never fires → `prefVoice` stays null → utterances get Chrome's **default OS voice**, which on an India-locale Windows box can be a non-English voice reading English text. **(b)** Chrome's `cancel()` is unreliable at the OS-TTS layer; "cancelled" utterances can remain queued and flush **all at once** later (tab focus / unmount) → overlapping speech = unintelligible. |
| 3 | **"Mic button didn't work — always on"** | — | **There is no mic button.** The pulsing `Mic` icon is `InterruptionIndicator.tsx:59`, a passive status indicator. The only mic control is programmatic (`useInterview.ts:1140-1180` mutes during TTS/processing). Users have **no mute/toggle/push-to-talk control** at all. |
| 4 | **VAD died mid-session; "mic not working"; came back after a tab switch** | `[PIPE][VAD] init OK` then no `speech-start` for later utterances | **Race:** TTS fails in ~70 ms → `isSpeaking` flips true→false instantly → `vad.stopListening()` schedules a **deferred hardware stop** (`useVAD.ts:196-205`, 3.5 s timer) → 50 ms later `startListening()` runs, sees state `LISTENING`, **does not cancel the pending stop** → 3.5 s later the timer fires `manager.stop()` → mic is paused while React still says listening. **Trap:** if any `start()` throws once, `VADManager` enters `ERROR` and `_assertReady` throws forever (`vad-manager.ts:270-281, 347-353`); `useVAD` catches and **permanently** downgrades to push-to-talk (`useVAD.ts:125`) with no retry path. A tab switch re-runs the mic-sync effect / resumes the AudioContext, which is why it "came back". *(Honest note: my earlier change raising the deferred-stop timer 1 s→3.5 s widened this race window; it did not create it, but it made it hit more reliably once TTS started fast-failing.)* |
| 5 | **Long pause after you stop speaking (5–8 s)** | `mic captured 4704ms → transcribed in 3105ms`, `first token in 2485-3550ms` | Fully **sequential, non-streaming** stages: VAD end-of-speech wait (~1.6 s) + Whisper batch round-trip (**3.1–3.7 s**, of which server inference is ~0.8 s — the rest is client encoding + uploading multi-second WAV blobs) + LLM time-to-first-token (**2.4–3.5 s**, high because **Groq's free daily quota is exhausted** — see §4 — so Kai fell back to Gemini) + TTS start. Nothing overlaps. |
| 6 | **STT accuracy** | `"Sure, could you please define the constraints for me?"`, `"...plus one plus one or plus two..."` | ✅ Whisper transcripts were **correct**. STT quality is not the problem; latency is. |

**Bottom line:** the failures are **structural bugs in the current design**, not tuning. Browser `speechSynthesis` is unfit for a conversational product (documented cancel race, async voice loading, ~15 s cutoffs, paused-state stalls, no streaming), the VAD lifecycle has two state-machine bugs, there is no user mic control, and the pipeline is serial. Patching further is what produced "this broken thing." **Reverting recent commits would not fix any of these** — every mechanism above predates them.

---

## 2. Two smaller bugs from your dev-server log (not voice, but real)

- **`memory-generator … "<think>He"… is not valid JSON`** — Groq's `qwen3.*` models are *reasoning* models and prefix `<think>…</think>` to output. The streaming path strips these (`filterThinkTags`), but the **non-streaming** `generateResponse/generateCompletion` path does not → every JSON-expecting call served by qwen (Kai memory, and potentially the analyzer / score-validator / intent classifier) throws on `JSON.parse`. Root fix: send Groq `reasoning_format: "hidden"` (+ `response_format: json_object` for JSON tasks) for qwen models, and strip think tags centrally in the non-streaming path as belt-and-braces ([Groq reasoning docs](https://console.groq.com/docs/reasoning)).
- **Groq free tier `tokens per day` cap hit** (`Limit 200000, Used 198175`) — the campaign consumed a full day's quota; Kai is now on the slower Gemini fallback. Free Groq (200K TPD) cannot serve real users — ~50 interviews/day exhausts it. Decision needed (§5).

---

## 3. What "world-class" looks like today (researched 2026-09-13)

**Latency budget for natural conversation:** humans notice >300 ms; >500 ms "feels robotic" ([Inworld](https://inworld.ai/resources/best-realtime-ai-api)). Today's pause is 5–8 s.

**Option A — Speech-to-speech: Gemini Live API**
One WebSocket session streams your mic audio in and Kai's voice out; the model does VAD, **barge-in** (`automatic_activity_detection`), STT, reasoning and TTS natively with 30 HD voices ([Google Cloud](https://cloud.google.com/blog/topics/developers-practitioners/how-to-use-gemini-live-api-native-audio-in-vertex-ai), [tutorial](https://eastondev.com/blog/en/posts/ai/20260227-gemini-live-api-tutorial/)). Sub-second, measurably faster than OpenAI Realtime, and ~32× cheaper on input ($1/1M audio-in vs $32/1M) ([comparison](https://flowtivity.ai/blog/gemini-3-1-flash-live-vs-gpt-realtime-1-5-voice-agent-comparison-2026/), [pricing](https://the-rogue-marketing.github.io/google-gemini-tts-speech-audio-api-pricing-may-2026/)). You already hold Gemini keys and it has a free tier.
- ⚠️ Constraints that matter for *this* product: audio-only sessions cap at ~15 min without context-window compression (interviews are 30–45 min) ([Ry Walker](https://rywalker.com/research/gemini-live-api)); the per-turn interviewer machinery (state machine, wrapped turn prompts, RAG/student-context injection, mode configs) must be re-expressed as a Live system instruction + tool calls; transcripts for the analyzer come from Live's input/output transcription config. It is a **re-architecture of the interviewer**, not a swap.

**Option B — Modular streaming pipeline (keep the validated "brain", replace the "ears and mouth")** ← *recommended first*
- **STT:** streaming, not batch — Deepgram Nova-3 (~450 ms median, ~$0.0077/min) or AssemblyAI Universal-Streaming (~$0.21/hr) over WebSocket ([Deepgram vs AAI](https://deepgram.com/learn/deepgram-vs-speechmatics-vs-assemblyai), [pricing](https://www.buildmvpfast.com/api-costs/transcription)). Final transcript is ready ~300 ms after you stop talking instead of 3+ s.
- **TTS:** streaming with sentence-level pipelining off the LLM stream — Cartesia Sonic (~40–90 ms to first audio, ~$1.70/hr) or ElevenLabs Flash (~75 ms) or OpenAI `gpt-4o-mini-tts` (~$0.015/min) ([TTFA guide](https://gradium.ai/content/best-low-latency-tts-apis-2026), [Cartesia vs ElevenLabs](https://futureagi.com/blog/elevenlabs-vs-cartesia-tts-2026/)). Played through a single `<audio>`/AudioWorklet — no `speechSynthesis` anywhere.
- **Zero-cost TTS alternative:** Kokoro-82M runs **in the browser** via ONNX/WebGPU, ~zero network latency, good quality ([Kokoro.js](https://huggingface.co/posts/Xenova/503648859052804), [WebGPU benchmarks](https://quick-tts.com/blog/kokoro-webgpu-benchmarks.html)). Model download ~80 MB once; needs a capable device.
- **VAD:** keep Silero (`@ricky0123/vad-web`) — the model is fine; rewrite the lifecycle (§4).
- **Result:** ~1.0–1.5 s from end-of-speech to Kai's first audio; every existing prompt, mode, state machine, analyzer and report stays exactly as validated by the campaign. Cost ≈ $0.25–0.50 per 30-min interview with paid STT+TTS, or ≈ $0.10 with Kokoro.

**Option C — Minimal:** fix the four lifecycle bugs + swap `speechSynthesis` for Kokoro/OpenAI TTS, keep batch Whisper with optimized upload. Cheapest change, ~2.5–3 s pause (batch STT dominates). Only worth it as a stop-gap.

**My recommendation:** **B now**, with **A as a flagged prototype** in parallel (Gemini keys are free) so we can A/B naturalness on real sessions before committing to the re-architecture. C is not "world class."

---

## 4. Implementation plan (for approval)

### Phase 0 — Make the pipeline observable & testable (before any rewrite; 1 day)
1. **Voice telemetry to the DB:** ship the `[PIPE]` events (TTS started/ended/failed + reason, STT ms + chars, VAD init/speech-start/errors, mic mute/unmute) through `logSystemEvent` → visible in owner dashboard. Prod failures become measurable, not anecdotal.
2. **`/voice-check` self-test page:** one click runs mic permission → VAD init → 3-second STT round-trip on your voice → TTS plays a test line, and shows a green/red panel per stage with the actual numbers. Run it before every mock; users can run it before an interview.
3. **Automated voice regression tests:** Playwright with Chrome's fake media (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`) feeds recorded WAV fixtures (clean / noisy / accented / cut-off / mid-sentence pause) as the mic in CI → asserts VAD segments + STT text + `spokenOk` + latency budgets. This is how we **catch the mic/VAD/TTS class of bug at the root, automatically**, instead of via your ears.

### Phase 1 — Kill the root causes in the current code (2 days; ships regardless of A/B)
4. **Remove `speechSynthesis` from the interview path** (replace per Option B/C choice). No amount of `resume()`/delay hacks makes it reliable.
5. **VAD lifecycle rewrite (`useVAD` + `VADManager`):** explicit state machine with `IDLE → READY → LISTENING → MUTED → ERROR(recoverable)`; `startListening()` cancels any pending deferred stop; `ERROR` recovers by re-init (with backoff) instead of permanent push-to-talk; resume `AudioContext` on `visibilitychange` + user gesture; a watchdog that detects "listening but no audio frames for N s" and self-heals.
6. **Real mic control:** a mute/unmute button + push-to-talk fallback + keyboard shortcut, with the indicator reflecting *hardware* state (from VADManager), not React's guess.
7. **Voice selection hardening:** `addEventListener('voiceschanged')` (never the global property), pin an explicit English voice, and fall back to API TTS if none — no more default-OS-voice gibberish.
8. **Fix the two non-voice bugs:** Groq `reasoning_format:"hidden"` + central think-tag strip in the non-streaming path; Groq quota decision (§5).

### Phase 2 — Streaming pipeline (Option B; ~4–5 days)
9. Streaming STT client (WebSocket) fed directly from the VAD/AudioWorklet frames; interim transcripts shown live; final transcript triggers the LLM.
10. Sentence-pipelined streaming TTS: as the LLM streams, chunk on sentence boundaries → TTS stream → gapless playback queue; **barge-in** (VAD speech-start cancels playback and the LLM stream).
11. Latency instrumentation per stage (end-of-speech → transcript final → first token → first audio) with a budget alarm (>1.5 s = warn).
12. Full mock matrix re-run in voice mode via the Playwright fake-mic harness + your manual run with Claude-in-Chrome observing.

### Phase 3 — Gemini Live prototype (Option A; flagged; ~3 days, parallel)
13. `/interview?engine=live` behind a flag: Live session with the interviewer system instruction, transcription enabled, tool call to sync interview state, context compression for >15-min sessions. Compare naturalness/latency/cost against Phase 2 on identical problems.

---

## 5. Decisions I need from you

1. **Architecture:** B now + A prototype (recommended), or A only, or C stop-gap?
2. **Budget for STT/TTS:** paid streaming (≈ $0.25–0.50 / 30-min interview: Deepgram + Cartesia/OpenAI) — or free-only (Kokoro in-browser TTS + optimized batch Whisper, ~2.5–3 s pause)?
3. **Groq quota:** upgrade to Groq Dev Tier for chat, or make Gemini primary and Groq the fallback? (Free Groq dies at ~50 interviews/day.)
4. **Next voice test environment:** the in-app "Claude browser" has **no microphone or speaker access**, so it cannot run a voice mock. Proposal: run **localhost** in your real Chrome with **Claude-in-Chrome** attached so I read the `[PIPE]`/telemetry console live while you talk (nothing touches prod). Confirm?
5. **Revert?** I recommend **no** — the recent commits contain the verified non-voice fixes (freemium gate, KG, diagnostic, logging) and none of the voice root causes lives in them. If you want prod voice *disabled* until Phase 1 lands, I can put the interview in text-mode-only behind the existing flag instead of reverting.

*(Sources are linked inline above.)*

---

## 6. Decisions & corrections (2026-09-27)

**Decisions:**
- **Option B**, the modular pipeline.
- **Free only:** speech-to-text, text-to-speech, and chat models all run on free tiers or in the browser.
- **Testing:** your Chrome on localhost, with Claude-in-Chrome watching.
- **Prod:** text-only until the fix is verified.

The implementation plan is `docs/superpowers/plans/2026-09-27-voice-engine-v2-stage1.md`.

**Corrections to §1–§5, found while planning:**
- **Latency is worse than I estimated: about 12–15 s per turn, not 5–8 s.**
  - The effective end-of-speech wait is 1.9 s, not 1.6 s (`voice-config.ts:70`).
  - After a transcript arrives, the client waits a fixed **5 s** of silence before sending (`useInterview.ts:840`).
  - Kai only starts speaking after the whole reply has been generated (`useInterview.ts:780`).
- **A mic button does exist** (`MicrophoneButton`). What's broken is that turning it off doesn't stick: every Kai reply calls `setMicIntent('auto-on')`, and the 3.5 s deferred stop keeps the mic open.
- **"Text-only" needs a typing box.** `TextInterviewMode.tsx` has been unused since the desktop redesign, and the "tap the keyboard icon" toast points at an icon that no longer exists.
- **The mic dies because of two separate "listening" flags.** The mic-restart logic checks `stt.isListening`, not the VAD. When the deferred timer paused the VAD, nothing restarted it until the visibility handler fired, which is why switching tabs brought the mic back.
- **Every turn paid three failed Groq calls before falling back.** Groq returned 429 on each one, and nothing remembers that. The chat pool also includes `gpt-oss-safeguard-20b`, which is a safety classifier, not a chat model.
- **The transcription route is slow before it even reaches Groq.** It does four waits in a row (auth, rate limit, flag, form) and uses one API key instead of the key pool.
- **Seven voice files are dead code:** `useInterviewVoice`, `useInterviewControl`, `useInterviewApi`, `useInterviewMessages`, `useVoiceActivityDetection`, `TextInterviewMode`, and `interruption-manager`.

**Free-tier facts behind the plan** (Groq docs, checked 2026-09-27):
- **Groq chat models** (gpt-oss-120b/20b, qwen3.8-27b): 200K tokens/day and 1K requests/day per model, per organization.
- **Groq Whisper:** 2K requests/day and 28.8K audio-seconds/day, with each request billed as at least 10 s.
- **Cerebras** was dropped: its "free" trial needs a card, and the credits expire after 30 days.
- **Kokoro in-browser voice** (the Stage 2 option): about 0.3–0.75 s to first audio on dedicated GPUs and Apple Silicon. On Intel integrated graphics it's about 3.5 s and sometimes crashes, so Stage 2 must check the device before using it.
