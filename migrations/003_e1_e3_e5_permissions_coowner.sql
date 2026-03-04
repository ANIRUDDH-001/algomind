-- Migration: E1-E3+E5 — Permissions & Co-owner Unification
-- Date: 2025-01-XX
-- Plan refs: E1 (co_owners RLS), E2 (backfill user_id), E3 (auto-link triggers),
--            E5 (get_my_permissions fix + global_feature_flags RLS)

-- ============================================================
-- E1: Fix co_owners RLS — allow co-owner to read own record
-- ============================================================

DROP POLICY IF EXISTS "Owner can manage co_owners" ON public.co_owners;

-- Owner has full CRUD on co_owners
-- NOTE: is_owner() takes no args — it calls auth.uid() internally
CREATE POLICY "Owner full access to co_owners"
ON public.co_owners FOR ALL TO authenticated
USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Co-owner can read their own record (needed for isOwnerOrCoOwner check)
CREATE POLICY "Co-owner can read own record"
ON public.co_owners FOR SELECT TO authenticated
USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- ============================================================
-- E2: Backfill co_owners.user_id from auth.users by email
-- Safe to re-run: only updates rows where user_id IS NULL
-- ============================================================

UPDATE public.co_owners co SET user_id = au.id
FROM auth.users au WHERE co.email = au.email AND co.user_id IS NULL;

-- ============================================================
-- E3: Auto-link triggers
-- Trigger 1: On co_owners INSERT, link user_id from auth.users
-- Trigger 2: On profiles INSERT (signup), backfill co_owners
-- ============================================================

-- Trigger 1: auto-link user_id when co-owner is added
CREATE OR REPLACE FUNCTION public.link_co_owner_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.user_id FROM auth.users WHERE email = NEW.email LIMIT 1;
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_co_owner_user_id ON public.co_owners;
CREATE TRIGGER trg_link_co_owner_user_id BEFORE INSERT ON public.co_owners
FOR EACH ROW EXECUTE FUNCTION public.link_co_owner_user_id();

-- Trigger 2: auto-link when new user signs up (if they're a pre-registered co-owner)
CREATE OR REPLACE FUNCTION public.link_profile_to_co_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    UPDATE public.co_owners SET user_id = NEW.id
    WHERE email = NEW.email AND user_id IS NULL;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_link_profile_to_co_owner ON public.profiles;
CREATE TRIGGER trg_link_profile_to_co_owner AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_co_owner();

-- ============================================================
-- E5a: Fix get_my_permissions() — check both user_id and email
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(
    is_owner boolean,
    is_co_owner boolean,
    is_admin boolean,
    is_employer boolean,
    account_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_email TEXT;
    v_type  TEXT;
    v_uid   UUID;
BEGIN
    v_uid := auth.uid();
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    SELECT p.account_type INTO v_type FROM public.profiles p WHERE p.id = v_uid;

    RETURN QUERY SELECT
        (v_type = 'owner'),
        EXISTS(
            SELECT 1 FROM public.co_owners
            WHERE (user_id = v_uid)
               OR (user_id IS NULL AND email = v_email)
        ),
        (v_type IN ('admin', 'owner')),
        (v_type IN ('employer', 'admin', 'owner')),
        v_type;
END;
$$;

-- ============================================================
-- E5b: Fix global_feature_flags RLS — use check_is_admin()
-- ============================================================

DROP POLICY IF EXISTS "Admins and owners modify flags" ON public.global_feature_flags;
CREATE POLICY "Admins and owners modify flags"
ON public.global_feature_flags FOR ALL TO authenticated
USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
