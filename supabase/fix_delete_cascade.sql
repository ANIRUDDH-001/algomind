-- =================================================================
-- FIX: Allow deleting users from Authentication (auth.users)
-- This script handles Foreign Key constraints to support deletion.
-- 
-- POLICY: DATA RETENTION FOR RAG TRAINING
-- 1. PII/Account Data (Profiles, Preferences) -> DELETED (Cascade)
-- 2. Training Data (Sessions, Transcripts) -> ANONYMIZED (Set Null)
-- =================================================================

-- 1. Profiles Table (PII -> DELETE)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 2. Interview Sessions (Training Data -> ANONYMIZE)
-- We keep the session but remove the user link (set equal to NULL)
ALTER TABLE public.interview_sessions
DROP CONSTRAINT IF EXISTS interview_sessions_user_id_fkey;

-- Note: user_id column must be nullable for this to work.
ALTER TABLE public.interview_sessions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.interview_sessions
ADD CONSTRAINT interview_sessions_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 3. Assessments (Training Data -> ANONYMIZE)
-- Similar to sessions, we keep the assessment data but unlink the user.
ALTER TABLE public.assessments
DROP CONSTRAINT IF EXISTS assessments_user_id_fkey;

-- Note: user_id must be nullable
ALTER TABLE public.assessments ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.assessments
ADD CONSTRAINT assessments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- 4. User Daily Usage (Transient Data -> DELETE)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_daily_usage') THEN
        ALTER TABLE public.user_daily_usage DROP CONSTRAINT IF EXISTS user_daily_usage_user_id_fkey;
        
        ALTER TABLE public.user_daily_usage
        ADD CONSTRAINT user_daily_usage_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. User Preferences (Config Data -> DELETE)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
        ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
        
        ALTER TABLE public.user_preferences
        ADD CONSTRAINT user_preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
