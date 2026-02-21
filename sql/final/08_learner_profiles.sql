-- 08_learner_profiles.sql
-- learner_profiles table — stores Kai's persistent memory snapshot per user

CREATE TABLE IF NOT EXISTS public.learner_profiles (
    user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    kai_memory TEXT        DEFAULT NULL,       -- AI-generated coaching memory note
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on every write
CREATE TRIGGER update_learner_profiles_updated_at
    BEFORE UPDATE ON public.learner_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: users can only read/write their own row
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON public.learner_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can write profiles"
    ON public.learner_profiles FOR ALL
    USING (true)
    WITH CHECK (true);


-- 09_insight_snapshots.sql

CREATE TABLE IF NOT EXISTS public.insight_snapshots (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    insights        JSONB       NOT NULL DEFAULT '[]',
    recommended_problems JSONB  NOT NULL DEFAULT '[]',
    recommended_tier     INTEGER NOT NULL DEFAULT 1,
    tier_reasoning       TEXT,
    sessions_snapshot    INTEGER NOT NULL DEFAULT 0,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER update_insight_snapshots_updated_at
    BEFORE UPDATE ON public.insight_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.insight_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshot"
    ON public.insight_snapshots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can write snapshots"
    ON public.insight_snapshots FOR ALL
    USING (true)
    WITH CHECK (true);
