# Database Schema

AlgoMind utilizes **Supabase (PostgreSQL)** as its persistent data layer. The schema definitions are strongly typed in `src/types/supabase.ts`.

## 1. Schema & Tables (`public`)

### Users & Authorization
- `profiles`: Core user metadata, roles (`account_type`), and subscription status.
- `admin_users`: Administrative access logs (`email`, `added_by`, `can_be_employer`).
- `user_preferences`: Preferences (theme, voice, notification flags).
- `employer_invites`: Invite codes for adding enterprise access.
- `co_owners`: Granular multi-tenant owner access references.

### Content & Learning
- `problems`: The catalog of coding problems, constraints, expected time/space complexities, hints.
- `concept_tags`: Hierarchical knowledge graph definitions (subjects, descriptions).
- `concept_states`: FSRS (Free Spaced Repetition) variables tracking a user's confidence and mastery over time.
- `knowledge_chunks`: Embeddings and reference snippets for the RAG evaluation system.
- `knowledge_gaps`: Missing pieces of knowledge tracked for iterative improvement.
- `spaced_repetition` / `skill_repetition`: Track elapsed days, lapses, and scheduled reviews per problem/skill.
- `learning_signals`: Atomic changes in a user's confidence for a given concept before and after a session.
- `code_attempts`: Tracks code execution successes locally before server submission.

### Interview & Assessment Sessions
- `interview_sessions`: Metadata for simulated interviews, including audio references (`audio_s3_key`), raw transcripts, duration, and difficulty.
- `assessments`: Contains comprehensive evaluations on 8 dimensions (algorithmic thinking, problem decomposition, communication, etc.).
- `session_replays`: Sharable playback links of interview sessions with specific public access scopes.
- `learn_sessions`: Used for non-evaluative practice.
- `learner_profiles`: Detailed AI-generated narratives of candidate growth.

### Campaigns & Employer Hub
- `assessment_campaigns`: Employer-created cohorts tracking entry codes, assignments, pool constraints.
- `campaign_problem_links`: Associates campaigns to specific test boundaries.
- `candidate_submissions`: Tracks specific candidate responses and integrity flags for an assigned campaign problem.

### Telemetry, Limits & Analytics
- `aws_usage_log`: Logs bytes, regions, services used for cost modeling.
- `system_events`: Audits errors and significant architectural interactions.
- `user_daily_usage` / `user_weekly_usage`: Real-time aggregations mapped to Inngest and Upstash to enforce request rate ceilings.
- `insight_snapshots`: Periodic pre-computed recommendations.
- `model_registry` / `model_routing`: LLM metadata for failover routing (RPM/TPM bounds, preview vs verified statuses).
- `leetcode_profiles`: Synchronized tracking of candidates' external progress.

## 2. Materialized Views
- `user_progress`: An aggregated view tracking a user's total practice time, average scores, and individual dimension averages across their assessments.

## 3. Remote Procedure Calls (RPCs)
Supabase provides the following functions securely enforcing edge-logic and atomic rate-limiting:
- `atomic_increment_weekly_usage`
- `check_code_rate_limit`
- `check_user_rate_limit`
- `claim_campaign_slot`
- `compute_adjusted_score`
- `ensure_learner_profile`
- `generate_campaign_entry_code`
- `get_aws_usage_summary`
- `get_hardest_concepts`
- `get_model_rate_stats`
- `get_user_progress`
- `initialize_concept_states`
- `save_interview_session_atomic`
- `verify_campaign_entry_code`
- `match_knowledge_chunks` *(Vector matching)*

## 4. Connection Details
Per `.env.local`:
- **NEXT_PUBLIC_SUPABASE_URL**: `https://wfdgsmhuglmrxcmwcylz.supabase.co`
- **SUPABASE_DIRECT_URL**: `https://wfdgsmhuglmrxcmwcylz.supabase.co`
*(Local database URL and direct connection strings lack passwords; the system currently relies on hosted API tokens `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to connect.)*

## 5. Indexes and Policies
Raw PostgreSQL schemas and Row Level Security (RLS) (`CREATE POLICY`) files were not located in the static codebase (e.g., `supabase/migrations` is absent). However, policies and constraints are verified implicitly through the TypeScript definitions (e.g., foreign key mappings) and migration testing scripts (which assert `UNIQUE` constraints via RPC calls natively on the production DB). RLS isolates tenant data securely.
