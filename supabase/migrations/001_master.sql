-- AlgoMind Master Migration v1
-- Run this in Supabase Dashboard → SQL Editor
-- Also run: INSERT INTO model_registry ... (SQL-03)

-- ==========================================
-- 1. TABLES & EXTENSIONS
-- ==========================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create ai_models table
CREATE TABLE IF NOT EXISTS public.ai_models (
    id text PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL,
    max_tokens integer DEFAULT 4096,
    input_price_per_k numeric,
    output_price_per_k numeric,
    capabilities text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create model_performance_logs table
CREATE TABLE IF NOT EXISTS public.model_performance_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id text REFERENCES public.ai_models(id),
    provider text NOT NULL,
    latency_ms integer NOT NULL,
    tokens_used integer,
    cost numeric,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);

-- Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
    role text NOT NULL CHECK (role IN ('student', 'employer', 'admin')),
    created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 2. INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_model_logs_model_id ON public.model_performance_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_model_logs_created_at ON public.model_performance_logs(created_at);

-- ==========================================
-- 3. FUNCTIONS & RPCs
-- ==========================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.user_id = $1 AND role = 'admin'
    ) INTO is_admin;
    RETURN is_admin;
END;
$$;

-- Function to check rate limit (bypass for admins)
CREATE OR REPLACE FUNCTION public.check_user_rate_limit(p_user_id uuid, p_limit integer)
RETURNS TABLE(allowed boolean, remaining integer, is_admin_user boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
    v_usage integer;
BEGIN
    -- 1. Check if user is admin FIRST
    v_is_admin := public.check_is_admin(p_user_id);
    
    IF v_is_admin THEN
        -- Admins bypass limits completely
        RETURN QUERY SELECT true, p_limit, true;
        RETURN;
    END IF;

    -- 2. Normal user logic
    SELECT questions_used INTO v_usage 
    FROM public.daily_usage 
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    IF v_usage IS NULL THEN
        -- First question today
        RETURN QUERY SELECT true, p_limit, false;
    ELSE
        RETURN QUERY SELECT (v_usage < p_limit), GREATEST(0, p_limit - v_usage), false;
    END IF;
END;
$$;

-- Function to record user question (increment usage)
CREATE OR REPLACE FUNCTION public.record_user_question(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.daily_usage (user_id, date, questions_used, last_question_at)
    VALUES (p_user_id, CURRENT_DATE, 1, NOW())
    ON CONFLICT (user_id, date) DO UPDATE 
    SET questions_used = public.daily_usage.questions_used + 1,
        last_question_at = NOW();
END;
$$;

-- Function to get system health stats
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    active_users integer;
    total_interviews integer;
    avg_score numeric;
BEGIN
    -- Require admin
    IF NOT public.check_is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT count(DISTINCT user_id) INTO active_users 
    FROM interview_sessions 
    WHERE created_at > now() - interval '24 hours';

    SELECT count(*) INTO total_interviews FROM interview_sessions;
    
    SELECT avg(overall_score) INTO avg_score FROM interview_sessions WHERE status = 'completed';

    result := json_build_object(
        'active_users_24h', active_users,
        'total_interviews', total_interviews,
        'average_score', avg_score,
        'status', 'healthy'
    );
    
    RETURN result;
END;
$$;
