-- Add employer account support columns to profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'candidate' 
    CHECK (account_type IN ('candidate', 'employer', 'admin')),
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS campaigns_created INTEGER DEFAULT 0;
