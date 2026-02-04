-- AlgoMind Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable pgvector extension (for RAG vector search)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- PROFILES TABLE
-- Extends auth.users with additional fields
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INTERVIEW SESSIONS TABLE
-- Stores each interview attempt
-- ============================================
CREATE TABLE public.interview_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id TEXT NOT NULL,
  problem_title TEXT NOT NULL,
  problem_difficulty TEXT CHECK (problem_difficulty IN ('easy', 'medium', 'hard')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- seconds
  transcript JSONB, -- conversation turns
  status TEXT CHECK (status IN ('in-progress', 'completed', 'abandoned')) DEFAULT 'in-progress',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- ASSESSMENTS TABLE
-- Stores cognitive skill scores for each session
-- ============================================
CREATE TABLE public.assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- 8 cognitive skills (1-10 scale)
  problem_decomposition DECIMAL(3,1) CHECK (problem_decomposition BETWEEN 0 AND 10),
  pattern_recognition DECIMAL(3,1) CHECK (pattern_recognition BETWEEN 0 AND 10),
  algorithmic_thinking DECIMAL(3,1) CHECK (algorithmic_thinking BETWEEN 0 AND 10),
  complexity_analysis DECIMAL(3,1) CHECK (complexity_analysis BETWEEN 0 AND 10),
  communication_clarity DECIMAL(3,1) CHECK (communication_clarity BETWEEN 0 AND 10),
  edge_case_handling DECIMAL(3,1) CHECK (edge_case_handling BETWEEN 0 AND 10),
  debugging_skills DECIMAL(3,1) CHECK (debugging_skills BETWEEN 0 AND 10),
  code_quality DECIMAL(3,1) CHECK (code_quality BETWEEN 0 AND 10),
  
  overall_score DECIMAL(3,1) CHECK (overall_score BETWEEN 0 AND 10),
  
  -- Detailed feedback (JSONB for flexibility)
  skill_evidence JSONB, -- {skill: {evidence: [], strengths: [], improvements: []}}
  overall_feedback TEXT,
  next_steps TEXT[],
  
  model_used TEXT, -- which AI model generated this
  confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- DSA KNOWLEDGE BASE (for RAG)
-- Stores vectorized DSA content
-- ============================================
CREATE TABLE public.dsa_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL, -- 'arrays', 'trees', etc.
  subtopic TEXT, -- 'two-pointer', 'binary-search', etc.
  content TEXT NOT NULL,
  keywords TEXT[],
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  embedding VECTOR(768), -- for Gemini embeddings
  metadata JSONB, -- code examples, related topics, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON public.dsa_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Public read access for knowledge base
ALTER TABLE public.dsa_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge base is readable by all authenticated users"
  ON public.dsa_knowledge FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- For RAG retrieval
-- ============================================
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  topic TEXT,
  subtopic TEXT,
  content TEXT,
  keywords TEXT[],
  difficulty TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    topic,
    subtopic,
    content,
    keywords,
    difficulty,
    1 - (embedding <=> query_embedding) AS similarity
  FROM dsa_knowledge
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ============================================
-- USER PROGRESS VIEW
-- Aggregated stats for dashboard
-- ============================================
CREATE OR REPLACE VIEW public.user_progress AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT s.id) as total_sessions,
  COALESCE(AVG(a.overall_score), 0) as average_score,
  COALESCE(SUM(s.duration), 0) as total_practice_time,
  MAX(s.completed_at) as last_session_date,
  
  -- Average skill scores
  COALESCE(AVG(a.problem_decomposition), 0) as avg_problem_decomposition,
  COALESCE(AVG(a.pattern_recognition), 0) as avg_pattern_recognition,
  COALESCE(AVG(a.algorithmic_thinking), 0) as avg_algorithmic_thinking,
  COALESCE(AVG(a.complexity_analysis), 0) as avg_complexity_analysis,
  COALESCE(AVG(a.communication_clarity), 0) as avg_communication_clarity,
  COALESCE(AVG(a.edge_case_handling), 0) as avg_edge_case_handling,
  COALESCE(AVG(a.debugging_skills), 0) as avg_debugging_skills,
  COALESCE(AVG(a.code_quality), 0) as avg_code_quality
FROM 
  auth.users u
  LEFT JOIN public.interview_sessions s ON u.id = s.user_id AND s.status = 'completed'
  LEFT JOIN public.assessments a ON s.id = a.session_id
GROUP BY u.id;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX idx_sessions_status ON public.interview_sessions(status);
CREATE INDEX idx_sessions_completed ON public.interview_sessions(completed_at DESC);
CREATE INDEX idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX idx_assessments_session_id ON public.assessments(session_id);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON public.user_progress TO authenticated;
