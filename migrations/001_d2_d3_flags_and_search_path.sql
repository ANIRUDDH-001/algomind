-- Migration: D2 + D3 — Fix search_path on SECURITY DEFINER functions & seed flag rows
-- Date: 2025-01-XX
-- Plan refs: D2 (BUG-17 search_path fix), D3 (seed missing flag rows)

-- ============================================================
-- D2: Fix check_is_admin / is_admin search_path
-- Supabase security advisory: all SECURITY DEFINER functions
-- must SET search_path = 'public' to prevent search_path injection.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type IN ('admin', 'owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.co_owners
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND account_type IN ('admin', 'owner'));
$$;

-- ============================================================
-- D3: Seed missing global_feature_flags rows
-- ON CONFLICT (key) DO NOTHING — safe to re-run.
-- ============================================================

INSERT INTO public.global_feature_flags (key, is_enabled, notes) VALUES
  ('ENABLE_VAD_INTERRUPTIONS',    true,  'Voice Activity Detection'),
  ('ENABLE_WHISPER_STT',          true,  'Whisper speech-to-text'),
  ('ENABLE_GROQ_TTS',             false, 'Groq TTS provider'),
  ('ENABLE_CHUNKED_RESPONSES',    true,  'Chunked streaming responses'),
  ('ENABLE_AWS_POLLY_TTS',        false, 'AWS Polly TTS'),
  ('ENABLE_AWS_TRANSCRIBE_STT',   false, 'AWS Transcribe STT'),
  ('ENABLE_AWS_S3_STORAGE',       false, 'AWS S3 storage'),
  ('ENABLE_LEARN_MODE',           true,  'Learn mode feature'),
  ('ENABLE_COMPARATIVE_ANALYSIS', true,  'Comparative analysis'),
  ('ENABLE_DIFFICULTY_MODES',     true,  'Difficulty modes'),
  ('ENABLE_HINGLISH_SUPPORT',     true,  'Hinglish language support'),
  ('ENABLE_SILENT_OBSERVER',      true,  'Silent observer mode'),
  ('ENABLE_SMART_ROUTING',        true,  'Smart AI routing'),
  ('ENABLE_RESPONSE_CACHE',       true,  'Response caching')
ON CONFLICT (key) DO NOTHING;
