-- 05_codebase_drift.sql
-- This file captures schema elements implied by recent codebase changes (e.g., Server Actions)
-- that differ from the canonical 01_schema.sql.
--
-- Findings from src/app/actions/save-session.ts:
-- 1. Uses 'title' instead of 'problem_title' in interview_sessions.
-- 2. Uses 'duration_seconds' instead of 'duration' in interview_sessions.
-- 3. Stores full assessment JSON in 'feedback' column of interview_sessions, 
--    potentially bypassing the normalized 'assessments' table.

-- Suggested migrations to align DB with active Server Action code:

-- Add columns to support save-session.ts if they don't explicitly exist
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Note: The 'assessments' table exists in 01_schema.sql but is not populated 
-- by the current saveInterviewSession action. It is populated by the 
-- client-side SupabaseProgressStore (src/lib/supabase/progress-store.ts).
-- Recommend unifying the saving logic to populate 'assessments' for consistent reporting.
