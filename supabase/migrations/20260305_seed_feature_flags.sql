-- Migration: Seed global_feature_flags
-- Date: 2026-03-05
-- Description: Inserts all 15 feature flags into global_feature_flags table.
--              Matches defaults from src/lib/feature-flags.ts.
--              Uses ON CONFLICT to be safe for re-runs.

BEGIN;

INSERT INTO public.global_feature_flags (key, is_enabled, notes) VALUES
  ('ENABLE_VAD_INTERRUPTIONS',    true,  'Voice Activity Detection for natural interruptions (Silero ONNX)'),
  ('ENABLE_SMART_ROUTING',        true,  'Route simple queries to Groq, complex to Gemini'),
  ('ENABLE_CHUNKED_RESPONSES',    true,  'Stream responses sentence-by-sentence for faster TTS'),
  ('ENABLE_RESPONSE_CACHE',       false, 'In-memory response cache — disabled (not suitable for serverless)'),
  ('ENABLE_HINGLISH_SUPPORT',     true,  'Allow interviews in Hinglish (Hindi + English mix)'),
  ('ENABLE_SILENT_OBSERVER',      true,  'Show real-time coaching nudges during interview'),
  ('ENABLE_WHISPER_STT',          true,  'Groq Whisper STT — high quality server-side speech recognition'),
  ('ENABLE_AWS_BEDROCK',          false, 'AWS Bedrock AI — primary provider when ON; free providers become fallback'),
  ('ENABLE_AWS_POLLY_TTS',        false, 'AWS Polly Neural TTS (Kajal Indian English voice)'),
  ('ENABLE_GUEST_POLLY_TTS',      false, 'Allow guest users to use AWS Polly TTS in demo sessions'),
  ('ENABLE_AWS_TRANSCRIBE_STT',   false, 'AWS Transcribe for post-interview batch transcription enrichment'),
  ('ENABLE_AWS_S3_STORAGE',       false, 'AWS S3 for Transcribe audio staging only'),
  ('ENABLE_LEARN_MODE',           false, 'AI tutor mode with Hinglish support'),
  ('ENABLE_COMPARATIVE_ANALYSIS', true,  'Side-by-side performance comparison on problem retries'),
  ('ENABLE_DIFFICULTY_MODES',     true,  'Difficulty-based modes: Warm-Up, Practice, Crunch, Sprint')
ON CONFLICT (key) DO UPDATE SET
  notes = EXCLUDED.notes,
  updated_at = now();

COMMIT;
