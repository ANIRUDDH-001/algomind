/**
 * @codesage
 * @file      src/types/campaign.ts
 * @purpose   Defines interfaces for assessment campaigns, candidate submissions, and per-question states.
 * @tech      TypeScript
 * @connects  Used by campaign execution and submission tracking logic.
 * @apis      none
 * @db        assessment_campaigns, candidate_submissions
 * @state     none
 * @env       none
 * @issues    No dead code or unused imports found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck


// Per-question config stored in assessment_campaigns.campaign_questions
export interface CampaignQuestion {
  problem_id: string;
  time_limit_mins: number;
  order: number;
}

// Per-question runtime state stored in candidate_submissions.question_states
export interface QuestionState {
  problem_id: string;
  order: number;
  time_limit_mins: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  started_at: string | null;       // ISO string
  completed_at: string | null;     // ISO string
  elapsed_secs: number;            // seconds used so far
  transcript: { speaker: string; text: string }[];
  final_code?: string;
}

export interface CampaignData {
  id: string;
  title: string;
  time_limit_mins: number;
  public_token: string;
  entry_code: string;
  show_score_to_candidate: boolean;
  campaign_questions: CampaignQuestion[];  // new multi-question field
  default_easy_mins: number;
  default_medium_mins: number;
  default_hard_mins: number;
  // legacy single-problem fields (kept for backwards compat)
  problem_id: string | null;
  assignment_mode: string;
  question_pool: string[] | null;
  pool_difficulty: string | null;
}

export interface CampaignSubmission {
  id: string;
  campaign_id: string;
  session_id: string | null;
  candidate_name: string;
  candidate_email: string;
  status: 'invited' | 'in_progress' | 'completed' | 'dropped_out' | 'expired';
  overall_score: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  candidate_id: string | null;
  question_states: QuestionState[];
  current_problem_id: string | null;
  entry_code_verified: boolean;
}
