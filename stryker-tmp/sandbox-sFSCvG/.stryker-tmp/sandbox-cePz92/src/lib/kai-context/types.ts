/**
 * @module kai-context/types
 * @description StudentContext - the assembled user intelligence object
 *              passed to every Kai AI session.
 * @phase Phase 2B
 */
// @ts-nocheck

// 


export interface ConceptSnapshot {
  slug: string;
  displayName: string;
  confidence: number;
  level: 'unknown' | 'weak' | 'developing' | 'solid' | 'strong';
  evidenceCount: number;
}

export interface PerformanceSummary {
  totalSessionsCompleted: number;
  averageScore: number | null;
  lastSessionScore: number | null;
  lastSessionAt: string | null;
  streak: number;
}

export interface SubscriptionInfo {
  status: 'free' | 'premium' | 'college';
  sessionsUsedThisWeek: number;
  weeklyLimit: number | null;
  sessionsRemaining: number | null;
}

export interface KaiMemoryStructured {
  topStrength: string | null;
  mainWeakness: string | null;
  communicationStyle: string | null;
  focusForNextSession: string | null;
}

export interface StudentContext {
  userId: string;
  builtAt: string;
  hasCompletedDiagnostic: boolean;
  weakestConcepts: ConceptSnapshot[];
  strongestConcepts: ConceptSnapshot[];
  allConceptSummaries: ConceptSnapshot[];
  nextRecommendedConcept: string | null;
  performance: PerformanceSummary;
  kaiMemoryText: string | null;
  kaiMemoryStructured: KaiMemoryStructured | null;
  subscription: SubscriptionInfo;
  accountType: 'candidate' | 'employer' | 'admin' | 'owner';
}

export interface StudentContextPromptBlock {
  weakConcepts: string;
  strongConcepts: string;
  sessionHistory: string;
  kaiMemory: string;
  subscriptionNote: string;
  diagnosticStatus: string;
}
