-- =========================================================================
-- LIVE DATABASE PATCH: Update claim_campaign_slot RPC
-- Purpose: Add assignment_mode, question_pool, and pool_difficulty to the returned table.
-- =========================================================================

-- Step 1: Drop the old function because changing the return signature requires a DROP FIRST in PostgreSQL
DROP FUNCTION IF EXISTS public.claim_campaign_slot(uuid);

-- Step 2: Recreate it with the new columns added to the RETURNS TABLE definition
CREATE OR REPLACE FUNCTION public.claim_campaign_slot(p_campaign_id uuid)
 RETURNS TABLE(
    id uuid, 
    problem_id text, 
    created_by uuid, 
    title text, 
    time_limit_mins integer, 
    max_uses integer, 
    uses_count integer, 
    show_score_to_candidate boolean,
    assignment_mode text,
    question_pool jsonb,
    pool_difficulty text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.assessment_campaigns ac
  SET uses_count = ac.uses_count + 1
  WHERE ac.id = p_campaign_id
    AND ac.is_active = true
    AND (ac.expires_at IS NULL OR ac.expires_at > NOW())
    AND (ac.max_uses IS NULL OR ac.uses_count < ac.max_uses)
  RETURNING
    ac.id,
    ac.problem_id,
    ac.created_by,
    ac.title,
    ac.time_limit_mins,
    ac.max_uses,
    ac.uses_count,
    ac.show_score_to_candidate,
    ac.assignment_mode,
    ac.question_pool,
    ac.pool_difficulty;
END;
$function$;

-- Step 3: Re-grant permissions
GRANT EXECUTE ON FUNCTION public.claim_campaign_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_slot(uuid) TO service_role;
