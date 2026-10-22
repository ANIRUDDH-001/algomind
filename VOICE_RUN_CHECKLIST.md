# Voice Pipeline — Live Run Checklist

Run this in your **real Chrome** on **localhost** (the in-app browser has no mic/audio). Do it once on
**desktop** and once on **phone** (Chrome). Two interviews of ~10 turns each is enough.

**Evidence now lands in the database.** Every turn posts a timeline to `/api/voice/telemetry`, which
writes one `system_events` row per turn (`voice.turn_timeline`, or `voice.engine_error` when the turn
failed) and one row per mic recovery/failure (`voice.mic_status`). After the run, the SQL below is the
record: no console copy-paste needed. The console still prints one `[PIPE][TURN]` summary line per turn
if you want to watch live.

---

## Steps → what to observe → where it shows up

| # | Do this | Observe (your ears/eyes) | Evidence |
|---|---|---|---|
| 1 | Open `/voice-check` first | All four rows ✓ (mic, speech detection, transcription, speaker) | The page itself; **Copy report** for bug reports |
| 2 | Start an interview, wait for Kai's **greeting** | 🔊 Spoken aloud? | Turn `0` row, `outcome = 'spoken'` |
| 3 | Say a **full sentence** starting with a soft word: *"So, I think we could use a hash map here."* | Were "So, I think" and "here" both captured? | Console `[PIPE][STT] transcribed in NNNms → "…"` — compare with what you said |
| 4 | After you stop speaking, **count the seconds** until Kai replies | Acceptable (< 3 s)? | `derived.turnGapMs` for that turn (query B) |
| 5 | Pause **3 s mid-sentence**: *"The complexity is… (pause) …O of n log n."* | Did it wait, or send half? | One turn row with both halves, not two |
| 6 | Keep going to Kai's **message 4+** | 🔊 Every reply spoken? | No `outcome = 'error'` rows (query C) |
| 7 | Press **Esc** while Kai speaks | Kai stops and the mic listens | That turn is `aborted` (`details.kaiInterrupted = 'user'`) — not `error` |
| 8 | **Mute** (mic button), wait through one Kai reply, **unmute** | Mic stays off while muted; comes back on unmute | Mic indicator; no turn rows while muted |
| 9 | Switch tabs for 10 s, come back | Mic listening again without a click | No `voice.mic_status` `failed` row (query C) |
| 10 | Say a **one-word answer**: *"Yes."* | Captured, not dropped? | Console `[PIPE][STT] transcribed … → "Yes"` (transcripts are never stored in telemetry) |
| 11 | Finish the interview | Report loads | — |

## Also note (no log needed)
- Any moment the mic indicator looks ON but nothing gets captured
- Any moment Kai talks over you / you talk over Kai and it garbles
- Any transcript that contains **Kai's own words** (echo)
- Phone only: does it work on speakerphone vs earpiece?

---

## Owner queries (Supabase SQL editor)

Columns used: `system_events.type`, `created_at`, `user_id`, `metadata` (jsonb). Per-turn fields live
under `metadata`: `sessionId`, `turn`, `outcome`, `stages`, `derived`, `details`, `ua`.

**A. Hourly health, last 24 h** (errors are stored as `voice.engine_error`, so both types are counted):

```sql
select date_trunc('hour', created_at) as hour,
       count(*) as turns,
       percentile_cont(0.5) within group (order by (metadata->'derived'->>'turnGapMs')::int) as p50_gap_ms,
       percentile_cont(0.95) within group (order by (metadata->'derived'->>'turnGapMs')::int) as p95_gap_ms,
       percentile_cont(0.5) within group (order by (metadata->'derived'->>'sttMs')::int) as p50_stt_ms,
       count(*) filter (where metadata->>'outcome' = 'error') as errors,
       count(*) filter (where metadata->>'outcome' = 'aborted') as aborted
from system_events
where type in ('voice.turn_timeline', 'voice.engine_error')
  and created_at > now() - interval '24 hours'
group by 1 order by 1 desc;
```

**B. One run, turn by turn** (latest session first; pick the `sessionId` of your run):

```sql
select metadata->>'sessionId' as session,
       (metadata->>'turn')::int as turn,
       metadata->>'outcome' as outcome,
       (metadata->'derived'->>'turnGapMs')::int as gap_ms,
       (metadata->'derived'->>'sttMs')::int as stt_ms,
       (metadata->'derived'->>'commitWaitMs')::int as commit_wait_ms,
       (metadata->'derived'->>'ttftMs')::int as ttft_ms,
       (metadata->'derived'->>'ttfaMs')::int as ttfa_ms,
       metadata->'details' as details,
       created_at
from system_events
where type in ('voice.turn_timeline', 'voice.engine_error')
  and created_at > now() - interval '3 hours'
order by created_at desc, (metadata->>'turn')::int desc;
```

**C. What went wrong, last 24 h** (TTS codes, STT/chat errors, mic failures):

```sql
select type,
       coalesce(metadata->'details'->>'ttsError',
                metadata->'details'->>'sttError',
                metadata->'details'->>'chatError',
                metadata->'details'->>'micStatus') as reason,
       metadata->'details'->>'micDetail' as mic_detail,
       count(*) as n,
       max(created_at) as last_seen
from system_events
where type in ('voice.engine_error', 'voice.mic_status')
  and created_at > now() - interval '24 hours'
group by 1, 2, 3 order by n desc;
```

**Pass bar for flipping `ENABLE_VOICE_MODE` on:** query C shows no `watchdog` / `no-english-voice`
codes and no TTS- or mic-caused errors; query A shows `p50_gap_ms ≤ 3000`, `p95_gap_ms ≤ 4500`,
`p50_stt_ms ≤ 1200`.
