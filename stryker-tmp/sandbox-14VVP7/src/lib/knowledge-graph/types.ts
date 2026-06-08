/**
 * @module knowledge-graph/types
 * @description Internal types for KnowledgeGraphService.
 *              Public types are in src/types/knowledge-graph.ts
 * @phase Phase 2A
 */
// @ts-nocheck


export interface KGConceptState {
  id: string;
  userId: string;
  conceptSlug: string;
  confidence: number;
  evidenceCount: number;
  signalHistory: KGSignalHistoryEntry[];
  lastSessionId: string | null;
  lastSessionType: 'interview' | 'learn' | 'diagnostic' | null;
  lastSignalAt: string;
  updatedAt: string;
}

export interface KGSignalHistoryEntry {
  type: 'session_complete' | 'struggle_detected' | 'understood_confirmed' | 'diagnostic_initial';
  delta: number;
  at: string;
}

export interface KGDiagnosticResult {
  conceptSlug: string;
  confidence: number; // 0.0 to 1.0
}

export interface KGLearnAssessment {
  understood: string[];
  struggled: string[];
  notes: string;
  confidenceDelta: number;
}

// Backward-compatible alias for tutor/route naming.
export type KaiTutorAssessment = KGLearnAssessment;

export interface KGConceptSummary {
  slug: string;
  displayName: string;
  confidence: number;
  evidenceCount: number;
  level: 'unknown' | 'weak' | 'developing' | 'solid' | 'strong';
  icon: string;
  lastSessionType: string | null;
  lastSignalAt: string | null;
}

export interface KGUserCache {
  conceptStates: KGConceptState[];
  builtAt: string;
  ttlHint: number;
}
