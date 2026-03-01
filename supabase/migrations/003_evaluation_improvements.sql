-- 1. Add sub-criteria JSONB column to assessments
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS sub_criteria jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_score numeric(4,2),
  ADD COLUMN IF NOT EXISTS adjusted_score numeric(4,2),
  ADD COLUMN IF NOT EXISTS hire_decision text
    CONSTRAINT assessments_hire_decision_check
    CHECK (hire_decision IS NULL OR hire_decision = ANY (ARRAY[
      'STRONG_HIRE','HIRE','BORDERLINE','NO_HIRE','STRONG_NO_HIRE'
    ])),
  ADD COLUMN IF NOT EXISTS code_quality jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS validation_pass_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS difficulty_mode text DEFAULT 'practice';

/*
  sub_criteria shape:
  {
    "problemDecomposition": {
      "clarifiesAmbiguity": 7,
      "identifiesSubproblems": 6,
      "definesInterfaces": 5,
      "handlesDependencyOrder": 4
    },
    ...
  }

  code_quality shape:
  {
    "score": 7,
    "correctness": "Handles all examples, fails on empty array",
    "clarity": "Good naming, minor style issues",
    "consistency": "Code matches verbal approach"
  }
*/

-- 2. Create skill_repetition table for per-skill FSRS
CREATE TABLE IF NOT EXISTS public.skill_repetition (
  id                    uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id              text NOT NULL,
  fsrs_stability        double precision DEFAULT 0   NOT NULL,
  fsrs_difficulty       double precision DEFAULT 5   NOT NULL,
  fsrs_elapsed_days     double precision DEFAULT 0   NOT NULL,
  fsrs_scheduled_days   double precision DEFAULT 0   NOT NULL,
  fsrs_reps             integer          DEFAULT 0   NOT NULL,
  fsrs_lapses           integer          DEFAULT 0   NOT NULL,
  fsrs_state            smallint         DEFAULT 0   NOT NULL,
  fsrs_last_review      timestamp with time zone,
  fsrs_due              timestamp with time zone DEFAULT now() NOT NULL,
  last_score            numeric(4,2),
  last_session_id       uuid,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT skill_repetition_skill_id_check CHECK (skill_id = ANY (ARRAY[
    'problem-decomposition','pattern-recognition','algorithmic-thinking',
    'complexity-analysis','communication-clarity','edge-case-awareness',
    'optimization-mindset','debugging-approach'
  ])),
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_repetition_user_due
  ON public.skill_repetition (user_id, fsrs_due);

ALTER TABLE public.skill_repetition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skill repetition"
  ON public.skill_repetition
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access skill_repetition"
  ON public.skill_repetition
  USING (true)
  WITH CHECK (true);

-- 3. Add structured Kai memory column to learner_profiles
ALTER TABLE public.learner_profiles
  ADD COLUMN IF NOT EXISTS kai_memory_structured jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hire_readiness_trend jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS narrative_session_1 text DEFAULT NULL;

/*
  kai_memory_structured shape:
  {
    "topStrength":        { "skill": "pattern-recognition", "evidence": "..." },
    "mainWeakness":       { "skill": "complexity-analysis", "failureMode": "..." },
    "communicationStyle": "verbose",
    "probeNextSession":   "Ask why their O(n log n) claim holds for this recursion",
    "consistencyFlags":   [],
    "lastUpdated":        "2025-01-01T00:00:00Z"
  }

  hire_readiness_trend shape (array):
  [
    { "sessionId": "uuid", "hireDecision": "HIRE", "score": 7.2, "completedAt": "..." }
  ]
*/

-- 4. Add problem-level scoring stats to problems
ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS avg_score_easy    numeric(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avg_score_medium  numeric(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avg_score_hard    numeric(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS primary_pattern   text DEFAULT NULL;

-- 5. Add global scoring percentile table
CREATE TABLE IF NOT EXISTS public.score_benchmarks (
  id           uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  difficulty   text NOT NULL CHECK (difficulty = ANY (ARRAY['easy','medium','hard'])),
  skill_id     text NOT NULL,
  p25          numeric(4,2),
  p50          numeric(4,2),
  p75          numeric(4,2),
  p90          numeric(4,2),
  sample_count integer DEFAULT 0,
  computed_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.score_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read benchmarks"
  ON public.score_benchmarks FOR SELECT USING (true);

CREATE POLICY "Service role manages benchmarks"
  ON public.score_benchmarks USING (true) WITH CHECK (true);

-- 6. Add employer-mode evaluation columns to candidate_submissions
ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS dimension_scores    jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hire_decision       text
    CHECK (hire_decision IS NULL OR hire_decision = ANY (ARRAY[
      'STRONG_HIRE','HIRE','BORDERLINE','NO_HIRE','STRONG_NO_HIRE'
    ])),
  ADD COLUMN IF NOT EXISTS integrity_flags     text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS code_snapshot       text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS adjusted_score      numeric(4,2) DEFAULT NULL;

-- 7. Update get_user_sessions_with_assessment RPC to return problem_difficulty
CREATE OR REPLACE FUNCTION public.get_user_sessions_with_assessment(
  p_user_id uuid,
  p_limit   integer DEFAULT 10
)
RETURNS TABLE (
  session_id         uuid,
  problem_id         text,
  problem_title      text,
  problem_difficulty text,
  status             text,
  overall_score      numeric,
  adjusted_score     numeric,
  hire_decision      text,
  started_at         timestamp with time zone,
  completed_at       timestamp with time zone,
  duration           integer,
  attempt_number     integer,
  difficulty_mode    text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    s.id              AS session_id,
    s.problem_id,
    s.problem_title,
    s.problem_difficulty,
    s.status,
    s.overall_score,
    a.adjusted_score,
    a.hire_decision,
    s.started_at,
    s.completed_at,
    s.duration,
    s.attempt_number,
    s.difficulty_mode
  FROM public.interview_sessions s
  LEFT JOIN public.assessments a ON a.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status   = 'completed'
  ORDER BY s.completed_at DESC
  LIMIT p_limit;
$$;

-- 8. Function: compute difficulty-adjusted score
CREATE OR REPLACE FUNCTION public.compute_adjusted_score(
  p_raw_score numeric,
  p_difficulty text
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  multiplier numeric;
BEGIN
  multiplier := CASE p_difficulty
    WHEN 'easy'   THEN 1.00
    WHEN 'medium' THEN 1.15
    WHEN 'hard'   THEN 1.30
    ELSE 1.00
  END;
  RETURN LEAST(ROUND(p_raw_score * multiplier, 2), 10.00);
END;
$$;

-- 9. updated_at triggers for new tables
CREATE TRIGGER update_skill_repetition_updated_at
  BEFORE UPDATE ON public.skill_repetition
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
