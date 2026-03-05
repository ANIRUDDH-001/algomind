-- Migration: Seed model_registry + model_routing + system_config
-- Date: 2026-03-05
-- Description: Populates the database-driven AI model routing tables.
--              Data sourced from src/lib/ai/providers.ts and model-routing.ts.
--              Uses ON CONFLICT for safe re-runs.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. model_registry — Full model catalog
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.model_registry (model_id, provider, tier, rpm, tpm, rpd, context_window, is_active, is_verified, is_preview, notes) VALUES
  -- Groq chat models (tiers 1–6)
  ('llama-3.3-70b-versatile',                       'groq',   1,  26, 5000,   850,  128000, true,  true,  false, 'Primary chat model — fast, high quality'),
  ('llama-3.1-8b-instant',                          'groq',   2,  26, 5000, 12240,  128000, true,  true,  false, 'Lightweight fallback — very high RPD'),
  ('meta-llama/llama-4-scout-17b-16e-instruct',     'groq',   4,  26, 5000,   850,  128000, true,  true,  false, 'Llama 4 Scout — MoE 16 experts'),
  ('openai/gpt-oss-120b',                           'groq',   5,  26, 5000,   850,  200000, true,  true,  false, 'GPT-OSS 120B — deep reasoning via Groq'),
  ('openai/gpt-oss-20b',                            'groq',   6,  26, 5000,   850,  200000, true,  true,  false, 'GPT-OSS 20B — lighter variant'),
  ('moonshotai/kimi-k2-instruct-0905',              'groq',   5,  26, 5000,   850,  200000, true,  true,  false, 'Kimi K2 — strong reasoning'),
  ('openai/gpt-oss-safeguard-20b',                  'groq',  99, 100, 5000,  1000,    8192, true,  true,  false, 'Content safety filter only'),

  -- Gemini analysis models (tiers 10–12)
  ('gemini-2.5-pro',                                'gemini', 10,  13, 10000, 1275, 1000000, true,  true,  false, 'Primary analysis — best JSON quality'),
  ('gemini-1.5-pro',                                'gemini', 10,   2, 32000,   50, 2000000, true,  true,  false, 'Legacy analysis — 2M context window'),
  ('gemini-2.0-flash',                              'gemini', 11,  10, 1000000, 1500, 1000000, true, true,  false, 'Fast analysis fallback'),
  ('gemini-1.5-flash',                              'gemini', 11,  15, 1000000, 1500, 1000000, true, true,  false, 'Legacy fast analysis'),
  ('gemini-2.5-flash',                              'gemini', 12,   4, 10000,   17, 1000000, true,  true,  false, 'Newest flash variant'),

  -- Embedding model
  ('gemini-embedding-001',                          'gemini',  1, 100, 30000, 1000,       0, true,  true,  false, 'Embedding model — 768 dimensions')

ON CONFLICT (model_id) DO UPDATE SET
  provider       = EXCLUDED.provider,
  tier           = EXCLUDED.tier,
  rpm            = EXCLUDED.rpm,
  tpm            = EXCLUDED.tpm,
  rpd            = EXCLUDED.rpd,
  context_window = EXCLUDED.context_window,
  is_active      = EXCLUDED.is_active,
  notes          = EXCLUDED.notes,
  updated_at     = now();


-- ═══════════════════════════════════════════════════════════════════════
-- 2. model_routing — Use-case to model mapping (priority ordered)
--    Lower priority number = tried first
-- ═══════════════════════════════════════════════════════════════════════

-- Chat routing (fast Groq models first)
INSERT INTO public.model_routing (model_id, provider, use_case, priority, is_active, notes) VALUES
  ('llama-3.3-70b-versatile',                   'groq',   'chat', 10, true, 'Primary chat — Llama 3.3 70B'),
  ('llama-3.1-8b-instant',                      'groq',   'chat', 20, true, 'Fallback chat — Llama 3.1 8B'),
  ('meta-llama/llama-4-scout-17b-16e-instruct', 'groq',   'chat', 30, true, 'Fallback chat — Llama 4 Scout'),
  ('moonshotai/kimi-k2-instruct-0905',          'groq',   'chat', 40, true, 'Fallback chat — Kimi K2'),
  ('openai/gpt-oss-120b',                       'groq',   'chat', 50, true, 'Fallback chat — GPT-OSS 120B'),
  ('openai/gpt-oss-20b',                        'groq',   'chat', 60, true, 'Fallback chat — GPT-OSS 20B')
ON CONFLICT DO NOTHING;

-- Analysis routing (Gemini models first — better JSON quality)
INSERT INTO public.model_routing (model_id, provider, use_case, priority, is_active, notes) VALUES
  ('gemini-2.5-pro',   'gemini', 'analysis', 10, true, 'Primary analysis — Gemini 2.5 Pro'),
  ('gemini-2.0-flash', 'gemini', 'analysis', 20, true, 'Fallback analysis — Gemini 2.0 Flash'),
  ('gemini-2.5-flash', 'gemini', 'analysis', 30, true, 'Fallback analysis — Gemini 2.5 Flash'),
  ('gemini-1.5-pro',   'gemini', 'analysis', 40, true, 'Legacy analysis — Gemini 1.5 Pro'),
  ('gemini-1.5-flash', 'gemini', 'analysis', 50, true, 'Legacy fallback — Gemini 1.5 Flash')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. system_config — Runtime system settings
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.system_config (key, value, notes) VALUES
  ('cross_tier_fallback_enabled', 'true', 'When all models for a use-case are exhausted, try the other use-case''s models as fallback')
ON CONFLICT (key) DO UPDATE SET
  value      = EXCLUDED.value,
  notes      = EXCLUDED.notes,
  updated_at = now();

COMMIT;
