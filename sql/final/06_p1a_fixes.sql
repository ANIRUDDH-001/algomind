-- ============================================================
-- P1-A FIXES — Run in Supabase SQL Editor (in order)
-- ============================================================

-- -------------------------------------------------------
-- 1. FIX EMBEDDING DIMENSION MISMATCH
-- knowledge_chunks uses vector(3072) but match_knowledge_chunks expects vector(768)
-- WARNING: This NULLs existing embeddings. Re-run ingest script after.
-- -------------------------------------------------------

-- Check current dimension (should show vector or vector(3072)):
-- SELECT column_name, udt_name FROM information_schema.columns
-- WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding';

ALTER TABLE public.knowledge_chunks
  ALTER COLUMN embedding TYPE vector(768)
  USING NULL;  -- sets existing to NULL, you must re-ingest

-- The match_knowledge_chunks function in 03_functions.sql already uses vector(768),
-- but re-create it to be safe with the improved COALESCE title:
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid, topic text, subtopic text,
  title text, content text, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id, kc.topic, kc.subtopic,
    COALESCE(kc.topic || ': ' || kc.subtopic, 'Untitled') AS title,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM knowledge_chunks kc
  WHERE kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- -------------------------------------------------------
-- 2. FIX check_user_rate_limit — Make it ATOMIC
-- Old version: reads count but does NOT increment (race condition)
-- New version: increments first, then checks
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION check_user_rate_limit(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, is_admin_user BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_usage INTEGER;
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Check admin status first (admins exempt from limits)
  v_is_admin := public.is_admin(p_user_id);
  IF v_is_admin THEN
    RETURN QUERY SELECT TRUE, p_limit, TRUE;
    RETURN;
  END IF;

  -- 2. Atomic increment: insert 1 or add 1 if today's row exists
  INSERT INTO public.user_daily_usage (user_id, date, questions_used)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    questions_used = user_daily_usage.questions_used + 1,
    updated_at = NOW()
  RETURNING questions_used INTO v_current_usage;

  -- 3. If over limit, rollback the increment and return denied
  IF v_current_usage > p_limit THEN
    UPDATE public.user_daily_usage
    SET questions_used = questions_used - 1, updated_at = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN QUERY SELECT FALSE, 0, FALSE;
  ELSE
    RETURN QUERY SELECT TRUE, p_limit - v_current_usage, FALSE;
  END IF;
END;
$$;

-- Keep record_user_question for legacy compat but it should not be called in main flow:
CREATE OR REPLACE FUNCTION record_user_question(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_daily_usage (user_id, date, questions_used)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET questions_used = user_daily_usage.questions_used + 1,
               updated_at = NOW();
END;
$$;


-- -------------------------------------------------------
-- 3. FIX ADMIN USERS RLS — Restrict who can see admin emails
-- -------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can check admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can view admin list" ON public.admin_users;

-- Users can only see their OWN admin record (not the full list)
CREATE POLICY "Users check own admin status"
  ON public.admin_users FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can manage the full list (for the admin panel)
CREATE POLICY "Admins manage admin_users"
  ON public.admin_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users self
      WHERE self.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );


-- -------------------------------------------------------
-- 4. SEED ADMIN EMAIL (replace with your actual email)
-- -------------------------------------------------------

-- INSERT INTO public.admin_users (email, name, added_by)
-- VALUES ('your-email@gmail.com', 'Your Name', 'manual')
-- ON CONFLICT (email) DO NOTHING;


-- -------------------------------------------------------
-- 5. VERIFICATION QUERIES — Run each to confirm
-- -------------------------------------------------------

-- Check embedding column dimension:
-- SELECT column_name, udt_name FROM information_schema.columns
-- WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding';
-- Expected: vector(768)

-- Check match_knowledge_chunks signature:
-- SELECT proname, pg_get_function_arguments(oid) as args
-- FROM pg_proc WHERE proname = 'match_knowledge_chunks';
-- Expected: vector(768)

-- Check atomic rate limit exists:
-- SELECT proname FROM pg_proc WHERE proname = 'check_user_rate_limit';

-- Check admin RLS policies:
-- SELECT policyname FROM pg_policies WHERE tablename = 'admin_users';
-- Expected: "Users check own admin status", "Admins manage admin_users"

-- Check NO tables with RLS disabled:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: 0 rows
