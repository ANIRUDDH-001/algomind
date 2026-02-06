-- ============================================
-- AlgoMind RAG Continuous Learning System
-- Database Setup Script
-- ============================================

-- Run this ENTIRE script in Supabase SQL Editor
-- Estimated time: 2-3 minutes

-- ============================================
-- TABLE 0: admin_users (Access Control)
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by TEXT DEFAULT 'system'
);

-- Insert admin emails
INSERT INTO public.admin_users (email, name) VALUES
  ('aniruddhvijay2k7@gmail.com', 'Aniruddh'),
  ('prachi101ed@gmail.com', 'Prachi')
ON CONFLICT (email) DO NOTHING;

-- RLS for admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check admin status"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TABLE 1: knowledge_chunks
-- ============================================

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  
  -- Metadata
  source TEXT CHECK (source IN ('manual', 'auto-generated', 'conversation-mined', 'initial-seed')) DEFAULT 'manual',
  quality_score DECIMAL(3,2) DEFAULT 1.0 CHECK (quality_score BETWEEN 0 AND 1),
  usage_count INTEGER DEFAULT 0,
  effectiveness_score DECIMAL(3,2) DEFAULT 0.5 CHECK (effectiveness_score BETWEEN 0 AND 1),
  
  -- Status
  status TEXT CHECK (status IN ('active', 'pending-review', 'archived')) DEFAULT 'active',
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_chunk_id UUID REFERENCES public.knowledge_chunks(id) ON DELETE SET NULL,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Embedding storage (JSON format)
  embedding_vector JSONB,
  
  -- Additional metadata
  examples JSONB DEFAULT '[]',
  related_chunks UUID[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_topic ON public.knowledge_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_status ON public.knowledge_chunks(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_keywords ON public.knowledge_chunks USING gin(keywords);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Anyone can read active chunks
CREATE POLICY "Anyone can view active knowledge"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Only admins can manage (insert/update/delete)
CREATE POLICY "Admins can manage knowledge"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- TABLE 2: knowledge_gaps
-- ============================================

CREATE TABLE IF NOT EXISTS public.knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query TEXT NOT NULL,
  session_id UUID,
  user_id UUID REFERENCES auth.users(id),
  
  gap_reason TEXT CHECK (gap_reason IN (
    'no-relevant-chunks-found',
    'low-similarity-score',
    'user-expressed-confusion',
    'manual-flag'
  )) DEFAULT 'low-similarity-score',
  
  best_similarity_score DECIMAL(4,3),
  chunks_found INTEGER DEFAULT 0,
  chunks_retrieved TEXT[],
  
  status TEXT CHECK (status IN ('new', 'in-progress', 'resolved', 'wont-fix')) DEFAULT 'new',
  
  resolved_by_chunk_id UUID REFERENCES public.knowledge_chunks(id),
  resolution_notes TEXT,
  
  upvotes INTEGER DEFAULT 1,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  fingerprint TEXT GENERATED ALWAYS AS (lower(trim(user_query))) STORED
);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_status ON public.knowledge_gaps(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_priority ON public.knowledge_gaps(priority DESC, upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_fingerprint ON public.knowledge_gaps(fingerprint);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_created ON public.knowledge_gaps(created_at DESC);

ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view gaps"
  ON public.knowledge_gaps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can insert gaps"
  ON public.knowledge_gaps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update gaps"
  ON public.knowledge_gaps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- TABLE 3: knowledge_suggestions
-- ============================================

CREATE TABLE IF NOT EXISTS public.knowledge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  difficulty TEXT,
  
  source_type TEXT CHECK (source_type IN (
    'conversation-analysis',
    'gap-filling',
    'manual-submission',
    'external-import'
  )) DEFAULT 'manual-submission',
  source_session_id UUID,
  related_gap_id UUID REFERENCES public.knowledge_gaps(id),
  
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'needs-revision')) DEFAULT 'pending',
  
  approve_votes INTEGER DEFAULT 0,
  reject_votes INTEGER DEFAULT 0,
  
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  auto_approval_score DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_suggestions_status ON public.knowledge_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_suggestions_created ON public.knowledge_suggestions(created_at DESC);

ALTER TABLE public.knowledge_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view suggestions"
  ON public.knowledge_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Anyone can create suggestions"
  ON public.knowledge_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update suggestions"
  ON public.knowledge_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment gap upvotes (deduplication)
CREATE OR REPLACE FUNCTION increment_gap_upvotes(query_text TEXT)
RETURNS UUID AS $$
DECLARE
  gap_id UUID;
  query_fingerprint TEXT;
BEGIN
  query_fingerprint := lower(trim(query_text));
  
  SELECT id INTO gap_id
  FROM public.knowledge_gaps
  WHERE fingerprint = query_fingerprint
    AND created_at > NOW() - INTERVAL '30 days'
    AND status IN ('new', 'in-progress')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF gap_id IS NOT NULL THEN
    UPDATE public.knowledge_gaps
    SET upvotes = upvotes + 1,
        priority = CASE
          WHEN upvotes >= 10 THEN 'critical'
          WHEN upvotes >= 5 THEN 'high'
          WHEN upvotes >= 2 THEN 'medium'
          ELSE 'low'
        END
    WHERE id = gap_id;
    
    RETURN gap_id;
  ELSE
    INSERT INTO public.knowledge_gaps (user_query, gap_reason, best_similarity_score)
    VALUES (query_text, 'low-similarity-score', 0.0)
    RETURNING id INTO gap_id;
    
    RETURN gap_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION increment_gap_upvotes TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('admin_users', 'knowledge_chunks', 'knowledge_gaps', 'knowledge_suggestions');

SELECT 'Admin users:' as status;
SELECT email, name FROM public.admin_users;

SELECT '✅ Database setup complete!' as status;
