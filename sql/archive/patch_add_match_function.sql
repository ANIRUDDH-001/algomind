-- patch_add_match_function.sql
-- Run this in Supabase SQL Editor to "future-proof" the RAG system.

-- 1. Ensure Vector Extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Define the match_knowledge_chunks function
-- This overrides any existing version due to 'OR REPLACE'
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

-- 3. Verify it exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'match_knowledge_chunks';
