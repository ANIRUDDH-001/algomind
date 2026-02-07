-- 02_security.sql
-- Row Level Security (RLS) Policies

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. HELPER FUNCTION FOR ADMIN CHECK
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = (SELECT email FROM auth.users WHERE id = user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. POLICIES
-- ============================================================

-- --- PROFILES ---
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- --- ADMIN USERS ---
-- Allowed for authenticated users to see who is admin? 
-- Or just admins? Usually admins only, but is_admin() needs to be accessible.
-- The dump had "Anyone can check admin status" -> TRUE for SELECT.
CREATE POLICY "Anyone can check admin status"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (true);

-- --- USER PREFERENCES ---
CREATE POLICY "Users view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- --- USER DAILY USAGE ---
CREATE POLICY "Users view own usage"
  ON public.user_daily_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own usage"
  ON public.user_daily_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own usage"
  ON public.user_daily_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- --- PROBLEMS ---
-- Public read access
CREATE POLICY "Public read access"
  ON public.problems FOR SELECT
  USING (true);

-- --- INTERVIEW SESSIONS ---
CREATE POLICY "Users view own sessions"
  ON public.interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions"
  ON public.interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- --- ASSESSMENTS ---
CREATE POLICY "Users view own assessments"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- --- KNOWLEDGE CHUNKS ---
-- Admins can view all (for management), Public can view active
CREATE POLICY "Public read active chunks"
  ON public.knowledge_chunks FOR SELECT
  USING (status = 'active' OR is_admin(auth.uid()));

CREATE POLICY "Admins manage chunks"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- --- KNOWLEDGE GAPS ---
CREATE POLICY "Admins view all gaps"
  ON public.knowledge_gaps FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins manage gaps"
  ON public.knowledge_gaps FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users suggest gaps"
  ON public.knowledge_gaps FOR INSERT
  TO authenticated
  WITH CHECK (true);
