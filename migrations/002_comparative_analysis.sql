-- ============================================================================
-- Migration 002: Comparative Analysis + Feature Flags
-- ============================================================================
-- Enables comparative analysis: chaining interview attempts at the same problem.
-- previous_session_id links this attempt to the prior attempt.
-- attempt_number (1,2,3...) tracks progression for display.
--
-- This migration is IDEMPOTENT — safe to run multiple times on a live DB.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add columns to interview_sessions (IF NOT EXISTS pattern)
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'interview_sessions'
          AND column_name  = 'previous_session_id'
    ) THEN
        ALTER TABLE public.interview_sessions
            ADD COLUMN previous_session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'interview_sessions'
          AND column_name  = 'attempt_number'
    ) THEN
        ALTER TABLE public.interview_sessions
            ADD COLUMN attempt_number INTEGER NOT NULL DEFAULT 1;
    END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Performance index: quickly find all sessions for a user+problem
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_user_problem
    ON interview_sessions(user_id, problem_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Partial index: comparative queries on chained sessions
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_previous
    ON interview_sessions(previous_session_id) WHERE previous_session_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Feature flags — ON CONFLICT DO NOTHING (safe to re-run)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_GROQ_TTS',
    false,
    'Groq PlayAI TTS (Aaliya-PlayAI Indian English voice). Primary TTS when enabled. Fallback: Browser Web Speech API. Requires GROQ_API_KEY env var.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_AWS_POLLY_TTS',
    false,
    'AWS Polly Neural TTS (Kajal Indian English voice). Last-resort TTS fallback. Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars. DISABLE when AWS credits expire.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_AWS_TRANSCRIBE_STT',
    false,
    'AWS Transcribe for post-interview batch transcription enrichment only (NOT real-time). Improves analysis accuracy. Requires AWS credentials. DISABLE when AWS credits expire.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_AWS_S3_STORAGE',
    false,
    'Store session transcripts on AWS S3 instead of Supabase storage. Fallback: Supabase. Requires AWS credentials + S3_BUCKET_NAME env var. DISABLE when AWS credits expire.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_LEARN_MODE',
    false,
    'AI tutor mode with Hinglish support. User can learn concepts after poor performance. Routes to /learn page.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_COMPARATIVE_ANALYSIS',
    true,
    'Show side-by-side performance comparison when user retries a problem. Uses spaced_repetition table for scheduling.'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_feature_flags (key, is_enabled, notes)
VALUES (
    'ENABLE_DIFFICULTY_MODES',
    true,
    'Difficulty-based interview modes: Warm-Up, Practice, Crunch, Sprint. Replaces company-specific tags as primary filter.'
) ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- ROLLBACK (commented out) — run manually if you need to reverse this migration
-- ============================================================================
--
-- -- Remove indexes
-- DROP INDEX IF EXISTS idx_sessions_previous;
-- DROP INDEX IF EXISTS idx_sessions_user_problem;
--
-- -- Remove columns
-- ALTER TABLE public.interview_sessions DROP COLUMN IF EXISTS attempt_number;
-- ALTER TABLE public.interview_sessions DROP COLUMN IF EXISTS previous_session_id;
--
-- -- Remove feature flags
-- DELETE FROM public.global_feature_flags WHERE key IN (
--     'ENABLE_GROQ_TTS',
--     'ENABLE_AWS_POLLY_TTS',
--     'ENABLE_AWS_TRANSCRIBE_STT',
--     'ENABLE_AWS_S3_STORAGE',
--     'ENABLE_LEARN_MODE',
--     'ENABLE_COMPARATIVE_ANALYSIS',
--     'ENABLE_DIFFICULTY_MODES'
-- );
