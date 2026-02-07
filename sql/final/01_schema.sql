-- 01_schema.sql
-- Core Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. AUTH & USERS
-- ============================================================

-- PROFILES (Public profile info)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ADMIN USERS (Access Control)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by TEXT DEFAULT 'system'
);

-- USER DAILY USAGE (Rate Limiting)
CREATE TABLE IF NOT EXISTS public.user_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- USER PREFERENCES
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Voice preferences
    preferred_voice_name TEXT DEFAULT 'Google US English',
    preferred_voice_lang TEXT DEFAULT 'en-US',
    voice_rate DECIMAL(3,2) DEFAULT 1.0 CHECK (voice_rate BETWEEN 0.5 AND 2.0),
    voice_pitch DECIMAL(3,2) DEFAULT 1.0 CHECK (voice_pitch BETWEEN 0.5 AND 2.0),
    
    -- UI preferences
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
    show_onboarding BOOLEAN DEFAULT true,
    
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT true,
    practice_reminders BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 2. CONTENT & PRACTICE
-- ============================================================

-- PROBLEMS
CREATE TABLE IF NOT EXISTS public.problems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    hints TEXT[] DEFAULT '{}',
    examples JSONB DEFAULT '[]',
    constraints TEXT,
    time_complexity TEXT,
    space_complexity TEXT,
    external_url TEXT,
    curated_lists TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INTERVIEW SESSIONS
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    problem_title TEXT,
    problem_difficulty TEXT CHECK (problem_difficulty IN ('easy', 'medium', 'hard')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    transcript JSONB,
    feedback JSONB, -- Storing assessment result directly or just overall feedback
    overall_score NUMERIC(4,2), -- Derived from assessment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cognitive skill scores (0-10)
    problem_decomposition NUMERIC(4,2),
    pattern_recognition NUMERIC(4,2),
    algorithmic_thinking NUMERIC(4,2),
    complexity_analysis NUMERIC(4,2),
    communication_clarity NUMERIC(4,2),
    edge_case_awareness NUMERIC(4,2),
    optimization_mindset NUMERIC(4,2),
    debugging_approach NUMERIC(4,2),
    
    -- Overall assessment
    overall_score NUMERIC(4,2),
    skill_evidence JSONB DEFAULT '{}',
    overall_feedback TEXT,
    next_steps TEXT[],
    
    -- Metadata
    model_used TEXT DEFAULT 'gemini-2.0-flash',
    confidence NUMERIC(3,2) DEFAULT 0.8,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 3. KNOWLEDGE & RAG
-- ============================================================

-- KNOWLEDGE CHUNKS
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    subtopic TEXT,
    content TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    difficulty TEXT DEFAULT 'medium',
    source TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'active', -- 'active', 'archived'
    usage_count INT DEFAULT 0,
    effectiveness_score FLOAT DEFAULT 0.0,
    embedding vector(3072), -- Compatible with text-embedding-3-large or Gemini
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KNOWLEDGE GAPS
CREATE TABLE IF NOT EXISTS public.knowledge_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE SET NULL,
    
    user_query TEXT NOT NULL,
    gap_reason TEXT,
    
    status TEXT DEFAULT 'new', -- 'new', 'in-progress', 'resolved', 'rejected'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    upvotes INT DEFAULT 1,
    
    best_similarity_score NUMERIC,
    
    -- Tracking resolution
    resolved_by_chunk_id UUID REFERENCES public.knowledge_chunks(id),
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON public.problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_tags ON public.problems USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_assessments_session_id ON public.assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_topic ON public.knowledge_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_user_date ON public.user_daily_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);


-- ============================================================
-- 5. VIEWS
-- ============================================================

-- USER PROGRESS VIEW
-- Aggregated stats for dashboard
CREATE OR REPLACE VIEW public.user_progress WITH (security_invoker = true) AS
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
  COALESCE(AVG(a.edge_case_awareness), 0) as avg_edge_case_awareness,
  COALESCE(AVG(a.optimization_mindset), 0) as avg_optimization_mindset,
  COALESCE(AVG(a.debugging_approach), 0) as avg_debugging_approach
FROM 
  auth.users u
  LEFT JOIN public.interview_sessions s ON u.id = s.user_id AND s.status = 'completed'
  LEFT JOIN public.assessments a ON s.id = a.session_id
WHERE u.id = auth.uid()
GROUP BY u.id;
