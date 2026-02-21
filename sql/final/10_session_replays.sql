-- 10_session_replays.sql
-- session_replays table — stores public, annotated replays of interview sessions

CREATE TABLE IF NOT EXISTS public.session_replays (
    session_id      UUID        PRIMARY KEY REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    public_token    TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
    annotations     JSONB       NOT NULL DEFAULT '[]', -- Array of { timestamp_seconds: number, text: string, type: 'good'|'missed'|'info' }
    is_public       BOOLEAN     NOT NULL DEFAULT true,
    view_count      INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast public link lookups
CREATE INDEX IF NOT EXISTS idx_session_replays_token ON public.session_replays(public_token);

-- Auto-update updated_at on every write
CREATE TRIGGER update_session_replays_updated_at
    BEFORE UPDATE ON public.session_replays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.session_replays ENABLE ROW LEVEL SECURITY;

-- Anyone can view a replay if they have the public token
CREATE POLICY "Anyone can view public replays"
    ON public.session_replays FOR SELECT
    USING (is_public = true);

-- Owners can view their own replays
CREATE POLICY "Users can view own replays"
    ON public.session_replays FOR SELECT
    USING (auth.uid() = user_id);

-- Owners can create/update their own replays
CREATE POLICY "Users can insert own replays"
    ON public.session_replays FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replays"
    ON public.session_replays FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Owners can delete their own replays
CREATE POLICY "Users can delete own replays"
    ON public.session_replays FOR DELETE
    USING (auth.uid() = user_id);

-- Service role bypasses RLS
CREATE POLICY "Service role can manage replays"
    ON public.session_replays FOR ALL
    USING (true)
    WITH CHECK (true);
