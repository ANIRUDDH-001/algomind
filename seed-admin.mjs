import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://wfdgsmhuglmrxcmwcylz.supabase.co';
const NEW_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_NEW_ANON_KEY_HERE';

// Note: To run CREATE TABLE queries, we need the PostgreSQL connection string.
// Unfortunately, Supabase's JS Client REST API does not support raw DDL (CREATE/ALTER) directly.
// You have two options:
// 1. Run the SQL strings directly in the Supabase SQL Editor on your dashboard.
// 2. Provide the direct database connection string (e.g., postgresql://postgres.wfdg...:[YOUR-PASSWORD]@aws-0-...) 
//    so we can run it using the 'pg' or 'postgres' Node module.

console.log("Please run the following SQL script in your NEW Supabase SQL Editor to create the table:");

const sql = `
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by TEXT DEFAULT 'system'
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_users' AND policyname = 'Admin users can view admin list'
  ) THEN
    CREATE POLICY "Admin users can view admin list"
      ON public.admin_users FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.email = auth.email()));
  END IF;
END $$;

INSERT INTO public.admin_users (email) 
VALUES ('aniruddhvijay2k7@gmail.com')
ON CONFLICT (email) DO NOTHING;
`;

console.log(sql);

// Code to verify AFTER you have run the SQL:
async function main() {
  const supabase = createClient(NEW_URL, NEW_KEY);
  const { data, error } = await supabase.from('admin_users').select('email, added_at');
  if (error) {
    console.error("Verification failed (Have you run the SQL script in your dashboard yet?):", error.message);
  } else {
    console.log("Verification successful! Admin users:");
    console.table(data);
  }
}

main().catch(console.error);
