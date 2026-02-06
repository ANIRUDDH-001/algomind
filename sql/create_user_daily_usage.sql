-- User Daily Usage Table for Rate Limiting
-- Run this in Supabase SQL Editor

-- Create user_daily_usage table
CREATE TABLE IF NOT EXISTS user_daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE user_daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read own usage"
ON user_daily_usage FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert own usage"
ON user_daily_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update own usage"
ON user_daily_usage FOR UPDATE
USING (auth.uid() = user_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_user_daily_usage_updated_at ON user_daily_usage;
CREATE TRIGGER update_user_daily_usage_updated_at
    BEFORE UPDATE ON user_daily_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_user_id ON user_daily_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_date ON user_daily_usage(date);
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_user_date ON user_daily_usage(user_id, date);

-- Helper function to check and increment daily usage
-- Renamed to match TypeScript call: check_user_rate_limit
CREATE OR REPLACE FUNCTION check_user_rate_limit(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, is_admin BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_usage INTEGER;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT EXISTS(
        SELECT 1 FROM admin_users WHERE email = (
            SELECT email FROM auth.users WHERE id = p_user_id
        )
    ) INTO v_is_admin;
    
    -- Admins bypass rate limits
    IF v_is_admin THEN
        RETURN QUERY SELECT TRUE, p_limit, TRUE;
        RETURN;
    END IF;
    
    -- Get or create today's usage record
    INSERT INTO user_daily_usage (user_id, date, questions_used)
    VALUES (p_user_id, CURRENT_DATE, 0)
    ON CONFLICT (user_id, date) DO NOTHING;
    
    -- Get current usage
    SELECT questions_used INTO v_current_usage
    FROM user_daily_usage
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    -- Check if under limit
    IF v_current_usage < p_limit THEN
        RETURN QUERY SELECT TRUE, p_limit - v_current_usage, FALSE;
    ELSE
        RETURN QUERY SELECT FALSE, 0, FALSE;
    END IF;
END;
$$;

-- Function to record a question
-- Renamed to match TypeScript call: record_user_question
CREATE OR REPLACE FUNCTION record_user_question(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_daily_usage (user_id, date, questions_used)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET questions_used = user_daily_usage.questions_used + 1;
END;
$$;

-- Simple RPC to check if current user is admin
-- Drop first to avoid return type conflicts if it changed
DROP FUNCTION IF EXISTS is_admin();
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
END;
$$;

COMMENT ON TABLE user_daily_usage IS 'Tracks daily question usage for rate limiting (5 questions/day per user)';
COMMENT ON FUNCTION check_user_rate_limit(UUID, INTEGER) IS 'Checks if user can ask more questions today, admins are exempt';
COMMENT ON FUNCTION record_user_question(UUID) IS 'Records a question usage for the user';
COMMENT ON FUNCTION is_admin() IS 'Checks if the calling user is an admin';
