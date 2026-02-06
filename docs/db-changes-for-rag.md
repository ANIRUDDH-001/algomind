# Database & Additional Configuration Steps

This document provides additional database changes and SQL queries if you want to extend the RAG system to use Supabase with pgvector instead of the current JSON-based vector store.

---

## Current Implementation (JSON-Based - Already Working)

The current RAG system uses **file-based JSON storage** and does NOT require any database changes. The embeddings are stored in:

```
src/data/dsa-knowledge/embeddings/embeddings.json
```

**Status:** ✅ Fully functional with 31 knowledge chunks.

---

## Optional: Supabase pgvector Setup

If you want to migrate to Supabase's pgvector for production scalability, follow these steps:

### Step 1: Enable pgvector Extension

Go to Supabase Dashboard → Database → Extensions → Enable "vector"

Or run this SQL:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Step 2: Create dsa_knowledge Table

```sql
-- Create the DSA knowledge table with vector support
CREATE TABLE IF NOT EXISTS public.dsa_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    topic VARCHAR(100) NOT NULL,
    subtopic VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    patterns TEXT[] DEFAULT '{}',
    time_complexity VARCHAR(50),
    space_complexity VARCHAR(50),
    embedding vector(768),  -- 768 dimensions for Gemini embeddings
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_dsa_knowledge_embedding 
ON public.dsa_knowledge 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for topic filtering
CREATE INDEX IF NOT EXISTS idx_dsa_knowledge_topic 
ON public.dsa_knowledge (topic);
```

### Step 3: Create Vector Search Function

```sql
-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    topic VARCHAR(100),
    subtopic VARCHAR(100),
    title VARCHAR(255),
    content TEXT,
    keywords TEXT[],
    difficulty VARCHAR(20),
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dk.id,
        dk.topic,
        dk.subtopic,
        dk.title,
        dk.content,
        dk.keywords,
        dk.difficulty,
        1 - (dk.embedding <=> query_embedding) AS similarity
    FROM public.dsa_knowledge dk
    WHERE 1 - (dk.embedding <=> query_embedding) > match_threshold
    ORDER BY dk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

### Step 4: Row Level Security (Optional)

```sql
-- Enable RLS
ALTER TABLE public.dsa_knowledge ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to dsa_knowledge" 
ON public.dsa_knowledge 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert/update only for service role
CREATE POLICY "Allow admin modifications to dsa_knowledge" 
ON public.dsa_knowledge 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
```

### Step 5: Migrate Data from JSON to Supabase

Create a migration script `scripts/migrate-to-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import embeddings from '../src/data/dsa-knowledge/embeddings/embeddings.json';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for insert
);

async function migrate() {
    console.log(`Migrating ${embeddings.length} chunks to Supabase...`);
    
    for (const chunk of embeddings) {
        const { error } = await supabase
            .from('dsa_knowledge')
            .upsert({
                topic: chunk.topic,
                subtopic: chunk.subtopic,
                title: chunk.title,
                content: chunk.content,
                keywords: chunk.keywords,
                difficulty: chunk.difficulty,
                patterns: chunk.patterns,
                time_complexity: chunk.timeComplexity,
                space_complexity: chunk.spaceComplexity,
                embedding: chunk.embedding
            }, {
                onConflict: 'topic,subtopic'
            });
        
        if (error) {
            console.error(`Error inserting ${chunk.topic}/${chunk.subtopic}:`, error);
        } else {
            console.log(`✓ ${chunk.topic}/${chunk.subtopic}`);
        }
    }
    
    console.log('Migration complete!');
}

migrate();
```

---

## Verification Queries

After migration, verify the data:

```sql
-- Check total entries
SELECT COUNT(*) as total_entries FROM public.dsa_knowledge;

-- Check entries with embeddings
SELECT COUNT(*) as with_embeddings 
FROM public.dsa_knowledge 
WHERE embedding IS NOT NULL;

-- View topics distribution
SELECT topic, COUNT(*) as count 
FROM public.dsa_knowledge 
GROUP BY topic 
ORDER BY count DESC;

-- Test similarity search (replace with actual embedding)
SELECT topic, subtopic, 
       1 - (embedding <=> (SELECT embedding FROM public.dsa_knowledge LIMIT 1)) as similarity
FROM public.dsa_knowledge
ORDER BY similarity DESC
LIMIT 5;
```

---

## Notes

1. **Current State:** The JSON-based vector store is fully functional and suitable for the current scale (31 chunks).

2. **When to Migrate:** Consider Supabase migration when:
   - Knowledge base exceeds 1000+ chunks
   - Need real-time updates without redeployment
   - Multiple instances need shared access
   - Need advanced filtering (e.g., by difficulty, topic)

3. **Embedding Dimensions:** The current implementation uses 768-dimensional embeddings from `gemini-embedding-001`. If you change models, update the vector(768) to match.

4. **Costs:** pgvector on Supabase is free tier compatible for small datasets.
