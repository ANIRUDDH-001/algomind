-- AlgoMind Interview Sessions & Assessments Tables Setup
-- Run this in Supabase SQL Editor AFTER running create_problems_table.sql
-- Safe to re-run - drops and recreates policies

-- ============================================================
-- INTERVIEW SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  problem_title TEXT,
  problem_difficulty TEXT CHECK (problem_difficulty IN ('easy', 'medium', 'hard')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  transcript JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "Users can view own sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.interview_sessions;

-- RLS Policies: Users can only access their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.interview_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON public.interview_sessions(completed_at);

-- ============================================================
-- ASSESSMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Cognitive skill scores (0-10)
  problem_decomposition NUMERIC(4,2),
  pattern_recognition NUMERIC(4,2),
  algorithmic_thinking NUMERIC(4,2),
  complexity_analysis NUMERIC(4,2),
  communication_clarity NUMERIC(4,2),
  edge_case_awareness NUMERIC(4,2),
  optimization_mindset NUMERIC(4,2),
  debugging_approach NUMERIC(4,2),
  
  -- Overall assessment
  overall_score NUMERIC(4,2),
  skill_evidence JSONB DEFAULT '{}',
  overall_feedback TEXT,
  next_steps TEXT[],
  
  -- Metadata
  model_used TEXT DEFAULT 'gemini-2.0-flash',
  confidence NUMERIC(3,2) DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "Users can view own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can insert own assessments" ON public.assessments;

-- RLS Policies: Users can only access their own assessments
CREATE POLICY "Users can view own assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
  ON public.assessments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_session_id ON public.assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);

-- ============================================================
-- HELPER FUNCTION: Get user's recent progress
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_progress(target_user_id UUID, session_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  session_id UUID,
  problem_id TEXT,
  problem_difficulty TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  overall_score NUMERIC,
  problem_decomposition NUMERIC,
  pattern_recognition NUMERIC,
  algorithmic_thinking NUMERIC,
  complexity_analysis NUMERIC,
  communication_clarity NUMERIC,
  edge_case_awareness NUMERIC,
  optimization_mindset NUMERIC,
  debugging_approach NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.problem_id,
    s.problem_difficulty,
    s.completed_at,
    s.duration,
    a.overall_score,
    a.problem_decomposition,
    a.pattern_recognition,
    a.algorithmic_thinking,
    a.complexity_analysis,
    a.communication_clarity,
    a.edge_case_awareness,
    a.optimization_mindset,
    a.debugging_approach
  FROM public.interview_sessions s
  LEFT JOIN public.assessments a ON a.session_id = s.id
  WHERE s.user_id = target_user_id
    AND s.status = 'completed'
  ORDER BY s.completed_at DESC
  LIMIT session_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_progress TO authenticated;
