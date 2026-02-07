-- Create knowledge_chunks table for RAG
-- Enable pgvector extension if not exists
create extension if not exists vector;

-- DROP table to ensure clean slate (fixes "embedding column empty" issues if table existed)
-- Use CASCADE to remove dependent foreign keys (e.g. from knowledge_gaps)
drop table if exists knowledge_chunks cascade;

create table if not exists knowledge_chunks (
    id uuid primary key default gen_random_uuid(),
    topic text not null,
    subtopic text,
    content text not null,
    keywords text[] default '{}',
    difficulty text default 'medium', -- 'beginner', 'intermediate', 'advanced'
    source text default 'manual',
    status text default 'active', -- 'active', 'archived'
    usage_count int default 0,
    effectiveness_score float default 0.0,
    embedding vector(3072), -- Matched to actual data (OpenAI/High-dim)
    created_at timestamptz default now()
);

-- RLS Policies
alter table knowledge_chunks enable row level security;

-- Allow read access to everyone (authenticated and anon for RAG)
create policy "Allow public read access"
    on knowledge_chunks for select
    using (true);

-- Allow write access only to admins (checked via admin_users table or similar)
-- For now, allowing all authenticated users to insert useful for testing, OR stick to service_role only
create policy "Allow admin insert"
    on knowledge_chunks for insert
    to authenticated
    with check (
        -- Simple check: email ends with algomind.ai or specific user
        -- Ideally use is_admin() function if available
        auth.email() like '%@algomind.ai' OR 
        exists (select 1 from admin_users where email = auth.email())
    );

create policy "Allow admin update"
    on knowledge_chunks for update
    to authenticated
    using (
        exists (select 1 from admin_users where email = auth.email())
    );

-- Index for vector search
-- Note: IVFFlat has a 2000 dimension limit. 
-- Since we have 3072 dimensions and only ~30 items, we don't need an index yet.
-- create index on knowledge_chunks using hnsw (embedding vector_cosine_ops);
