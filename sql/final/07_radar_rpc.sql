-- 07_radar_rpc.sql
-- Function to retrieve a user's completed sessions with assessment scores

CREATE OR REPLACE FUNCTION get_user_sessions_with_assessment(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  session_id UUID,
  problem_id TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  overall_score NUMERIC,
  problem_decomposition NUMERIC,
  pattern_recognition NUMERIC,
  algorithmic_thinking NUMERIC,
  complexity_analysis NUMERIC,
  communication_clarity NUMERIC,
  edge_case_awareness NUMERIC,
  optimization_mindset NUMERIC,
  debugging_approach NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.problem_id,
    s.completed_at,
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
  JOIN public.assessments a ON a.session_id = s.id
  WHERE s.user_id = p_user_id AND s.status = 'completed'
  ORDER BY s.completed_at DESC
  LIMIT p_limit;
END;
$$;
