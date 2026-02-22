-- Create the missing employer_invites table

CREATE TABLE IF NOT EXISTS public.employer_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code TEXT UNIQUE NOT NULL,
    email TEXT,
    company_name TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    used_by UUID REFERENCES public.profiles(id),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Turn on row level security
ALTER TABLE public.employer_invites ENABLE ROW LEVEL SECURITY;

-- Allow select for active or authenticated users, 
-- we will use a service role key for admin route API actions, so no other strict RLS is absolutely necessary right now
CREATE POLICY "Enable read access for all users"
    ON public.employer_invites
    FOR SELECT
    USING (true);
