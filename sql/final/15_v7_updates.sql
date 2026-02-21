-- ─────────────────────────────────────────────
-- TABLE: admin_users (BUG-V7-02)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email     TEXT        UNIQUE NOT NULL,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
INSERT INTO admin_users (email, added_by)
VALUES ('aniruddhvijay2k7@gmail.com', 'bootstrap')
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────
-- TABLE: user_preferences (BUG-V7-04)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leetcode_username    TEXT,
  leetcode_fetch_status TEXT       DEFAULT 'idle',
  voice_settings       JSONB       DEFAULT '{}'::jsonb,
  updated_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_preferences ADD CONSTRAINT IF NOT EXISTS
  unique_user_preferences_user_id UNIQUE (user_id);

-- ─────────────────────────────────────────────
-- TABLE: system_events (BUG-V7-15)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_events (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type          TEXT        NOT NULL,
  error_message TEXT,
  metadata      JSONB       DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_events_type_created
  ON system_events(type, created_at DESC);

-- ─────────────────────────────────────────────
-- TABLE: company_profiles (BUG-V7-03)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_profiles (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  emoji          TEXT NOT NULL DEFAULT '🏢',
  theme_color    TEXT NOT NULL DEFAULT 'slate',
  persona_prompt TEXT NOT NULL DEFAULT ''
);
INSERT INTO company_profiles VALUES
  ('google',  'Google',  '🔍', 'blue',        'Focus on algorithmic efficiency and Big-O analysis. Ask follow-up questions about time and space complexity. Expect candidates to discuss trade-offs between different data structures.'),
  ('meta',    'Meta',    '♾️', 'blue-purple', 'Prioritize speed and bug-free code. Focus on scalability — billions of users. Ask about edge cases. Expect clean, readable code over clever one-liners.'),
  ('amazon',  'Amazon',  '📦', 'amber',       'Emphasize Leadership Principles — especially Ownership and Dive Deep. Ask why the candidate chose their approach. Expect thinking out loud about trade-offs.'),
  ('startup', 'Startup', '🚀', 'green',       'Value pragmatism and getting things done. Clean working code beats perfect code. Ask about maintainability and how the solution would evolve over time.')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- TABLE: model_registry (from Phase 6 — ensure exists)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_registry (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id        TEXT        UNIQUE NOT NULL,
  provider        TEXT        NOT NULL,
  tier            INTEGER     NOT NULL DEFAULT 99,
  rpm             INTEGER     NOT NULL DEFAULT 0,
  tpm             INTEGER     NOT NULL DEFAULT 0,
  rpd             INTEGER     NOT NULL DEFAULT 0,
  context_window  INTEGER     NOT NULL DEFAULT 8192,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_preview      BOOLEAN     NOT NULL DEFAULT FALSE,
  deprecated_at   TIMESTAMPTZ,
  last_verified   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Migration P6-2 (UPDATED) — Full model_registry with accurate rate limits
INSERT INTO model_registry
  (model_id, provider, tier, rpm, tpm, rpd, context_window, is_active, is_verified, is_preview, notes)
VALUES
-- ─── GROQ CHAT MODELS ────────────────────────────────────────────────────────
('llama-3.3-70b-versatile',                      'groq', 1,  30,  12000,  1000,  128000, TRUE, TRUE,  FALSE,
 'Primary workhorse. 12K TPM, 1K RPD. Best quality for complex reasoning.'),
('meta-llama/llama-4-scout-17b-16e-instruct',    'groq', 2,  30,  30000,  1000, 1000000, TRUE, TRUE,  FALSE,
 'Highest TPM on Groq (30K/min). 1M context. Best for long transcript analysis.'),
('moonshotai/kimi-k2-instruct',                  'groq', 2,  60,  10000,  1000,  131072, TRUE, TRUE,  FALSE,
 '60 RPM (highest). Good TPM+context balance. Ideal for concurrent sessions.'),
('llama-3.1-8b-instant',                         'groq', 3,  30,   6000, 14400,  128000, TRUE, TRUE,  FALSE,
 'Highest RPD on free tier (14.4K/day). Fast 8B model, ideal as high-volume fallback.'),
('qwen/qwen3-32b',                               'groq', 3,  60,   6000,  1000,  131072, TRUE, TRUE,  FALSE,
 '60 RPM. Qwen3 32B strong multilingual + reasoning. Good Hinglish support.'),
('meta-llama/llama-4-maverick-17b-128e-instruct','groq', 4,  30,   6000,  1000, 1000000, TRUE, TRUE,  FALSE,
 '1M context window. Tier 4 fallback for very long sessions.'),
('openai/gpt-oss-120b',                          'groq', 5,  30,   8000,  1000,  200000, TRUE, TRUE,  FALSE,
 '120B model via Groq. 200K context. Tier 5 quality fallback.'),
('openai/gpt-oss-20b',                           'groq', 6,  30,   8000,  1000,  200000, TRUE, TRUE,  FALSE,
 '20B model via Groq. 200K context. Tier 6 speed/quality balance.'),
-- ─── GROQ AUDIO (WHISPER STT) ─────────────────────────────────────────────
('whisper-large-v3-turbo',                       'groq', 20, 20,      0,  2000,       0, TRUE, TRUE,  FALSE,
 'Primary STT. 20 RPM, 2K RPD audio. 7.2K audio-mins/day. Preferred for speed.'),
('whisper-large-v3',                             'groq', 21, 20,      0,  2000,       0, TRUE, TRUE,  FALSE,
 'Fallback STT. Same limits as turbo. Higher accuracy for difficult accents/accents.'),
-- ─── GEMINI CHAT MODELS (non-zero quota only) ────────────────────────────
('gemini-2.5-flash',                             'gemini',10,  5, 250000,    20, 1000000, TRUE, TRUE,  FALSE,
 'Best Gemini quality. 250K TPM but only 5 RPM/20 RPD. Use for high-value single calls.'),
('gemini-2.5-flash-lite',                        'gemini',11, 10, 250000,    20, 1000000, TRUE, TRUE,  TRUE,
 '10 RPM vs 5 for Flash. Same 250K TPM. Better for moderate-volume Gemini usage.'),
('gemma-3-27b-it',                               'gemini',12, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 27B instruction-tuned. 14.4K RPD — very high daily quota. Strong quality.'),
('gemma-3-12b-it',                               'gemini',13, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 12B. Same 14.4K RPD. Faster than 27B with moderate quality tradeoff.'),
('gemma-3-4b-it',                                'gemini',14, 30,  15000, 14400,  131072, TRUE, TRUE,  FALSE,
 'Gemma 3 4B. Low-latency fallback. Good for simple clarification questions.'),
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

-- ─────────────────────────────────────────────
-- RPC: check_is_admin (BUG-V7-01)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION check_is_admin() TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: get_model_rate_stats (BUG-V7-07)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_model_rate_stats()
RETURNS TABLE(model_id TEXT, hits_24h BIGINT, last_hit TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    (metadata->>'model_id') AS model_id,
    COUNT(*) AS hits_24h,
    MAX(created_at) AS last_hit
  FROM system_events
  WHERE type = 'model_429'
    AND created_at >= now() - interval '24 hours'
    AND metadata->>'model_id' IS NOT NULL
  GROUP BY metadata->>'model_id';
$$;
GRANT EXECUTE ON FUNCTION get_model_rate_stats() TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: get_user_sessions_with_assessment (BUG-V7-08)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_sessions_with_assessment(p_user_id UUID)
RETURNS TABLE(
  session_id       UUID,
  problem_title    TEXT,
  problem_difficulty TEXT,
  duration         INTEGER,
  completed_at     TIMESTAMPTZ,
  overall_score    NUMERIC,
  overall_feedback TEXT,
  next_steps       JSONB,
  transcript       JSONB
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id,
    s.problem_title,
    s.problem_difficulty,
    s.duration,
    s.completed_at,
    a.overall_score,
    a.overall_feedback,
    a.next_steps,
    s.transcript
  FROM interview_sessions s
  LEFT JOIN assessments a ON a.session_id = s.id
  WHERE s.user_id = p_user_id
  ORDER BY s.completed_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_user_sessions_with_assessment(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: check_user_rate_limit (BUG-V7-09)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_user_rate_limit(p_user_id UUID, p_limit INT)
RETURNS TABLE(allowed BOOLEAN, remaining INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM interview_sessions
  WHERE user_id = p_user_id
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT
    (v_count < p_limit) AS allowed,
    GREATEST(0, p_limit - v_count) AS remaining;
END;
$$;
GRANT EXECUTE ON FUNCTION check_user_rate_limit(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: claim_campaign_slot (BUG-V7-18)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_campaign_slot(p_campaign_id UUID)
RETURNS TABLE(id UUID, problem_id UUID, employer_id UUID, title TEXT, max_uses INT, uses_count INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    UPDATE campaigns
    SET uses_count = uses_count + 1
    WHERE campaigns.id = p_campaign_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR uses_count < max_uses)
    RETURNING campaigns.id, campaigns.problem_id, campaigns.employer_id,
              campaigns.title, campaigns.max_uses, campaigns.uses_count;
END;
$$;
