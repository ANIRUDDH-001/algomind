-- Phase 2 Updates: Fix Assessment History and LeetCode Connections

-- 1. Assessment Flow State Recovery
ALTER TABLE public.candidate_submissions
ADD COLUMN IF NOT EXISTS assigned_problem_id TEXT,
ADD COLUMN IF NOT EXISTS current_transcript JSONB DEFAULT '[]'::jsonb;

-- 2. Ensure user_preferences has the leetcode columns
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS leetcode_username TEXT,
ADD COLUMN IF NOT EXISTS leetcode_fetch_status TEXT;

-- 3. Ensure leetcode_profiles exists
CREATE TABLE IF NOT EXISTS public.leetcode_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    last_fetched TIMESTAMP WITH TIME ZONE,
    solved_easy INTEGER,
    solved_medium INTEGER,
    solved_hard INTEGER,
    total_solved INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- We don't need to change claim_campaign_slot. Instead, we'll change the Next.js API 
-- to only call this RPC if the user is starting a brand new session, avoiding double counting.
