-- Migration: Cleanup dead/unused tables
-- Date: 2026-03-05
-- Description: Drops 4 confirmed dead tables that are not referenced by any codebase code.
--   - ai_models: Replaced by model_registry + model_routing (DB-driven routing)
--   - model_performance_logs: Logging table with no active writers
--   - user_daily_usage: Replaced by Redis-backed rate limiter (HACKATHON_UNLIMITED)
--   - company_profiles: 5-column stub never referenced in codebase
--
-- SAFETY: All tables verified as unreferenced via full codebase grep (March 2026).
--         Run in a transaction so any FK issues cause a full rollback.

BEGIN;

-- 1. ai_models — replaced by model_registry + model_routing
DROP TABLE IF EXISTS public.ai_models;

-- 2. model_performance_logs — no active writers
DROP TABLE IF EXISTS public.model_performance_logs;

-- 3. user_daily_usage — replaced by Redis rate limiter
DROP TABLE IF EXISTS public.user_daily_usage;

-- 4. company_profiles — unused stub
DROP TABLE IF EXISTS public.company_profiles;

COMMIT;
