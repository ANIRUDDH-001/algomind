-- Migration 7-1: Backfill status for existing sessions that have feedback/scores but no status
-- Run in Supabase Dashboard SQL Editor

UPDATE interview_sessions
SET 
  status = 'completed',
  completed_at = created_at  -- Use created_at as approximation for historical sessions
WHERE 
  status IS NULL
  AND feedback IS NOT NULL
  AND is_candidate_session = FALSE;

-- Verify
SELECT 
  status,
  is_candidate_session,
  COUNT(*) as count
FROM interview_sessions
GROUP BY status, is_candidate_session
ORDER BY status, is_candidate_session;
