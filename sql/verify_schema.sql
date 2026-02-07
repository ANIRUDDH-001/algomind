-- verify_schema.sql
-- Run this in Supabase SQL Editor to verify the current schema state matches documentation expectations.

SELECT 
    table_name, 
    count(column_name) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN (
    'problems', 
    'interview_sessions', 
    'assessments', 
    'knowledge_chunks', 
    'knowledge_gaps', 
    'admin_users', 
    'user_daily_usage', 
    'user_preferences',
    'profiles'
)
GROUP BY table_name
ORDER BY table_name;

-- Expected Output (approximate based on sql/final/01_schema.sql):
-- admin_users: 5 columns
-- assessments: 14 columns
-- interview_sessions: 12 columns
-- knowledge_chunks: 13 columns
-- knowledge_gaps: 11 columns
-- problems: 12 columns
-- profiles: 5 columns
-- user_daily_usage: 6 columns
-- user_preferences: 9 columns

-- Check for existence of critical functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'handle_new_user', 
    'check_user_rate_limit', 
    'get_random_problem',
    'match_knowledge_chunks',
    'is_admin'
);
