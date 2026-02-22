-- =========================================================================
-- LIVE DATABASE PATCH
-- Purpose: Fix missing admin analytics RPC and update campaign schema
-- =========================================================================

-- 1. Create the missing get_admin_analytics RPC
CREATE OR REPLACE FUNCTION public.get_admin_analytics(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Basic analytics aggregation (can be expanded based on actual requirements)
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users WHERE created_at >= (now() - (p_days || ' days')::interval)),
    'total_sessions', (SELECT count(*) FROM public.interview_sessions WHERE created_at >= (now() - (p_days || ' days')::interval)),
    'active_models', (SELECT count(*) FROM public.model_registry WHERE is_active = true)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(integer) TO service_role;


-- 2. Update the assessment_campaigns schema
-- We must make problem_id nullable because 'pool' and 'random' mode campaigns do not have a single fixed problem_id.
ALTER TABLE public.assessment_campaigns 
  ALTER COLUMN problem_id DROP NOT NULL;

-- Add the missing columns for the new campaign modes
ALTER TABLE public.assessment_campaigns
  ADD COLUMN IF NOT EXISTS assignment_mode TEXT DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS question_pool JSONB,
  ADD COLUMN IF NOT EXISTS pool_difficulty TEXT;
