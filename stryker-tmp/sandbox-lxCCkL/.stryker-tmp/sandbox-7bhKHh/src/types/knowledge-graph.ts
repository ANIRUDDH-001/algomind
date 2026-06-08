/**
 * @codesage
 * @file      src/types/knowledge-graph.ts
 * @purpose   TypeScript types for the knowledge graph system, concept tracking, and FSRS spacing repetition algorithm.
 * @tech      TypeScript
 * @connects  Exported definitions for learning concepts, tags, and progress tracking.
 * @apis      none
 * @db        concept_tags, concept_states, learning_signals
 * @state     none
 * @env       none
 * @issues    No dead code or unused imports found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 


export interface ConceptTag {
  id: string; // slug e.g. 'arrays-strings'
  display_name: string;
  description: string | null;
  subject: 'dsa' | 'system_design' | 'os' | 'dbms';
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  prerequisites: string[];
  created_at: string;
  updated_at: string;
}

export interface SignalHistoryEntry {
  type: 'session_complete' | 'struggle_detected' | 'understood_confirmed' | 'diagnostic_initial';
  delta: number;
  at: string; // ISO timestamp
}

export interface ConceptState {
  id: string;
  user_id: string;
  concept_slug: string;
  confidence: number; // 0.0 to 1.0
  evidence_count: number;
  signal_history: SignalHistoryEntry[];
  fsrs_due: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_state: 0 | 1 | 2 | 3;
  last_session_id: string | null;
  last_session_type: 'interview' | 'learn' | 'diagnostic' | null;
  last_signal_at: string;
  created_at: string;
  updated_at: string;
}

export interface LearnSession {
  id: string;
  user_id: string;
  concept_slug: string;
  status: 'active' | 'completed' | 'abandoned';
  session_type: 'concept' | 'diagnostic' | 'review';
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  transcript: TranscriptEntry[];
  exchange_count: number;
  kai_assessment: KaiTutorAssessment | null;
  concepts_understood: string[];
  concepts_struggled: string[];
  created_at: string;
  updated_at: string;
}

export interface KaiTutorAssessment {
  understood: string[]; // concept tags understood this session
  struggled: string[]; // concept tags struggled
  notes: string; // Kai's qualitative notes
  confidence_delta: number; // suggested delta to apply
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  at: string; // ISO timestamp
}

export interface LearningSignal {
  id: string;
  user_id: string;
  session_id: string;
  session_type: 'interview' | 'learn' | 'diagnostic';
  concept_slug: string;
  signal_type: 'session_complete' | 'struggle_detected' | 'understood_confirmed' | 'diagnostic_initial';
  confidence_before: number;
  confidence_after: number;
  delta: number;
  source_score: number | null;
  created_at: string;
}

export interface UserWeeklyUsage {
  id: string;
  user_id: string;
  week_start: string; // date string e.g. '2026-03-16'
  interview_sessions_used: number;
  learn_sessions_used: number;
  created_at: string;
  updated_at: string;
}

export type ConceptConfidenceLevel = 'unknown' | 'weak' | 'developing' | 'solid' | 'strong';

export function getConfidenceLevel(confidence: number): ConceptConfidenceLevel {
  if (confidence < 0.1) return 'unknown';
  if (confidence < 0.35) return 'weak';
  if (confidence < 0.55) return 'developing';
  if (confidence < 0.75) return 'solid';
  return 'strong';
}

export const CONCEPT_CONFIDENCE_COLORS: Record<ConceptConfidenceLevel, string> = {
  unknown: '#374151', // gray
  weak: '#DC2626', // red
  developing: '#F59E0B', // amber
  solid: '#3B82F6', // blue
  strong: '#10B981', // emerald
};

export const ALL_DSA_CONCEPT_SLUGS = [
  'arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window',
  'binary-search', 'recursion-backtracking', 'trees-traversal', 'graphs-bfs-dfs',
  'dynamic-programming', 'heaps', 'tries', 'sorting-algorithms', 'linked-lists',
  'bit-manipulation', 'math-number-theory', 'stack-queue', 'intervals',
  'matrix', 'prefix-sum', 'union-find',
] as const;

export type DSAConceptSlug = typeof ALL_DSA_CONCEPT_SLUGS[number];