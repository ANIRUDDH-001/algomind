-- 00_init.sql
-- Initial configuration: Extensions and Enums

-- Enable Vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension (useful if not available by default, though gen_random_uuid() is usually built-in)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- NOTE: In Supabase, auth.users is managed by the system.
-- We do not create it here, but we reference it in foreign keys.
-- ==========================================
