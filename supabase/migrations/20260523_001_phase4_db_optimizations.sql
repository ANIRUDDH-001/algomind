-- Migration: Phase 4 Database & Security Optimizations
-- Applies JWT-based RLS policies, JSONB archival indexing, and CHECK constraints
-- Applied: 2026-05-23

-- ============================================================================
-- 1. CHECK Constraints
-- ============================================================================

-- Ensure scores are within valid ranges (0 to 10 or 0 to 100 depending on scale, assuming 0-100 for overall, 0-10 for sub-criteria)
ALTER TABLE public.interview_sessions
  ADD CONSTRAINT chk_interview_sessions_scores 
  CHECK (
    (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)) AND
    (raw_score IS NULL OR (raw_score >= 0 AND raw_score <= 100)) AND
    (adjusted_score IS NULL OR (adjusted_score >= 0 AND adjusted_score <= 100))
  );

ALTER TABLE public.interview_sessions
  ADD CONSTRAINT chk_interview_sessions_status
  CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned'));

ALTER TABLE public.assessments
  ADD CONSTRAINT chk_assessments_scores
  CHECK (
    (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)) AND
    (adjusted_score IS NULL OR (adjusted_score >= 0 AND adjusted_score <= 100)) AND
    (problem_decomposition IS NULL OR (problem_decomposition >= 0 AND problem_decomposition <= 10)) AND
    (pattern_recognition IS NULL OR (pattern_recognition >= 0 AND pattern_recognition <= 10)) AND
    (algorithmic_thinking IS NULL OR (algorithmic_thinking >= 0 AND algorithmic_thinking <= 10)) AND
    (complexity_analysis IS NULL OR (complexity_analysis >= 0 AND complexity_analysis <= 10)) AND
    (communication_clarity IS NULL OR (communication_clarity >= 0 AND communication_clarity <= 10)) AND
    (edge_case_awareness IS NULL OR (edge_case_awareness >= 0 AND edge_case_awareness <= 10)) AND
    (optimization_mindset IS NULL OR (optimization_mindset >= 0 AND optimization_mindset <= 10)) AND
    (debugging_approach IS NULL OR (debugging_approach >= 0 AND debugging_approach <= 10))
  );

-- ============================================================================
-- 2. JSONB Transcript Archival Indexing
-- ============================================================================

-- Add a GIN index on the transcript JSONB column to optimize queries searching for specific AI/User interactions
CREATE INDEX IF NOT EXISTS idx_interview_sessions_transcript_gin ON public.interview_sessions USING GIN (transcript);
CREATE INDEX IF NOT EXISTS idx_assessments_skill_evidence_gin ON public.assessments USING GIN (skill_evidence);
CREATE INDEX IF NOT EXISTS idx_assessments_sub_criteria_gin ON public.assessments USING GIN (sub_criteria);

-- ============================================================================
-- 3. JWT-based Row Level Security (RLS) Enforcement
-- ============================================================================

-- Enable RLS on core tables if not already enabled
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own interview sessions
DROP POLICY IF EXISTS "Users can view their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can view their own interview sessions"
  ON public.interview_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only update their own interview sessions
DROP POLICY IF EXISTS "Users can update their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can update their own interview sessions"
  ON public.interview_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can only delete their own interview sessions
DROP POLICY IF EXISTS "Users can delete their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can delete their own interview sessions"
  ON public.interview_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can only select their own assessments
DROP POLICY IF EXISTS "Users can view their own assessments" ON public.assessments;
CREATE POLICY "Users can view their own assessments"
  ON public.assessments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only update their own assessments
DROP POLICY IF EXISTS "Users can update their own assessments" ON public.assessments;
CREATE POLICY "Users can update their own assessments"
  ON public.assessments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can only delete their own assessments
DROP POLICY IF EXISTS "Users can delete their own assessments" ON public.assessments;
CREATE POLICY "Users can delete their own assessments"
  ON public.assessments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: Insert policies are typically handled by SECURITY DEFINER RPCs (like save_interview_session_atomic)
-- But we can add a fallback insert policy just in case:
DROP POLICY IF EXISTS "Users can insert their own interview sessions" ON public.interview_sessions;
CREATE POLICY "Users can insert their own interview sessions"
  ON public.interview_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own assessments" ON public.assessments;
CREATE POLICY "Users can insert their own assessments"
  ON public.assessments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

