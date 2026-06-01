/**
 * @codesage
 * @file      src/types/supabase.ts
 * @purpose   Auto-generated TypeScript definitions for the Supabase Postgres database schema.
 * @summary   This file contains comprehensive type definitions for all tables, views, and procedures in the Supabase database. It dictates the shapes of Row, Insert, and Update objects for the entire application, serving as the source of truth for the database schema in TypeScript.
 * @tech      TypeScript, Supabase
 * @connects  Used globally by any file querying or mutating data via the Supabase client.
 * @apis      none
 * @db        All tables in the public schema
 * @state     none
 * @env       none
 * @issues    Auto-generated file; no manual dead code removal performed.
 * @audit     CODESAGE-v1
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          added_at: string | null
          added_by: string | null
          can_be_employer: boolean | null
          email: string
          id: string
          name: string | null
          org_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          can_be_employer?: boolean | null
          email: string
          id?: string
          name?: string | null
          org_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          can_be_employer?: boolean | null
          email?: string
          id?: string
          name?: string | null
          org_id?: string | null
        }
        Relationships: []
      }
      assessment_campaigns: {
        Row: {
          assignment_mode: string | null
          campaign_questions: Json | null
          created_at: string | null
          created_by: string
          default_easy_mins: number | null
          default_hard_mins: number | null
          default_medium_mins: number | null
          difficulty: string | null
          entry_code: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_turns: number | null
          max_uses: number | null
          pool_difficulty: string | null
          problem_id: string | null
          public_token: string | null
          question_pool: Json | null
          show_score_to_candidate: boolean | null
          time_limit_mins: number | null
          title: string
          updated_at: string | null
          uses_count: number | null
        }
        Insert: {
          assignment_mode?: string | null
          campaign_questions?: Json | null
          created_at?: string | null
          created_by: string
          default_easy_mins?: number | null
          default_hard_mins?: number | null
          default_medium_mins?: number | null
          difficulty?: string | null
          entry_code: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_turns?: number | null
          max_uses?: number | null
          pool_difficulty?: string | null
          problem_id?: string | null
          public_token?: string | null
          question_pool?: Json | null
          show_score_to_candidate?: boolean | null
          time_limit_mins?: number | null
          title: string
          updated_at?: string | null
          uses_count?: number | null
        }
        Update: {
          assignment_mode?: string | null
          campaign_questions?: Json | null
          created_at?: string | null
          created_by?: string
          default_easy_mins?: number | null
          default_hard_mins?: number | null
          default_medium_mins?: number | null
          difficulty?: string | null
          entry_code?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_turns?: number | null
          max_uses?: number | null
          pool_difficulty?: string | null
          problem_id?: string | null
          public_token?: string | null
          question_pool?: Json | null
          show_score_to_candidate?: boolean | null
          time_limit_mins?: number | null
          title?: string
          updated_at?: string | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_campaigns_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          adjusted_score: number | null
          advanced_analysis: Json | null
          algorithmic_thinking: number | null
          code_quality: Json | null
          communication_clarity: number | null
          complexity_analysis: number | null
          confidence: number | null
          created_at: string | null
          debugging_approach: number | null
          difficulty_mode: string | null
          edge_case_awareness: number | null
          hire_decision: string | null
          id: string
          model_used: string | null
          next_steps: string[] | null
          optimization_mindset: number | null
          overall_feedback: string | null
          overall_score: number | null
          pattern_recognition: number | null
          problem_decomposition: number | null
          raw_score: number | null
          session_id: string
          skill_evidence: Json | null
          sub_criteria: Json | null
          updated_at: string | null
          user_id: string | null
          validation_pass_done: boolean | null
        }
        Insert: {
          adjusted_score?: number | null
          advanced_analysis?: Json | null
          algorithmic_thinking?: number | null
          code_quality?: Json | null
          communication_clarity?: number | null
          complexity_analysis?: number | null
          confidence?: number | null
          created_at?: string | null
          debugging_approach?: number | null
          difficulty_mode?: string | null
          edge_case_awareness?: number | null
          hire_decision?: string | null
          id?: string
          model_used?: string | null
          next_steps?: string[] | null
          optimization_mindset?: number | null
          overall_feedback?: string | null
          overall_score?: number | null
          pattern_recognition?: number | null
          problem_decomposition?: number | null
          raw_score?: number | null
          session_id: string
          skill_evidence?: Json | null
          sub_criteria?: Json | null
          updated_at?: string | null
          user_id?: string | null
          validation_pass_done?: boolean | null
        }
        Update: {
          adjusted_score?: number | null
          advanced_analysis?: Json | null
          algorithmic_thinking?: number | null
          code_quality?: Json | null
          communication_clarity?: number | null
          complexity_analysis?: number | null
          confidence?: number | null
          created_at?: string | null
          debugging_approach?: number | null
          difficulty_mode?: string | null
          edge_case_awareness?: number | null
          hire_decision?: string | null
          id?: string
          model_used?: string | null
          next_steps?: string[] | null
          optimization_mindset?: number | null
          overall_feedback?: string | null
          overall_score?: number | null
          pattern_recognition?: number | null
          problem_decomposition?: number | null
          raw_score?: number | null
          session_id?: string
          skill_evidence?: Json | null
          sub_criteria?: Json | null
          updated_at?: string | null
          user_id?: string | null
          validation_pass_done?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aws_usage_log: {
        Row: {
          bytes_processed: number | null
          created_at: string
          estimated_cost_usd: number | null
          id: string
          metadata: Json | null
          operation: string
          region: string
          service: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          bytes_processed?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          operation: string
          region: string
          service: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          bytes_processed?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          operation?: string
          region?: string
          service?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aws_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_submissions: {
        Row: {
          adjusted_score: number | null
          analysis_error: string | null
          analysis_status: string | null
          analyze_triggered_at: string | null
          assess_async_trigger_at: string | null
          assigned_problem_id: string | null
          campaign_id: string
          candidate_email: string | null
          candidate_id: string | null
          candidate_name: string | null
          code_snapshot: string | null
          completed_at: string | null
          created_at: string | null
          current_problem_id: string | null
          current_transcript: Json | null
          dimension_scores: Json | null
          entry_code_verified: boolean | null
          expires_at: string | null
          hire_decision: string | null
          id: string
          integrity_flags: string[] | null
          overall_score: number | null
          question_states: Json | null
          session_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adjusted_score?: number | null
          analysis_error?: string | null
          analysis_status?: string | null
          analyze_triggered_at?: string | null
          assess_async_trigger_at?: string | null
          assigned_problem_id?: string | null
          campaign_id: string
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          code_snapshot?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_problem_id?: string | null
          current_transcript?: Json | null
          dimension_scores?: Json | null
          entry_code_verified?: boolean | null
          expires_at?: string | null
          hire_decision?: string | null
          id?: string
          integrity_flags?: string[] | null
          overall_score?: number | null
          question_states?: Json | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adjusted_score?: number | null
          analysis_error?: string | null
          analysis_status?: string | null
          analyze_triggered_at?: string | null
          assess_async_trigger_at?: string | null
          assigned_problem_id?: string | null
          campaign_id?: string
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          code_snapshot?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_problem_id?: string | null
          current_transcript?: Json | null
          dimension_scores?: Json | null
          entry_code_verified?: boolean | null
          expires_at?: string | null
          hire_decision?: string | null
          id?: string
          integrity_flags?: string[] | null
          overall_score?: number | null
          question_states?: Json | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "assessment_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "candidate_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      co_owners: {
        Row: {
          email: string
          granted_at: string | null
          granted_by: string
          id: string
          user_id: string | null
        }
        Insert: {
          email: string
          granted_at?: string | null
          granted_by?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          granted_at?: string | null
          granted_by?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "co_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      code_attempts: {
        Row: {
          attempted_at: string | null
          campaign_id: string | null
          id: string
          identifier: string
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          campaign_id?: string | null
          id?: string
          identifier: string
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          campaign_id?: string | null
          id?: string
          identifier?: string
          success?: boolean | null
        }
        Relationships: []
      }
      concept_states: {
        Row: {
          concept_slug: string
          confidence: number
          created_at: string | null
          evidence_count: number
          fsrs_difficulty: number | null
          fsrs_due: string | null
          fsrs_lapses: number | null
          fsrs_reps: number | null
          fsrs_stability: number | null
          fsrs_state: number | null
          id: string
          last_session_id: string | null
          last_session_type: string | null
          last_signal_at: string | null
          signal_history: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          concept_slug: string
          confidence?: number
          created_at?: string | null
          evidence_count?: number
          fsrs_difficulty?: number | null
          fsrs_due?: string | null
          fsrs_lapses?: number | null
          fsrs_reps?: number | null
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          last_session_id?: string | null
          last_session_type?: string | null
          last_signal_at?: string | null
          signal_history?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          concept_slug?: string
          confidence?: number
          created_at?: string | null
          evidence_count?: number
          fsrs_difficulty?: number | null
          fsrs_due?: string | null
          fsrs_lapses?: number | null
          fsrs_reps?: number | null
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          last_session_id?: string | null
          last_session_type?: string | null
          last_signal_at?: string | null
          signal_history?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_states_concept_slug_fkey"
            columns: ["concept_slug"]
            isOneToOne: false
            referencedRelation: "concept_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_tags: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean
          prerequisites: string[] | null
          sort_order: number
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id: string
          is_active?: boolean
          prerequisites?: string[] | null
          sort_order?: number
          subject?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          prerequisites?: string[] | null
          sort_order?: number
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employer_invites: {
        Row: {
          company_name: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          invite_code: string
          is_active: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_feature_flags: {
        Row: {
          is_enabled: boolean
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_enabled?: boolean
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_enabled?: boolean
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insight_snapshots: {
        Row: {
          computed_at: string
          created_at: string
          insights: Json
          recommended_problems: Json
          recommended_tier: number
          sessions_snapshot: number
          tier_reasoning: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          insights?: Json
          recommended_problems?: Json
          recommended_tier?: number
          sessions_snapshot?: number
          tier_reasoning?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          insights?: Json
          recommended_problems?: Json
          recommended_tier?: number
          sessions_snapshot?: number
          tier_reasoning?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          adjusted_score: number | null
          attempt_number: number
          audio_s3_key: string | null
          completed_at: string | null
          created_at: string | null
          difficulty_mode: string | null
          duration: number | null
          feedback: Json | null
          id: string
          is_candidate_session: boolean
          overall_score: number | null
          previous_session_id: string | null
          problem_difficulty: string | null
          problem_id: string
          problem_title: string | null
          raw_score: number | null
          sprint_problem_ids: string[] | null
          sprint_problem_index: number | null
          started_at: string | null
          status: string | null
          transcribe_job_name: string | null
          transcribe_status: string | null
          transcript: Json | null
          transcript_s3_key: string | null
          transcript_storage: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          adjusted_score?: number | null
          attempt_number?: number
          audio_s3_key?: string | null
          completed_at?: string | null
          created_at?: string | null
          difficulty_mode?: string | null
          duration?: number | null
          feedback?: Json | null
          id?: string
          is_candidate_session?: boolean
          overall_score?: number | null
          previous_session_id?: string | null
          problem_difficulty?: string | null
          problem_id: string
          problem_title?: string | null
          raw_score?: number | null
          sprint_problem_ids?: string[] | null
          sprint_problem_index?: number | null
          started_at?: string | null
          status?: string | null
          transcribe_job_name?: string | null
          transcribe_status?: string | null
          transcript?: Json | null
          transcript_s3_key?: string | null
          transcript_storage?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          adjusted_score?: number | null
          attempt_number?: number
          audio_s3_key?: string | null
          completed_at?: string | null
          created_at?: string | null
          difficulty_mode?: string | null
          duration?: number | null
          feedback?: Json | null
          id?: string
          is_candidate_session?: boolean
          overall_score?: number | null
          previous_session_id?: string | null
          problem_difficulty?: string | null
          problem_id?: string
          problem_title?: string | null
          raw_score?: number | null
          sprint_problem_ids?: string[] | null
          sprint_problem_index?: number | null
          started_at?: string | null
          status?: string | null
          transcribe_job_name?: string | null
          transcribe_status?: string | null
          transcript?: Json | null
          transcript_s3_key?: string | null
          transcript_storage?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_previous_session_id_fkey"
            columns: ["previous_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string | null
          difficulty: string | null
          effectiveness_score: number | null
          embedding: string | null
          embedding_model: string | null
          embedding_status: string | null
          id: string
          keywords: string[] | null
          source: string | null
          source_gap_id: string | null
          status: string | null
          subtopic: string | null
          topic: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          difficulty?: string | null
          effectiveness_score?: number | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string | null
          id?: string
          keywords?: string[] | null
          source?: string | null
          source_gap_id?: string | null
          status?: string | null
          subtopic?: string | null
          topic: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          difficulty?: string | null
          effectiveness_score?: number | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string | null
          id?: string
          keywords?: string[] | null
          source?: string | null
          source_gap_id?: string | null
          status?: string | null
          subtopic?: string | null
          topic?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_gap_id_fkey"
            columns: ["source_gap_id"]
            isOneToOne: false
            referencedRelation: "knowledge_gaps"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_gaps: {
        Row: {
          admin_notes: string | null
          ai_drafted: boolean | null
          best_similarity_score: number | null
          created_at: string | null
          gap_reason: string | null
          id: string
          priority: string | null
          resolution_notes: string | null
          resolved_by_chunk_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string | null
          suggested_content: string | null
          suggested_title: string | null
          updated_at: string | null
          upvotes: number | null
          user_id: string | null
          user_query: string
        }
        Insert: {
          admin_notes?: string | null
          ai_drafted?: boolean | null
          best_similarity_score?: number | null
          created_at?: string | null
          gap_reason?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_by_chunk_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string | null
          suggested_content?: string | null
          suggested_title?: string | null
          updated_at?: string | null
          upvotes?: number | null
          user_id?: string | null
          user_query: string
        }
        Update: {
          admin_notes?: string | null
          ai_drafted?: boolean | null
          best_similarity_score?: number | null
          created_at?: string | null
          gap_reason?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_by_chunk_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string | null
          suggested_content?: string | null
          suggested_title?: string | null
          updated_at?: string | null
          upvotes?: number | null
          user_id?: string | null
          user_query?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_gaps_resolved_by_chunk_id_fkey"
            columns: ["resolved_by_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_gaps_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_gaps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_gaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learn_sessions: {
        Row: {
          completed_at: string | null
          concept_slug: string
          concepts_struggled: string[] | null
          concepts_understood: string[] | null
          created_at: string | null
          duration_seconds: number | null
          exchange_count: number
          id: string
          kai_assessment: Json | null
          session_type: string
          started_at: string | null
          status: string
          transcript: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          concept_slug: string
          concepts_struggled?: string[] | null
          concepts_understood?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          exchange_count?: number
          id?: string
          kai_assessment?: Json | null
          session_type?: string
          started_at?: string | null
          status?: string
          transcript?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          concept_slug?: string
          concepts_struggled?: string[] | null
          concepts_understood?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          exchange_count?: number
          id?: string
          kai_assessment?: Json | null
          session_type?: string
          started_at?: string | null
          status?: string
          transcript?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_sessions_concept_slug_fkey"
            columns: ["concept_slug"]
            isOneToOne: false
            referencedRelation: "concept_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_profiles: {
        Row: {
          created_at: string | null
          current_streak: number
          hire_readiness_trend: Json | null
          kai_memory: string | null
          kai_memory_structured: Json | null
          last_streak_date: string | null
          longest_streak: number
          narrative: string | null
          narrative_benchmark_context: string | null
          narrative_generated_at: string | null
          narrative_session_1: string | null
          sessions_at_last_narrative: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number
          hire_readiness_trend?: Json | null
          kai_memory?: string | null
          kai_memory_structured?: Json | null
          last_streak_date?: string | null
          longest_streak?: number
          narrative?: string | null
          narrative_benchmark_context?: string | null
          narrative_generated_at?: string | null
          narrative_session_1?: string | null
          sessions_at_last_narrative?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number
          hire_readiness_trend?: Json | null
          kai_memory?: string | null
          kai_memory_structured?: Json | null
          last_streak_date?: string | null
          longest_streak?: number
          narrative?: string | null
          narrative_benchmark_context?: string | null
          narrative_generated_at?: string | null
          narrative_session_1?: string | null
          sessions_at_last_narrative?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_signals: {
        Row: {
          concept_slug: string
          confidence_after: number
          confidence_before: number
          created_at: string
          delta: number
          id: string
          session_id: string
          session_type: string
          signal_type: string
          source_score: number | null
          user_id: string
        }
        Insert: {
          concept_slug: string
          confidence_after: number
          confidence_before: number
          created_at?: string
          delta: number
          id?: string
          session_id: string
          session_type: string
          signal_type: string
          source_score?: number | null
          user_id: string
        }
        Update: {
          concept_slug?: string
          confidence_after?: number
          confidence_before?: number
          created_at?: string
          delta?: number
          id?: string
          session_id?: string
          session_type?: string
          signal_type?: string
          source_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_signals_concept_slug_fkey"
            columns: ["concept_slug"]
            isOneToOne: false
            referencedRelation: "concept_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leetcode_profiles: {
        Row: {
          contest_rating: number | null
          easy_solved: number | null
          fetched_at: string | null
          hard_solved: number | null
          last_fetched: string | null
          medium_solved: number | null
          ranking: number | null
          recent_submissions: Json | null
          total_solved: number | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          contest_rating?: number | null
          easy_solved?: number | null
          fetched_at?: string | null
          hard_solved?: number | null
          last_fetched?: string | null
          medium_solved?: number | null
          ranking?: number | null
          recent_submissions?: Json | null
          total_solved?: number | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          contest_rating?: number | null
          easy_solved?: number | null
          fetched_at?: string | null
          hard_solved?: number | null
          last_fetched?: string | null
          medium_solved?: number | null
          ranking?: number | null
          recent_submissions?: Json | null
          total_solved?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "leetcode_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      model_registry: {
        Row: {
          context_window: number | null
          created_at: string
          deprecated_at: string | null
          is_active: boolean | null
          is_preview: boolean | null
          is_verified: boolean | null
          last_verified: string | null
          model_id: string
          notes: string | null
          provider: string
          rpd: number | null
          rpm: number | null
          tier: number | null
          tpm: number | null
          updated_at: string
        }
        Insert: {
          context_window?: number | null
          created_at?: string
          deprecated_at?: string | null
          is_active?: boolean | null
          is_preview?: boolean | null
          is_verified?: boolean | null
          last_verified?: string | null
          model_id: string
          notes?: string | null
          provider: string
          rpd?: number | null
          rpm?: number | null
          tier?: number | null
          tpm?: number | null
          updated_at?: string
        }
        Update: {
          context_window?: number | null
          created_at?: string
          deprecated_at?: string | null
          is_active?: boolean | null
          is_preview?: boolean | null
          is_verified?: boolean | null
          last_verified?: string | null
          model_id?: string
          notes?: string | null
          provider?: string
          rpd?: number | null
          rpm?: number | null
          tier?: number | null
          tpm?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      model_routing: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          max_tokens_override: number | null
          model_id: string
          notes: string | null
          priority: number
          provider: string
          updated_at: string | null
          use_case: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_tokens_override?: number | null
          model_id: string
          notes?: string | null
          priority?: number
          provider: string
          updated_at?: string | null
          use_case: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          max_tokens_override?: number | null
          model_id?: string
          notes?: string | null
          priority?: number
          provider?: string
          updated_at?: string | null
          use_case?: string
        }
        Relationships: []
      }
      placement_outcomes: {
        Row: {
          avg_score_before_placement: number | null
          company_name: string
          created_at: string | null
          id: string
          notes: string | null
          package_lpa: number | null
          placed_at: string
          role: string | null
          sessions_before_placement: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_score_before_placement?: number | null
          company_name: string
          created_at?: string | null
          id?: string
          notes?: string | null
          package_lpa?: number | null
          placed_at: string
          role?: string | null
          sessions_before_placement?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_score_before_placement?: number | null
          company_name?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          package_lpa?: number | null
          placed_at?: string
          role?: string | null
          sessions_before_placement?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_outcomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          avg_score_easy: number | null
          avg_score_hard: number | null
          avg_score_medium: number | null
          constraints: string | null
          created_at: string | null
          curated_lists: string[] | null
          description: string
          difficulty: string
          examples: Json | null
          external_url: string | null
          hints: string[] | null
          id: string
          primary_pattern: string | null
          space_complexity: string | null
          tags: string[] | null
          time_complexity: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          avg_score_easy?: number | null
          avg_score_hard?: number | null
          avg_score_medium?: number | null
          constraints?: string | null
          created_at?: string | null
          curated_lists?: string[] | null
          description: string
          difficulty: string
          examples?: Json | null
          external_url?: string | null
          hints?: string[] | null
          id: string
          primary_pattern?: string | null
          space_complexity?: string | null
          tags?: string[] | null
          time_complexity?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          avg_score_easy?: number | null
          avg_score_hard?: number | null
          avg_score_medium?: number | null
          constraints?: string | null
          created_at?: string | null
          curated_lists?: string[] | null
          description?: string
          difficulty?: string
          examples?: Json | null
          external_url?: string | null
          hints?: string[] | null
          id?: string
          primary_pattern?: string | null
          space_complexity?: string | null
          tags?: string[] | null
          time_complexity?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          campaigns_created: number | null
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_suspended: boolean | null
          rate_limit_override: number | null
          subscription_expires_at: string | null
          subscription_status: "free" | "premium" | "college"
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          campaigns_created?: number | null
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_suspended?: boolean | null
          rate_limit_override?: number | null
          subscription_expires_at?: string | null
          subscription_status?: "free" | "premium" | "college"
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          campaigns_created?: number | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_suspended?: boolean | null
          rate_limit_override?: number | null
          subscription_expires_at?: string | null
          subscription_status?: "free" | "premium" | "college"
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      score_benchmarks: {
        Row: {
          computed_at: string | null
          difficulty: string
          id: string
          p25: number | null
          p50: number | null
          p75: number | null
          p90: number | null
          sample_count: number | null
          skill_id: string
        }
        Insert: {
          computed_at?: string | null
          difficulty: string
          id?: string
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          sample_count?: number | null
          skill_id: string
        }
        Update: {
          computed_at?: string | null
          difficulty?: string
          id?: string
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          sample_count?: number | null
          skill_id?: string
        }
        Relationships: []
      }
      session_replays: {
        Row: {
          annotations: Json
          created_at: string | null
          expires_at: string
          is_public: boolean
          public_token: string
          session_id: string
          updated_at: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          annotations?: Json
          created_at?: string | null
          expires_at?: string
          is_public?: boolean
          public_token?: string
          session_id: string
          updated_at?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          annotations?: Json
          created_at?: string | null
          expires_at?: string
          is_public?: boolean
          public_token?: string
          session_id?: string
          updated_at?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_replays_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_replays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skill_repetition: {
        Row: {
          created_at: string
          fsrs_difficulty: number
          fsrs_due: string
          fsrs_elapsed_days: number
          fsrs_lapses: number
          fsrs_last_review: string | null
          fsrs_reps: number
          fsrs_scheduled_days: number
          fsrs_stability: number
          fsrs_state: number
          id: string
          last_score: number | null
          last_session_id: string | null
          skill_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fsrs_difficulty?: number
          fsrs_due?: string
          fsrs_elapsed_days?: number
          fsrs_lapses?: number
          fsrs_last_review?: string | null
          fsrs_reps?: number
          fsrs_scheduled_days?: number
          fsrs_stability?: number
          fsrs_state?: number
          id?: string
          last_score?: number | null
          last_session_id?: string | null
          skill_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fsrs_difficulty?: number
          fsrs_due?: string
          fsrs_elapsed_days?: number
          fsrs_lapses?: number
          fsrs_last_review?: string | null
          fsrs_reps?: number
          fsrs_scheduled_days?: number
          fsrs_stability?: number
          fsrs_state?: number
          id?: string
          last_score?: number | null
          last_session_id?: string | null
          skill_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_repetition_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spaced_repetition: {
        Row: {
          created_at: string
          fsrs_difficulty: number | null
          fsrs_due: string | null
          fsrs_elapsed_days: number | null
          fsrs_lapses: number | null
          fsrs_last_review: string | null
          fsrs_reps: number | null
          fsrs_scheduled_days: number | null
          fsrs_stability: number | null
          fsrs_state: number | null
          id: string
          interval: number
          last_quality: number | null
          last_reviewed_at: string | null
          problem_difficulty: string | null
          problem_id: string
          problem_title: string | null
          updated_at: string
          use_fsrs: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fsrs_difficulty?: number | null
          fsrs_due?: string | null
          fsrs_elapsed_days?: number | null
          fsrs_lapses?: number | null
          fsrs_last_review?: string | null
          fsrs_reps?: number | null
          fsrs_scheduled_days?: number | null
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          interval?: number
          last_quality?: number | null
          last_reviewed_at?: string | null
          problem_difficulty?: string | null
          problem_id: string
          problem_title?: string | null
          updated_at?: string
          use_fsrs?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          fsrs_difficulty?: number | null
          fsrs_due?: string | null
          fsrs_elapsed_days?: number | null
          fsrs_lapses?: number | null
          fsrs_last_review?: string | null
          fsrs_reps?: number | null
          fsrs_scheduled_days?: number | null
          fsrs_stability?: number | null
          fsrs_state?: number | null
          id?: string
          interval?: number
          last_quality?: number | null
          last_reviewed_at?: string | null
          problem_difficulty?: string | null
          problem_id?: string
          problem_title?: string | null
          updated_at?: string
          use_fsrs?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaced_repetition_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          cohort_id: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          notes: string | null
          plan_type: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_end: string | null
          updated_at: string | null
          user_id: string | null
          weekly_session_limit: number | null
        }
        Insert: {
          cancelled_at?: string | null
          cohort_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          plan_type: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_session_limit?: number | null
        }
        Update: {
          cancelled_at?: string | null
          cohort_id?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          plan_type?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_session_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          notes: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          notes?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          notes?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      system_events: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          model_id: string | null
          provider: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          provider?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          provider?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_daily_usage: {
        Row: {
          created_at: string | null
          date: string
          id: string
          questions_used: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          questions_used?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          questions_used?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          id: string
          leetcode_fetch_error: string | null
          leetcode_fetch_status: string | null
          leetcode_username: string | null
          placement_month: string | null
          practice_reminders: boolean | null
          preferred_voice_lang: string | null
          preferred_voice_name: string | null
          show_onboarding: boolean | null
          target_companies: string[] | null
          theme: string | null
          tts_provider: string | null
          updated_at: string | null
          user_id: string
          voice_pitch: number | null
          voice_rate: number | null
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          leetcode_fetch_error?: string | null
          leetcode_fetch_status?: string | null
          leetcode_username?: string | null
          placement_month?: string | null
          practice_reminders?: boolean | null
          preferred_voice_lang?: string | null
          preferred_voice_name?: string | null
          show_onboarding?: boolean | null
          target_companies?: string[] | null
          theme?: string | null
          tts_provider?: string | null
          updated_at?: string | null
          user_id: string
          voice_pitch?: number | null
          voice_rate?: number | null
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          leetcode_fetch_error?: string | null
          leetcode_fetch_status?: string | null
          leetcode_username?: string | null
          placement_month?: string | null
          practice_reminders?: boolean | null
          preferred_voice_lang?: string | null
          preferred_voice_name?: string | null
          show_onboarding?: boolean | null
          target_companies?: string[] | null
          theme?: string | null
          tts_provider?: string | null
          updated_at?: string | null
          user_id?: string
          voice_pitch?: number | null
          voice_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_progress"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_weekly_usage: {
        Row: {
          created_at: string | null
          id: string
          interview_sessions_used: number
          learn_sessions_used: number
          updated_at: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interview_sessions_used?: number
          learn_sessions_used?: number
          updated_at?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interview_sessions_used?: number
          learn_sessions_used?: number
          updated_at?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_weekly_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_progress: {
        Row: {
          average_score: number | null
          avg_algorithmic_thinking: number | null
          avg_communication_clarity: number | null
          avg_complexity_analysis: number | null
          avg_debugging_approach: number | null
          avg_edge_case_awareness: number | null
          avg_optimization_mindset: number | null
          avg_pattern_recognition: number | null
          avg_problem_decomposition: number | null
          last_session_date: string | null
          total_practice_time: number | null
          total_sessions: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_code_rate_limit: {
        Args: {
          p_identifier: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          attempts_in_window: number
        }[]
      }
      check_is_admin: { Args: never; Returns: boolean }
      check_user_rate_limit: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          allowed: boolean
          is_admin_user: boolean
          remaining: number
        }[]
      }
      claim_campaign_slot: {
        Args: { p_campaign_id: string }
        Returns: {
          assignment_mode: string
          campaign_questions: Json
          created_by: string
          default_easy_mins: number
          default_hard_mins: number
          default_medium_mins: number
          entry_code: string
          id: string
          max_uses: number
          pool_difficulty: string
          problem_id: string
          question_pool: Json
          show_score_to_candidate: boolean
          time_limit_mins: number
          title: string
          uses_count: number
        }[]
      }
      cleanup_old_events: { Args: { days_to_keep?: number }; Returns: number }
      compute_adjusted_score: {
        Args: { p_difficulty: string; p_raw_score: number }
        Returns: number
      }
      ensure_learner_profile: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      expire_stale_submissions: { Args: never; Returns: number }
      generate_campaign_entry_code: { Args: never; Returns: string }
      get_admin_analytics: { Args: { p_days?: number }; Returns: Json }
      get_aws_usage_summary: {
        Args: { p_days?: number }
        Returns: {
          service: string
          total_bytes: number
          total_calls: number
          total_estimated_cost: number
        }[]
      }
      get_due_reviews: {
        Args: { p_user_id: string }
        Returns: {
          fsrs_difficulty: number
          fsrs_due: string
          fsrs_lapses: number
          fsrs_reps: number
          fsrs_stability: number
          fsrs_state: number
          id: string
          problem_id: string
          problem_title: string
        }[]
      }
      get_model_rate_stats: {
        Args: never
        Returns: {
          hits_24h: number
          last_hit: string
          model_id: string
        }[]
      }
      get_my_permissions: {
        Args: never
        Returns: {
          account_type: string
          is_admin: boolean
          is_co_owner: boolean
          is_employer: boolean
          is_owner: boolean
        }[]
      }
      get_random_problem: {
        Args: { problem_difficulty?: string }
        Returns: {
          description: string
          difficulty: string
          examples: Json
          hints: string[]
          id: string
          tags: string[]
          title: string
        }[]
      }
      get_system_health: { Args: never; Returns: Json }
      get_user_progress: {
        Args: { session_limit?: number; target_user_id: string }
        Returns: {
          completed_at: string
          duration: number
          overall_score: number
          problem_difficulty: string
          problem_id: string
          session_id: string
        }[]
      }
      get_user_sessions_with_assessment: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          adjusted_score: number
          algorithmic_thinking: number
          attempt_number: number
          communication_clarity: number
          completed_at: string
          complexity_analysis: number
          debugging_approach: number
          difficulty_mode: string
          duration: number
          edge_case_awareness: number
          hire_decision: string
          optimization_mindset: number
          overall_score: number
          pattern_recognition: number
          problem_decomposition: number
          problem_difficulty: string
          problem_id: string
          problem_title: string
          session_id: string
          started_at: string
          status: string
        }[]
      }
      increment_view_count: { Args: { p_token: string }; Returns: undefined }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      mark_submission_dropped: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          subtopic: string
          title: string
          topic: string
        }[]
      }
      record_code_attempt: {
        Args: {
          p_campaign_id?: string
          p_identifier: string
          p_success?: boolean
        }
        Returns: undefined
      }
      record_user_question: { Args: { p_user_id: string }; Returns: undefined }
      save_interview_session_atomic: {
        Args: {
          p_adjusted_score?: number | null
          p_assessment_adjusted_score?: number | null
          p_assessment_algorithmic_thinking?: number | null
          p_assessment_code_quality?: Json | null
          p_assessment_communication_clarity?: number | null
          p_assessment_complexity_analysis?: number | null
          p_assessment_confidence?: number | null
          p_assessment_debugging_approach?: number | null
          p_assessment_difficulty_mode?: string | null
          p_assessment_edge_case_awareness?: number | null
          p_assessment_hire_decision?: string | null
          p_assessment_model_used?: string | null
          p_assessment_next_steps?: string[] | null
          p_assessment_optimization_mindset?: number | null
          p_assessment_overall_feedback?: string | null
          p_assessment_pattern_recognition?: number | null
          p_assessment_problem_decomposition?: number | null
          p_assessment_skill_evidence?: Json | null
          p_assessment_sub_criteria?: Json | null
          p_assessment_validation_pass_done?: boolean | null
          p_create_assessment?: boolean | null
          p_difficulty_mode?: string | null
          p_duration?: number | null
          p_feedback?: Json | null
          p_is_candidate_session?: boolean | null
          p_overall_score?: number | null
          p_problem_id: string
          p_problem_title: string
          p_raw_score?: number | null
          p_status?: string | null
          p_transcript: Json
          p_user_id: string
        }
        Returns: {
          assessment_id: string | null
          session_id: string
        }[]
      }
      save_question_progress: {
        Args: {
          p_current_problem: string
          p_question_states: Json
          p_submission_id: string
        }
        Returns: undefined
      }
      update_user_streak: {
        Args: { p_user_id: string }
        Returns: {
          is_new_record: boolean
          longest_streak: number
          new_streak: number
        }[]
      }
      verify_campaign_entry_code: {
        Args: { p_entry_code: string; p_public_token: string }
        Returns: {
          campaign_id: string
          reason: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

