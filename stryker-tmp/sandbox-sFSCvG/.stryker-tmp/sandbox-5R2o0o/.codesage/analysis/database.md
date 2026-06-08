# Database Audit

## Schema Overview
The database uses Supabase (PostgreSQL) and contains the following core tables:

### Core Tables
1. **`profiles`** (Not fully defined in types, likely managed by Auth triggers)
2. **`admin_users`**: Manages org admins. Columns: `id`, `email`, `name`, `org_id`, `can_be_employer`.
3. **`assessment_campaigns`**: Manages cohorts for employers. Columns: `id`, `title`, `entry_code`, `problem_id`, `time_limit_mins`, `difficulty`. Relationships: Belongs to `profiles` (created_by), `problems`.
4. **`assessments`**: Stores multi-dimensional scores for a session. Columns: `id`, `session_id`, `user_id`, `overall_score`, `algorithmic_thinking`, `communication_clarity`, `problem_decomposition`, `pattern_recognition`, `debugging_approach`, `edge_case_awareness`, `hire_decision`.
5. **`candidate_submissions`**: Tracks candidate campaign progress. Columns: `id`, `campaign_id`, `candidate_id`, `overall_score`, `code_snapshot`, `integrity_flags`.
6. **`concept_states`**: Tracks user skill progression (FSRS Spaced Repetition). Columns: `id`, `user_id`, `concept_slug`, `confidence`, `fsrs_difficulty`, `fsrs_stability`, `fsrs_reps`.
7. **`concept_tags`**: Taxonomy of skills. Columns: `id`, `subject`, `display_name`, `prerequisites`.
8. **`global_feature_flags`**: Controls rollout. Columns: `key`, `is_enabled`, `updated_by`.
9. **`interview_sessions`**: The core transcript and metadata record. Columns: `id`, `user_id`, `problem_id`, `duration`, `status`, `transcript` (JSON), `audio_s3_key`, `transcribe_status`.
10. **`aws_usage_log`**: Tracks TTS/STT costs. Columns: `operation`, `service`, `bytes_processed`, `estimated_cost_usd`.

## Vector Database
The system uses `pgvector` for Retrieval-Augmented Generation.
- Likely stored in a dedicated schema or table (e.g., `vector_store`) not explicitly detailed in the public auto-generated types, but utilized via `src/lib/rag/retriever.ts`.

## RLS Policies
Row-Level Security (RLS) is strictly enforced across `assessments`, `candidate_submissions`, and `interview_sessions` to ensure candidates can only see their own data, and employers can only see their campaign candidates.
