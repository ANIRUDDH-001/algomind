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
