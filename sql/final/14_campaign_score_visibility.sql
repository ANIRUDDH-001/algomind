-- Migration: 14_campaign_score_visibility.sql
-- Add show_score_to_candidate boolean config to assessment campaigns

ALTER TABLE public.assessment_campaigns 
ADD COLUMN IF NOT EXISTS show_score_to_candidate BOOLEAN DEFAULT false;



-- Migration 0-1: Add is_candidate_session column (needed for Phase 2 BUG-03 fix)
-- Run this FIRST before any code changes

ALTER TABLE interview_sessions 
ADD COLUMN IF NOT EXISTS is_candidate_session BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE interview_sessions 
ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE interview_sessions 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create index for nightly batch query performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status 
ON interview_sessions(status) 
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate 
ON interview_sessions(is_candidate_session) 
WHERE is_candidate_session = TRUE;

-- Verify columns exist
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'interview_sessions' 
AND column_name IN ('status', 'completed_at', 'is_candidate_session')
ORDER BY column_name;



-- Migration 0-2: Create atomic campaign slot claim function (needed for Phase 2 RC-01 fix)

CREATE OR REPLACE FUNCTION claim_campaign_slot(p_campaign_id UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  problem_id TEXT,
  time_limit_mins INTEGER,
  max_uses INTEGER,
  uses_count INTEGER,
  show_score_to_candidate BOOLEAN,
  created_by UUID,
  public_token TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE assessment_campaigns ac
  SET uses_count = ac.uses_count + 1
  WHERE ac.id = p_campaign_id
    AND (ac.max_uses IS NULL OR ac.uses_count < ac.max_uses)
  RETURNING 
    ac.id, ac.title, ac.description, ac.problem_id,
    ac.time_limit_mins, ac.max_uses, ac.uses_count,
    ac.show_score_to_candidate, ac.created_by,
    ac.public_token, ac.created_at;
END;
$$;

-- Verify function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'claim_campaign_slot';