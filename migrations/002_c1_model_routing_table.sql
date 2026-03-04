-- Migration: C1 — model_routing table + seed data
-- Date: 2025-01-XX
-- Plan ref: C1 (Model routing table for DB-driven model selection)

-- ============================================================
-- C1: model_routing table
-- Maps models to use cases (chat / analysis) with owner-defined priorities.
-- Managed from the owner dashboard "AI Routing" tab.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.model_routing (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    model_id text NOT NULL,
    provider text NOT NULL,
    use_case text NOT NULL,
    priority integer NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    max_tokens_override integer,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    CONSTRAINT model_routing_use_case_check CHECK (use_case IN ('chat', 'analysis')),
    CONSTRAINT model_routing_unique_model_usecase UNIQUE (model_id, use_case)
);

-- RLS
ALTER TABLE public.model_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read model_routing"
ON public.model_routing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage model_routing"
ON public.model_routing FOR ALL TO authenticated
USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- Performance index
CREATE INDEX IF NOT EXISTS idx_model_routing_usecase_priority
ON public.model_routing (use_case, priority ASC) WHERE is_active = true;

-- ============================================================
-- Seed initial routing (based on current hardcoded behavior)
-- ============================================================

INSERT INTO public.model_routing (model_id, provider, use_case, priority) VALUES
    -- Chat tier: fast models, high RPM
    ('llama-3.3-70b-versatile',   'groq',   'chat',     10),
    ('llama-3.1-8b-instant',      'groq',   'chat',     20),
    ('llama-4-scout-17b',         'groq',   'chat',     30),
    ('gpt-oss-120b',              'groq',   'chat',     40),
    ('gpt-oss-20b',               'groq',   'chat',     50),
    ('kimi-k2-instruct',          'groq',   'chat',     60),
    ('gemini-2.0-flash',          'gemini', 'chat',     70),
    -- Analysis tier: intelligent models, structured JSON output
    ('gemini-2.5-pro',            'gemini', 'analysis',  10),
    ('gemini-2.5-flash',          'gemini', 'analysis',  20),
    ('gemini-2.0-flash',          'gemini', 'analysis',  30),
    ('gemini-1.5-pro',            'gemini', 'analysis',  40),
    ('llama-3.3-70b-versatile',   'groq',   'analysis',  50),
    ('gpt-oss-120b',              'groq',   'analysis',  60)
ON CONFLICT (model_id, use_case) DO NOTHING;
