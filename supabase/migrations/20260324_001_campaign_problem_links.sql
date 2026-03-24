-- Migration: Normalize campaign questions into relational table
-- Creates campaign_problem_links table for N:M relationship between campaigns and problems
-- Migrates data from campaign_questions JSON blob
-- Applied: 2026-03-24
-- Author: Aniruddh Vijayvargia

-- ============================================================================
-- 1. Create campaign_problem_links table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_problem_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  problem_id TEXT NOT NULL,
  time_limit_min INTEGER NOT NULL DEFAULT 30,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign key constraints
  CONSTRAINT fk_campaign_problem_links_campaign_id 
    FOREIGN KEY (campaign_id) 
    REFERENCES public.assessment_campaigns(id) 
    ON DELETE CASCADE,
  
  CONSTRAINT fk_campaign_problem_links_problem_id 
    FOREIGN KEY (problem_id) 
    REFERENCES public.problems(id) 
    ON DELETE RESTRICT,
  
  -- Uniqueness constraints
  CONSTRAINT uq_campaign_problem_links_campaign_id_problem_id 
    UNIQUE (campaign_id, problem_id),
  
  CONSTRAINT uq_campaign_problem_links_campaign_id_order_index 
    UNIQUE (campaign_id, order_index)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_campaign_problem_links_campaign_id 
  ON public.campaign_problem_links(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_problem_links_problem_id 
  ON public.campaign_problem_links(problem_id);

-- ============================================================================
-- 2. Enable Row-Level Security
-- ============================================================================

ALTER TABLE public.campaign_problem_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

-- SELECT: authenticated users can read links where:
--   - campaign's created_by = auth.uid(), OR
--   - they have a candidate_submission in the campaign
DROP POLICY IF EXISTS "Users can read campaign_problem_links for their campaigns or as candidates" 
  ON public.campaign_problem_links;

CREATE POLICY "Users can read campaign_problem_links for their campaigns or as candidates" 
  ON public.campaign_problem_links 
  FOR SELECT 
  TO authenticated 
  USING (
    campaign_id IN (
      SELECT id FROM public.assessment_campaigns 
      WHERE created_by = auth.uid()
    )
    OR 
    campaign_id IN (
      SELECT campaign_id FROM public.candidate_submissions 
      WHERE candidate_id = auth.uid()
    )
  );

-- INSERT: only where campaign's created_by = auth.uid() or user is admin
DROP POLICY IF EXISTS "Users can insert campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links;

CREATE POLICY "Users can insert campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.assessment_campaigns 
      WHERE created_by = auth.uid()
    )
    OR 
    public.check_is_admin()
  );

-- UPDATE: only where campaign's created_by = auth.uid() or user is admin
DROP POLICY IF EXISTS "Users can update campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links;

CREATE POLICY "Users can update campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links 
  FOR UPDATE 
  TO authenticated 
  USING (
    campaign_id IN (
      SELECT id FROM public.assessment_campaigns 
      WHERE created_by = auth.uid()
    )
    OR 
    public.check_is_admin()
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.assessment_campaigns 
      WHERE created_by = auth.uid()
    )
    OR 
    public.check_is_admin()
  );

-- DELETE: only where campaign's created_by = auth.uid() or user is admin
DROP POLICY IF EXISTS "Users can delete campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links;

CREATE POLICY "Users can delete campaign_problem_links for their campaigns" 
  ON public.campaign_problem_links 
  FOR DELETE 
  TO authenticated 
  USING (
    campaign_id IN (
      SELECT id FROM public.assessment_campaigns 
      WHERE created_by = auth.uid()
    )
    OR 
    public.check_is_admin()
  );

-- ============================================================================
-- 4. Data Migration: Extract campaign_questions JSON and insert into table
-- ============================================================================

-- Migrate existing data from campaign_questions JSON array
-- For each campaign with campaign_questions, INSERT rows into campaign_problem_links
INSERT INTO public.campaign_problem_links (
  campaign_id,
  problem_id,
  time_limit_min,
  order_index,
  created_at
)
SELECT
  ac.id,
  (q->>'problem_id')::TEXT,
  COALESCE((q->>'time_limit_mins')::INTEGER, 30),
  COALESCE((q->>'order')::INTEGER, 0),
  ac.created_at
FROM public.assessment_campaigns ac,
     jsonb_array_elements(ac.campaign_questions) WITH ORDINALITY AS q(q)
WHERE ac.campaign_questions IS NOT NULL
  AND jsonb_array_length(ac.campaign_questions) > 0
ON CONFLICT (campaign_id, problem_id) DO NOTHING;

-- ============================================================================
-- 5. Verify migration
-- ============================================================================

-- After migration, verify counts match
-- SELECT 
--   COUNT(*) as total_campaigns,
--   COUNT(CASE WHEN campaign_questions IS NOT NULL THEN 1 END) as campaigns_with_questions,
--   (SELECT COUNT(*) FROM public.campaign_problem_links) as migrated_links
-- FROM public.assessment_campaigns;

-- ============================================================================
-- Rollback steps (do not execute - for reference only):
-- ============================================================================
-- DROP POLICY IF EXISTS "Users can read campaign_problem_links for their campaigns or as candidates" 
--   ON public.campaign_problem_links;
-- DROP POLICY IF EXISTS "Users can insert campaign_problem_links for their campaigns" 
--   ON public.campaign_problem_links;
-- DROP POLICY IF EXISTS "Users can update campaign_problem_links for their campaigns" 
--   ON public.campaign_problem_links;
-- DROP POLICY IF EXISTS "Users can delete campaign_problem_links for their campaigns" 
--   ON public.campaign_problem_links;
-- DROP INDEX IF EXISTS idx_campaign_problem_links_campaign_id;
-- DROP INDEX IF EXISTS idx_campaign_problem_links_problem_id;
-- DROP TABLE IF EXISTS public.campaign_problem_links;
