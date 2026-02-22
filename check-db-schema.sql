-- Run these queries in your Supabase SQL Editor and copy/paste back the results

-- 1. Check existing columns in the assessment_campaigns table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'assessment_campaigns'
ORDER BY ordinal_position;

-- 2. Check for the existence of specific RPCs
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_admin_analytics', 
    'get_user_sessions_with_assessment', 
    'check_user_rate_limit'
  );
