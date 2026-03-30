-- Migration: Add atomic session + assessment write RPC
-- Creates save_interview_session_atomic() to prevent partial writes
-- Applied: 2026-03-30

-- ============================================================================
-- 1. Atomic write function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_interview_session_atomic(
  p_user_id UUID,
  p_problem_id TEXT,
  p_problem_title TEXT,
  p_transcript JSONB,
  p_duration INTEGER DEFAULT NULL,
  p_feedback JSONB DEFAULT NULL,
  p_overall_score NUMERIC DEFAULT NULL,
  p_raw_score NUMERIC DEFAULT NULL,
  p_adjusted_score NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_difficulty_mode TEXT DEFAULT 'practice',
  p_is_candidate_session BOOLEAN DEFAULT FALSE,
  p_create_assessment BOOLEAN DEFAULT FALSE,
  p_assessment_adjusted_score NUMERIC DEFAULT NULL,
  p_assessment_overall_feedback TEXT DEFAULT NULL,
  p_assessment_next_steps TEXT[] DEFAULT NULL,
  p_assessment_skill_evidence JSONB DEFAULT NULL,
  p_assessment_hire_decision TEXT DEFAULT NULL,
  p_assessment_problem_decomposition NUMERIC DEFAULT NULL,
  p_assessment_pattern_recognition NUMERIC DEFAULT NULL,
  p_assessment_algorithmic_thinking NUMERIC DEFAULT NULL,
  p_assessment_complexity_analysis NUMERIC DEFAULT NULL,
  p_assessment_communication_clarity NUMERIC DEFAULT NULL,
  p_assessment_edge_case_awareness NUMERIC DEFAULT NULL,
  p_assessment_optimization_mindset NUMERIC DEFAULT NULL,
  p_assessment_debugging_approach NUMERIC DEFAULT NULL,
  p_assessment_model_used TEXT DEFAULT NULL,
  p_assessment_confidence NUMERIC DEFAULT NULL,
  p_assessment_validation_pass_done BOOLEAN DEFAULT NULL,
  p_assessment_code_quality JSONB DEFAULT NULL,
  p_assessment_sub_criteria JSONB DEFAULT NULL,
  p_assessment_difficulty_mode TEXT DEFAULT NULL
)
RETURNS TABLE(session_id UUID, assessment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_assessment_id UUID;
BEGIN
  -- Defense-in-depth for SECURITY DEFINER: only allow caller to write their own user_id.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized save_interview_session_atomic call';
  END IF;

  INSERT INTO public.interview_sessions (
    user_id,
    problem_id,
    problem_title,
    transcript,
    duration,
    feedback,
    overall_score,
    raw_score,
    adjusted_score,
    created_at,
    status,
    completed_at,
    is_candidate_session,
    difficulty_mode
  )
  VALUES (
    p_user_id,
    p_problem_id,
    p_problem_title,
    p_transcript,
    p_duration,
    p_feedback,
    p_overall_score,
    p_raw_score,
    p_adjusted_score,
    now(),
    p_status,
    now(),
    p_is_candidate_session,
    p_difficulty_mode
  )
  RETURNING id INTO v_session_id;

  IF p_create_assessment THEN
    INSERT INTO public.assessments (
      session_id,
      user_id,
      overall_score,
      adjusted_score,
      overall_feedback,
      next_steps,
      skill_evidence,
      hire_decision,
      problem_decomposition,
      pattern_recognition,
      algorithmic_thinking,
      complexity_analysis,
      communication_clarity,
      edge_case_awareness,
      optimization_mindset,
      debugging_approach,
      model_used,
      confidence,
      validation_pass_done,
      code_quality,
      sub_criteria,
      difficulty_mode
    )
    VALUES (
      v_session_id,
      p_user_id,
      p_overall_score,
      p_assessment_adjusted_score,
      p_assessment_overall_feedback,
      p_assessment_next_steps,
      p_assessment_skill_evidence,
      p_assessment_hire_decision,
      p_assessment_problem_decomposition,
      p_assessment_pattern_recognition,
      p_assessment_algorithmic_thinking,
      p_assessment_complexity_analysis,
      p_assessment_communication_clarity,
      p_assessment_edge_case_awareness,
      p_assessment_optimization_mindset,
      p_assessment_debugging_approach,
      p_assessment_model_used,
      p_assessment_confidence,
      p_assessment_validation_pass_done,
      p_assessment_code_quality,
      p_assessment_sub_criteria,
      p_assessment_difficulty_mode
    )
    RETURNING id INTO v_assessment_id;
  END IF;

  RETURN QUERY SELECT v_session_id, v_assessment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_interview_session_atomic(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  INTEGER,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  NUMERIC,
  TEXT,
  TEXT[],
  JSONB,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  NUMERIC,
  BOOLEAN,
  JSONB,
  JSONB,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_interview_session_atomic(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  INTEGER,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  NUMERIC,
  TEXT,
  TEXT[],
  JSONB,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  NUMERIC,
  BOOLEAN,
  JSONB,
  JSONB,
  TEXT
) TO authenticated;

-- ============================================================================
-- Rollback steps (do not execute - for reference only):
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.save_interview_session_atomic(
--   UUID,
--   TEXT,
--   TEXT,
--   JSONB,
--   INTEGER,
--   JSONB,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   TEXT,
--   TEXT,
--   BOOLEAN,
--   BOOLEAN,
--   NUMERIC,
--   TEXT,
--   TEXT[],
--   JSONB,
--   TEXT,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   NUMERIC,
--   TEXT,
--   NUMERIC,
--   BOOLEAN,
--   JSONB,
--   JSONB,
--   TEXT
-- );
