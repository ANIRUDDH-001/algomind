-- Status tracking for the ingestion pipeline
ALTER TABLE public.knowledge_gaps
    ADD COLUMN IF NOT EXISTS admin_notes        TEXT,
    ADD COLUMN IF NOT EXISTS suggested_content  TEXT,
    ADD COLUMN IF NOT EXISTS suggested_title    TEXT,
    ADD COLUMN IF NOT EXISTS ai_drafted         BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by        UUID REFERENCES auth.users(id);

-- Pipeline status for knowledge_chunks
ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS source_gap_id  UUID REFERENCES public.knowledge_gaps(id),
    ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' 
        CHECK (embedding_status IN ('pending', 'processing', 'done', 'failed')),
    ADD COLUMN IF NOT EXISTS embedding_model  TEXT;

-- Index for admin queue view
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_priority_status
    ON public.knowledge_gaps (priority DESC, status, upvotes DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_status
    ON public.knowledge_chunks (embedding_status);

-- ── JWT Custom Claims: cache account_type in app_metadata ──────────────────
-- This runs on every new user creation AND on explicit account_type changes.
-- Eliminates per-request DB query for employer/owner middleware redirect.

-- Update handle_new_user to set app_metadata.account_type on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile (preserve existing logic)
  INSERT INTO public.profiles (id, email, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Write account_type into app_metadata so middleware can read from JWT
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('account_type', COALESCE(NEW.raw_user_meta_data->>'account_type', 'user'))
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger to keep app_metadata in sync when profiles.account_type changes
CREATE OR REPLACE FUNCTION public.sync_account_type_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('account_type', NEW.account_type)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_account_type_change ON public.profiles;
CREATE TRIGGER on_profile_account_type_change
  AFTER UPDATE OF account_type ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_type_to_jwt();

-- ── DB-001: Index on profiles.account_type ────────────────────────────────
-- Prevents full table scan on account_type-based queries.
-- NOTE: Applied directly via SQL editor with CONCURRENTLY for zero-downtime.
-- Included here for schema documentation / replay purposes.
CREATE INDEX IF NOT EXISTS idx_profiles_account_type
    ON public.profiles (account_type);

-- Partial index for employer lookups specifically.
-- Middleware redirect filters for account_type = 'employer'.
CREATE INDEX IF NOT EXISTS idx_profiles_account_type_employer
    ON public.profiles (id)
    WHERE account_type = 'employer';

