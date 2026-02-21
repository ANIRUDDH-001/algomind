-- Migration P6-2 (UPDATED) — Full model_registry with accurate rate limits
-- Run in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS model_registry (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id       TEXT        UNIQUE NOT NULL,
  provider       TEXT        NOT NULL,
  tier           INTEGER     NOT NULL DEFAULT 99,
  rpm            INTEGER     NOT NULL DEFAULT 0,
  tpm            INTEGER     NOT NULL DEFAULT 0,
  rpd            INTEGER     NOT NULL DEFAULT 0,
  context_window INTEGER     NOT NULL DEFAULT 8192,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  is_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_preview     BOOLEAN     NOT NULL DEFAULT FALSE,
  deprecated_at  TIMESTAMPTZ,
  last_verified  TIMESTAMPTZ,
  notes          TEXT
);

INSERT INTO model_registry
  (model_id, provider, tier, rpm, tpm, rpd, context_window, is_active, is_verified, is_preview, notes)
VALUES

-- ─── GROQ CHAT MODELS ────────────────────────────────────────────────────────

-- Tier 1: Best quality — balanced limits
('llama-3.3-70b-versatile',                      'groq', 1,  30,  12000,  1000,  128000, TRUE, TRUE,  FALSE,
 'Primary workhorse. 12K TPM, 1K RPD. Best quality for complex reasoning.'),

-- Tier 2: High context + highest TPM (30K/min is exceptional)
('meta-llama/llama-4-scout-17b-16e-instruct',    'groq', 2,  30,  30000,  1000, 1000000, TRUE, TRUE,  FALSE,
 'Highest TPM on Groq (30K/min). 1M context. Best for long transcript analysis.'),

-- Tier 2: Fastest RPM — 60 req/min with good context
('moonshotai/kimi-k2-instruct',                  'groq', 2,  60,  10000,  1000,  131072, TRUE, TRUE,  FALSE,
 '60 RPM (highest). Good TPM+context balance. Ideal for concurrent sessions.'),

-- Tier 3: Highest RPD — 14,400/day, best for sustained volume
('llama-3.1-8b-instant',                         'groq', 3,  30,   6000, 14400,  128000, TRUE, TRUE,  FALSE,
 'Highest RPD on free tier (14.4K/day). Fast 8B model, ideal as high-volume fallback.'),

-- Tier 3: 60 RPM, strong daily token budget
('qwen/qwen3-32b',                               'groq', 3,  60,   6000,  1000,  131072, TRUE, TRUE,  FALSE,
 '60 RPM. Qwen3 32B strong multilingual + reasoning. Good Hinglish support.'),

-- Tier 4: Large context maverick
('meta-llama/llama-4-maverick-17b-128e-instruct','groq', 4,  30,   6000,  1000, 1000000, TRUE, TRUE,  FALSE,
 '1M context window. Tier 4 fallback for very long sessions.'),

-- Tier 5: GPT-OSS large — high quality fallback
('openai/gpt-oss-120b',                          'groq', 5,  30,   8000,  1000,  200000, TRUE, TRUE,  FALSE,
 '120B model via Groq. 200K context. Tier 5 quality fallback.'),

-- Tier 6: GPT-OSS small — fast + capable
('openai/gpt-oss-20b',                           'groq', 6,  30,   8000,  1000,  200000, TRUE, TRUE,  FALSE,
 '20B model via Groq. 200K context. Tier 6 speed/quality balance.'),

-- ─── GROQ AUDIO (WHISPER STT) ─────────────────────────────────────────────

-- Primary STT (faster, same quality at 4× less compute)
('whisper-large-v3-turbo',                       'groq', 20, 20,      0,  2000,       0, TRUE, TRUE,  FALSE,
 'Primary STT. 20 RPM, 2K RPD audio. 7.2K audio-mins/day. Preferred for speed.'),

-- Fallback STT (highest accuracy)
('whisper-large-v3',                             'groq', 21, 20,      0,  2000,       0, TRUE, TRUE,  FALSE,
 'Fallback STT. Same limits as turbo. Higher accuracy for difficult accents/accents.'),

-- ─── GEMINI CHAT MODELS (non-zero quota only) ────────────────────────────

-- Tier 10: Best Gemini — massive TPM (250K/min)
('gemini-2.5-flash',                             'gemini',10,  5, 250000,    20, 1000000, TRUE, TRUE,  FALSE,
 'Best Gemini quality. 250K TPM but only 5 RPM/20 RPD. Use for high-value single calls.'),

-- Tier 11: Faster Gemini, 2× RPM, same TPM budget
('gemini-2.5-flash-lite',                        'gemini',11, 10, 250000,    20, 1000000, TRUE, TRUE,  TRUE,
 '10 RPM vs 5 for Flash. Same 250K TPM. Better for moderate-volume Gemini usage.'),

-- Tier 12: Gemma open weights — high RPD (14.4K/day)
('gemma-3-27b-it',                               'gemini',12, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 27B instruction-tuned. 14.4K RPD — very high daily quota. Strong quality.'),

-- Tier 13: Smaller Gemma — same limits, faster inference
('gemma-3-12b-it',                               'gemini',13, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 12B. Same 14.4K RPD. Faster than 27B with moderate quality tradeoff.'),

-- Tier 14: Efficient Gemma
('gemma-3-4b-it',                                'gemini',14, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 4B. Low-latency fallback. Good for simple clarification questions.'),

-- Tier 15: Lightest Gemma — near-instant, smallest context
('gemma-3-1b-it',                                'gemini',15, 30,  15000, 14400,   32000, TRUE, TRUE,  FALSE,
 'Gemma 3 1B. Fastest possible. 32K context. Emergency fallback / intent classification.')

ON CONFLICT (model_id) DO UPDATE SET
  provider       = EXCLUDED.provider,
  tier           = EXCLUDED.tier,
  rpm            = EXCLUDED.rpm,
  tpm            = EXCLUDED.tpm,
  rpd            = EXCLUDED.rpd,
  context_window = EXCLUDED.context_window,
  is_active      = EXCLUDED.is_active,
  is_verified    = EXCLUDED.is_verified,
  is_preview     = EXCLUDED.is_preview,
  notes          = EXCLUDED.notes;

-- Verify insertion:
SELECT provider, model_id, tier, rpm, tpm, rpd, context_window
FROM model_registry
ORDER BY tier, provider;
