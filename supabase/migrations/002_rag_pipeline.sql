-- Status tracking for the ingestion pipeline
ALTER TABLE public.knowledge_gaps
    ADD COLUMN IF NOT EXISTS admin_notes        TEXT,
    ADD COLUMN IF NOT EXISTS suggested_content  TEXT,
    ADD COLUMN IF NOT EXISTS suggested_title    TEXT,
    ADD COLUMN IF NOT EXISTS ai_drafted         BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by        UUID REFERENCES auth.users(id);

-- Pipeline status for knowledge_chunks
ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS source_gap_id  UUID REFERENCES public.knowledge_gaps(id),
    ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' 
        CHECK (embedding_status IN ('pending', 'processing', 'done', 'failed')),
    ADD COLUMN IF NOT EXISTS embedding_model  TEXT;

-- Index for admin queue view
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_priority_status
    ON public.knowledge_gaps (priority DESC, status, upvotes DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_status
    ON public.knowledge_chunks (embedding_status);
