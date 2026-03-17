export type CognitiveSkill =
    | 'problem-decomposition'
    | 'pattern-recognition'
    | 'algorithmic-thinking'
    | 'complexity-analysis'
    | 'communication-clarity'
    | 'edge-case-awareness'
    | 'optimization-mindset'
    | 'debugging-approach';

export interface SubCriterion {
    id: string;
    label: string;
    weight: number;  // weights sum to 1.0 per dimension
    description: string;
}

export interface SkillDefinition {
    id: CognitiveSkill;
    name: string;
    description: string;
    color: string;            // For radar chart / branding
    weight: number;           // Importance (0-1), sum of all weights should be 1.0
    rubric: ScoringRubric;
    subCriteria: SubCriterion[];  // NEW
}

export interface ScoringRubric {
    level1: string;  // Score 1-2: Poor
    level2: string;  // Score 3-4: Below Average
    level3: string;  // Score 5-6: Average
    level4: string;  // Score 7-8: Good
    level5: string;  // Score 9-10: Excellent
}

export interface SessionHistory {
    sessionId: string;
    userId: string;
    problemId: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    timestamp: Date;
    duration: number; // seconds
    skills: Record<CognitiveSkill, number>;
    overallScore: number; // weighted average
    transcript?: { role: string; content: string }[]; // conversation history
}

export interface SkillTrend {
    skill: CognitiveSkill;
    trend: 'improving' | 'stable' | 'declining';
    recentScores: number[];
    change: number;
}

export interface UserProgress {
    userId: string;
    sessions: SessionHistory[];
    trends: SkillTrend[];
    totalSessions: number;          // Total number of sessions completed
    averageScore: number;           // Average score over recent sessions
    averageScores: Record<CognitiveSkill, number>; // Average scores per skill over recent sessions
    recentSessionsUsedForAverage?: number; // E.g., 5
    lastUpdated: Date;
    narrative?: string;             // Latest generative feedback narrative
    narrativeGeneratedAt?: Date;    // When the narrative was created
    sessionsAtLastNarrative?: number; // To track when to trigger a new one
    next_steps?: string[];          // Latest next steps from generative feedback
}

/**
 * Compute the number of improving skill dimensions.
 * Returns null if there's only one session (no comparison possible).
 */
export function computeImprovingAreasCount(progress: UserProgress): number | null {
    if (progress.totalSessions <= 1) return null;
    if (!progress.trends || progress.trends.length === 0) return null;
    return progress.trends.filter(t => t.trend === 'improving').length;
}
