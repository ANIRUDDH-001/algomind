-- REMEDY 08: Database Consolidation

-- Part A: Drop dsa_knowledge
-- Safety check: ensure it's empty
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dsa_knowledge' AND table_schema = 'public') THEN
        IF (SELECT COUNT(*) FROM public.dsa_knowledge) = 0 THEN
            DROP TABLE public.dsa_knowledge;
        END IF;
    END IF;
END $$;

-- Part B: Add vector dimension constraint to knowledge_chunks (768 dimensions for gemini-embedding-001)
ALTER TABLE public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_embedding_dim_check
    CHECK (
        embedding IS NULL
        OR vector_dims(embedding) = 768
    );

-- Part C: Add missing Foreign Key to candidate_submissions.session_id
-- Clean up orphans first
UPDATE public.candidate_submissions
SET session_id = NULL
WHERE session_id IS NOT NULL
AND session_id NOT IN (SELECT id FROM public.interview_sessions);

-- Add the FK constraint
ALTER TABLE public.candidate_submissions
    ADD CONSTRAINT fk_candidate_submissions_session
    FOREIGN KEY (session_id)
    REFERENCES public.interview_sessions(id)
    ON DELETE SET NULL;

-- Part D: Sync admin sources
-- Trigger function: when admin_users is modified, sync profiles.account_type
CREATE OR REPLACE FUNCTION public.sync_admin_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Grant admin account type on insert to admin_users
        UPDATE public.profiles
        SET account_type = 'admin'
        WHERE id = (
            SELECT au.id FROM auth.users au WHERE au.email = NEW.email
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- Revoke admin on removal from admin_users (only if not an employer or owner)
        UPDATE public.profiles
        SET account_type = 'candidate'
        WHERE id = (
            SELECT au.id FROM auth.users au WHERE au.email = OLD.email
        )
        AND account_type = 'admin'; -- Don't downgrade owners or employers
    END IF;
    RETURN NEW;
END;
$$;

-- Attach trigger to admin_users
DROP TRIGGER IF EXISTS trg_sync_admin_to_profile ON public.admin_users;
CREATE TRIGGER trg_sync_admin_to_profile
    AFTER INSERT OR DELETE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_admin_to_profile();

-- Backfill existing admin_users
UPDATE public.profiles p
SET account_type = 'admin'
FROM auth.users au
INNER JOIN public.admin_users adm ON adm.email = au.email
WHERE au.id = p.id
AND p.account_type NOT IN ('owner', 'employer');
