-- ==========================================
-- Nightly Batch & Monitoring Infrastructure
-- ==========================================

-- 1. Create model_registry table
CREATE TABLE IF NOT EXISTS public.model_registry (
    model_id text PRIMARY KEY,
    provider text NOT NULL,
    tier integer DEFAULT 1,
    rpm integer DEFAULT 0,
    tpm integer DEFAULT 0,
    rpd integer DEFAULT 0,
    context_window integer DEFAULT 8192,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    is_preview boolean DEFAULT false,
    deprecated_at timestamp with time zone,
    last_verified timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial seed for model_registry
INSERT INTO public.model_registry (model_id, provider, tier, context_window, is_active)
VALUES
    ('llama-3.3-70b-versatile', 'groq', 1, 128000, true),
    ('llama-3.1-8b-instant', 'groq', 1, 128000, true),
    ('gemma2-9b-it', 'groq', 1, 8192, true),
    ('gemini-2.0-flash', 'gemini', 1, 1000000, true),
    ('gemini-2.5-pro', 'gemini', 2, 2000000, true)
ON CONFLICT (model_id) DO NOTHING;

-- 2. Create system_events table
CREATE TABLE IF NOT EXISTS public.system_events (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    type text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    provider text,
    model_id text,
    error_code text,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id)
);

-- Index for searching events
CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON public.system_events(created_at);

-- 3. Create cleanup_old_events RPC function
CREATE OR REPLACE FUNCTION public.cleanup_old_events(days_to_keep integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.system_events
    WHERE created_at < NOW() - (days_to_keep || ' days')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
