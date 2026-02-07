-- 03_functions.sql
-- Stored Procedures, Triggers, and Helper Functions

-- ============================================================
-- 1. UTILITY FUNCTIONS
-- ============================================================

-- Function to update 'updated_at' column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.interview_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chunks_updated_at BEFORE UPDATE ON public.knowledge_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gaps_updated_at BEFORE UPDATE ON public.knowledge_gaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_usage_updated_at BEFORE UPDATE ON public.user_daily_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. USER MANAGEMENT
-- ============================================================

-- Auto-create profile and preferences on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create Default Preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 3. APP LOGIC
-- ============================================================

-- Simple RPC to check if current user is admin (Backend helper)
-- Relies on the is_admin function defined in 02_security.sql
-- Re-declaring for clarity if specific return type needed or separate RPC
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.is_admin(auth.uid());
END;
$$;


-- Get a random problem (optionally by difficulty)
CREATE OR REPLACE FUNCTION get_random_problem(problem_difficulty TEXT DEFAULT NULL)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  tags TEXT[],
  hints TEXT[],
  examples JSONB
) AS $$
BEGIN
  IF problem_difficulty IS NULL THEN
    RETURN QUERY
    SELECT p.id, p.title, p.description, p.difficulty, p.tags, p.hints, p.examples
    FROM public.problems p
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT p.id, p.title, p.description, p.difficulty, p.tags, p.hints, p.examples
    FROM public.problems p
    WHERE p.difficulty = problem_difficulty
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Match knowledge chunks for RAG
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_chunks.id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  FROM knowledge_chunks
  WHERE 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- Rate limiting check
CREATE OR REPLACE FUNCTION check_user_rate_limit(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, is_admin_user BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_usage INTEGER;
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin status
    v_is_admin := public.is_admin(p_user_id);
    
    IF v_is_admin THEN
        RETURN QUERY SELECT TRUE, p_limit, TRUE;
        RETURN;
    END IF;
    
    INSERT INTO user_daily_usage (user_id, date, questions_used)
    VALUES (p_user_id, CURRENT_DATE, 0)
    ON CONFLICT (user_id, date) DO NOTHING;
    
    SELECT questions_used INTO v_current_usage
    FROM user_daily_usage
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    IF v_current_usage < p_limit THEN
        RETURN QUERY SELECT TRUE, p_limit - v_current_usage, FALSE;
    ELSE
        RETURN QUERY SELECT FALSE, 0, FALSE;
    END IF;
END;
$$;

-- Record usage
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

-- Helper to get user progress (from dump, for flexibility)
CREATE OR REPLACE FUNCTION get_user_progress(target_user_id UUID, session_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  session_id UUID,
  problem_id TEXT,
  problem_difficulty TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  overall_score NUMERIC
) AS $$
BEGIN
  -- Simple version, expandable
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.problem_id,
    s.problem_difficulty,
    s.completed_at,
    s.duration,
    a.overall_score
  FROM public.interview_sessions s
  LEFT JOIN public.assessments a ON a.session_id = s.id
  WHERE s.user_id = target_user_id
    AND s.status = 'completed'
  ORDER BY s.completed_at DESC
  LIMIT session_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
