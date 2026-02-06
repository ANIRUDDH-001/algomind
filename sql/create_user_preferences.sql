-- Create user_preferences table for voice/TTS settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Voice preferences for Text-to-Speech
  preferred_voice_name TEXT DEFAULT 'Google US English',
  preferred_voice_lang TEXT DEFAULT 'en-US',
  voice_rate DECIMAL(3,2) DEFAULT 1.0 CHECK (voice_rate BETWEEN 0.5 AND 2.0),
  voice_pitch DECIMAL(3,2) DEFAULT 1.0 CHECK (voice_pitch BETWEEN 0.5 AND 2.0),
  
  -- UI preferences
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
  show_onboarding BOOLEAN DEFAULT true,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  practice_reminders BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Function to auto-create preferences on signup
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create preferences
DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_preferences();

-- Create preference for existing user
INSERT INTO public.user_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Verify
SELECT 'user_preferences table created successfully! ✅' as status;
SELECT COUNT(*) as existing_preferences FROM public.user_preferences;
