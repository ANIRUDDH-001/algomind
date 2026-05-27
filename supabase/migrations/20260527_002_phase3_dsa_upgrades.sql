-- Migration: Phase 3 DSA Learning Upgrades
-- 1. Add prerequisites to concept_tags
ALTER TABLE concept_tags ADD COLUMN prerequisites text[] DEFAULT '{}';

-- 2. Add FAANG to curated_lists for top problems
-- Assuming tags contain typical patterns, we just add FAANG to curated_lists for hard problems as a seed
UPDATE problems
SET curated_lists = array_append(COALESCE(curated_lists, '{}'::text[]), 'FAANG')
WHERE difficulty = 'Hard' OR 'dynamic-programming' = ANY(tags) OR 'graphs' = ANY(tags);

-- 3. Update types will be done in the typescript files
