-- Migration: 14_campaign_score_visibility.sql
-- Add show_score_to_candidate boolean config to assessment campaigns

ALTER TABLE public.assessment_campaigns 
ADD COLUMN IF NOT EXISTS show_score_to_candidate BOOLEAN DEFAULT false;
