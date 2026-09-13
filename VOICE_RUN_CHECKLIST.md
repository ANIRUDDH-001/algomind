# Voice Pipeline — Live Run Checklist

Run this in your **real Chrome** (the in-app browser has no mic/audio). Open DevTools → Console
**before** you click Start, and filter the console by `[PIPE]`. Do it once on **desktop** and once
on **phone** (Chrome). Two short interviews (~4–5 turns each) is enough.

**Two ways to get me the evidence** — pick either:
- **(A) Live:** tell me "starting voice run now" and I'll attach via Claude-in-Chrome to read your
  console `[PIPE]` lines as they happen (no copy-paste).
- **(B) Paste:** after the run, copy the `[PIPE]`-filtered console and paste it to me.

---

## Steps → what to observe → the log line that proves it

| # | Do this | Observe (your ears/eyes) | Log line that must appear |
|---|---|---|---|
| 1 | Click **Start** | — | `[PIPE][VAD] init OK — mic/VAD ready (echoCancellation on)` (if you see `init FAILED` → mic/VAD is broken, note it) |
| 2 | Wait for Kai's **first greeting** | 🔊 **Is it spoken aloud?** (This was the "silent intro" bug) | `[PIPE][TTS] speak start …` then `[PIPE][TTS] speak done … spokenOk=true`. If you see `spokenOk=false ⚠️ SPEAKER-DID-NOT-PLAY` → the bug is back. Note `browserVoices=` (0 = no voices installed) |
| 3 | Say a **full sentence** that starts with a soft word: *"So, I think we could use a hash map here."* | Did it capture the **"So, I think"** at the start, and the **"here"** at the end? (This was the cut-off bug) | `[PIPE][VAD] mic speech-start detected` → `[PIPE][STT] mic captured NNNNms of audio` → `[PIPE][STT] transcribed in NNNms → "…"`. **Compare the transcribed text to what you said** — note any missing start/end words. |
| 4 | After you stop speaking, **count the seconds** until Kai replies | Is the pause acceptable (<3s) or long? Does it feel laggy? | Time between `[PIPE][STT] transcribed` and `[PIPE][CHAT] first token in NNNms`. Note both numbers. |
| 5 | Say something **with a mid-sentence pause**: *"The complexity is… (pause 1.5s) …O of n log n."* | Did it wait for you, or cut you off at the pause and send half? | One `mic captured` line (good) vs two (it split your sentence — VAD redemption too short) |
| 6 | Let Kai reach **message 4** (keep answering) | 🔊 Is the **4th** Kai message spoken? (Chrome TTS pause bug) | 4th `[PIPE][TTS] speak done … spokenOk=true`. Note any `spokenOk=false` on ANY message and which number. |
| 7 | **Interrupt** Kai while it's speaking (barge-in) — start talking mid-sentence | Does Kai stop and listen? | `speech-start detected` while a `speak start` is still open (before its `speak done`) |
| 8 | Say **one-word answer**: *"Sort."* | Was it captured, or dropped as too short? | `mic captured` + transcribed `"Sort"` (if EMPTY ⚠️ → minSpeech too high) |
| 9 | Mention **complexity in words**: *"O of n squared"* | Does Kai's spoken reply say "O of n squared" or read symbols/dollar signs aloud? | Kai's `speak start` text shouldn't contain `$`, `^`, or `**` |
| 10 | Finish the interview | Report loads | (text-mode already verified; just confirm it renders) |

## Also note (no log needed)
- Any moment the mic indicator looks ON but nothing gets captured
- Any moment Kai talks over you / you talk over Kai and it garbles
- Phone only: does it work with the screen locked? on speakerphone vs earpiece?

Copy your notes into a quick list keyed by step number (e.g. "3: missed 'So' at start; 6: msg 4 silent").
