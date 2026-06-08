# AlgoMind Database Migrations

## Convention
All schema changes must be documented here as .sql files before being applied.

File naming: `YYYYMMDD_NNN_description.sql`
Example: `20260316_001_co_owners_unique_email.sql`

## How to Apply
1. Review the SQL in this file
2. Run in Supabase Dashboard -> SQL Editor
3. Verify the result
4. Commit this file to git

Note: Supabase CLI requires Docker which is not currently available.
Migrations are applied manually through the dashboard SQL editor.

## Rollback Strategy
Each migration file includes a rollback comment block at the bottom.
If a migration needs to be reversed, run the rollback SQL manually.

## Migration History
| File | Applied | Notes |
|---|---|---|
| 20260316_001_co_owners_unique_email.sql | Phase 2 | Prevents duplicate co_owner emails |
| 20260316_002_missing_updated_at_triggers.sql | Phase 2 | Auto-update timestamps |
| 20260316_003_drop_redundant_entry_code_index.sql | Phase 2 | Removes duplicate index |
| 20260316_004_stuck_analysis_cron.sql | Phase 5 | Auto-flags stuck analyses |
| 20260403_001_replay_ttl_policy.sql | Phase 2 | Enforces replay expiry default and non-null TTL |
| 20260523_001_phase4_db_optimizations.sql | Phase 4 | Added CHECK constraints for score columns |
| 20260527_002_phase3_dsa_upgrades.sql | Phase 3 | Added prerequisites column to concept_tags |

## 20260523_001_phase4_db_optimizations

**Purpose:** Added CHECK constraints for score columns on `interview_sessions` and `assessments`.

**Tables affected:** `interview_sessions`, `assessments`

**Rollback:**
```sql
ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS chk_interview_session_scores;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS chk_assessment_scores;
```

---

## 20260527_002_phase3_dsa_upgrades

**Purpose:** Added `prerequisites text[]` column to `concept_tags`.

**Tables affected:** `concept_tags`

**Rollback:**
```sql
ALTER TABLE public.concept_tags DROP COLUMN IF EXISTS prerequisites;
```
