-- 11_cognitive_narrative.sql

ALTER TABLE public.learner_profiles
ADD COLUMN IF NOT EXISTS narrative TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sessions_at_last_narrative INTEGER DEFAULT 0;
