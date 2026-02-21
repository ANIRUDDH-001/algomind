-- 13_assessment_campaigns.sql
-- Assessment Campaigns and Candidate Submissions Schema

-- ============================================================
-- 1. TABLES
-- ============================================================

-- ASSESSMENT CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.assessment_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 100),
    problem_id TEXT NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    time_limit_mins INTEGER DEFAULT 45 CHECK (time_limit_mins >= 15 AND time_limit_mins <= 120),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    public_token UUID UNIQUE DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CANDIDATE SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.candidate_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.assessment_campaigns(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE SET NULL,
    candidate_name TEXT,
    candidate_email TEXT,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'in_progress', 'completed')),
    overall_score NUMERIC(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. ENABLE RLS
-- ============================================================
ALTER TABLE public.assessment_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. INTERVIEW CAMPAIGN POLICIES
-- ============================================================

CREATE POLICY "Employers can view their own campaigns"
  ON public.assessment_campaigns FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Employers can create campaigns"
  ON public.assessment_campaigns FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Employers can update their own campaigns"
  ON public.assessment_campaigns FOR UPDATE
  USING (auth.uid() = created_by);

-- ============================================================
-- 4. CANDIDATE SUBMISSION POLICIES
-- ============================================================

CREATE POLICY "Employers can view submissions for their campaigns"
  ON public.candidate_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_campaigns
      WHERE id = candidate_submissions.campaign_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Employers can update submissions for their campaigns"
  ON public.candidate_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_campaigns
      WHERE id = candidate_submissions.campaign_id AND created_by = auth.uid()
    )
  );
