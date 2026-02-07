-- ============================================
-- ADMIN RLS CLEANUP & FIX
-- Run this in Supabase SQL Editor
-- This removes duplicate policies and standardizes on is_admin() function
-- ============================================

-- Step 1: Create/update the is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Replace with YOUR actual admin email(s)
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = user_id 
    AND email IN (
      'your-email@gmail.com',     -- ← REPLACE WITH YOUR EMAIL
      'admin@algomind.com'        -- ← ADD OTHER ADMIN EMAILS
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- KNOWLEDGE_CHUNKS - Clean up duplicates
-- ============================================
DROP POLICY IF EXISTS "Admins can manage chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Admins can manage knowledge" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Admins can view all chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Anyone can view active knowledge" ON public.knowledge_chunks;

-- Create clean policies
CREATE POLICY "Admins can view all chunks"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR status = 'active');

CREATE POLICY "Admins can manage chunks"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================
-- KNOWLEDGE_GAPS - Clean up duplicates
-- ============================================
DROP POLICY IF EXISTS "Admins can manage gaps" ON public.knowledge_gaps;
DROP POLICY IF EXISTS "Admins can update gaps" ON public.knowledge_gaps;
DROP POLICY IF EXISTS "Admins can view all gaps" ON public.knowledge_gaps;
DROP POLICY IF EXISTS "Admins can view gaps" ON public.knowledge_gaps;
DROP POLICY IF EXISTS "System can insert gaps" ON public.knowledge_gaps;

-- Create clean policies
CREATE POLICY "Admins can view all gaps"
  ON public.knowledge_gaps FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage gaps"
  ON public.knowledge_gaps FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert gaps"
  ON public.knowledge_gaps FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- KNOWLEDGE_SUGGESTIONS - Clean up duplicates
-- ============================================
DROP POLICY IF EXISTS "Admins can manage suggestions" ON public.knowledge_suggestions;
DROP POLICY IF EXISTS "Admins can view suggestions" ON public.knowledge_suggestions;
DROP POLICY IF EXISTS "Anyone can create suggestions" ON public.knowledge_suggestions;
DROP POLICY IF EXISTS "System can create suggestions" ON public.knowledge_suggestions;

-- Create clean policies
CREATE POLICY "Admins can manage suggestions"
  ON public.knowledge_suggestions FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can create suggestions"
  ON public.knowledge_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Verify the cleanup
-- ============================================
SELECT 'RLS policies cleaned up! ✅' as status;

-- View current policies to confirm:
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('knowledge_chunks', 'knowledge_gaps', 'knowledge_suggestions')
ORDER BY tablename, policyname;
