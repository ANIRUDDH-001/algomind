-- Global feature flags table (admin-controlled, server-side)
CREATE TABLE IF NOT EXISTS public.global_feature_flags (
    key         TEXT PRIMARY KEY,
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by  UUID REFERENCES auth.users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT
);

-- Seed with all current flags at their defaults
INSERT INTO public.global_feature_flags (key, is_enabled) VALUES
    ('ENABLE_VAD_INTERRUPTIONS', true),
    ('ENABLE_SMART_ROUTING', true),
    ('ENABLE_CHUNKED_RESPONSES', true),
    ('ENABLE_RESPONSE_CACHE', false),
    ('ENABLE_HINGLISH_SUPPORT', true),
    ('ENABLE_SILENT_OBSERVER', true),
    ('ENABLE_WHISPER_STT', false)
ON CONFLICT (key) DO NOTHING;

-- RLS: only admins can write, everyone can read
ALTER TABLE public.global_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read flags"
    ON public.global_feature_flags FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Only admins can modify flags"
    ON public.global_feature_flags FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'admin'
    ));
