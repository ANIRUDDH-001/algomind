-- Create is_admin() function used by useAdmin hook
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = auth.email()
  );
$$;

-- Grant to all authenticated users (RLS handles the actual data access)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Recreate admin_users table with the correct schema to fix POST/GET API errors
DROP TABLE IF EXISTS public.admin_users CASCADE;

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by TEXT DEFAULT 'system'
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to run the is_admin() check
-- The function itself is security definer so it can read the table
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
CREATE POLICY "admin_users_select" 
  ON public.admin_users FOR SELECT
  USING (true);

-- Seed the admin
INSERT INTO public.admin_users (email) 
VALUES ('aniruddhvijay2k7@gmail.com')
ON CONFLICT (email) DO NOTHING;
