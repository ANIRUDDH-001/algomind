-- Migration: Enforce replay token TTL defaults and non-null expiry
-- Applied: 2026-04-03

-- ============================================================================
-- 1. Backfill any legacy rows with missing expiry
-- ============================================================================

UPDATE public.session_replays
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- ============================================================================
-- 2. Enforce default and non-null expiry for future rows
-- ============================================================================

ALTER TABLE public.session_replays
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '30 days');

ALTER TABLE public.session_replays
  ALTER COLUMN expires_at SET NOT NULL;

-- ============================================================================
-- 3. Add index to support expiry lifecycle operations
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_session_replays_expires_at
ON public.session_replays (expires_at);

-- ============================================================================
-- Rollback steps (do not execute - for reference only):
-- ============================================================================
-- DROP INDEX IF EXISTS public.idx_session_replays_expires_at;
-- ALTER TABLE public.session_replays ALTER COLUMN expires_at DROP NOT NULL;
-- ALTER TABLE public.session_replays ALTER COLUMN expires_at DROP DEFAULT;
