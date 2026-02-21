export type CognitiveSkill =
    | 'problem-decomposition'
    | 'pattern-recognition'
    | 'algorithmic-thinking'
    | 'complexity-analysis'
    | 'communication-clarity'
    | 'edge-case-awareness'
    | 'optimization-mindset'
    | 'debugging-approach';

export interface SkillDefinition {
    id: CognitiveSkill;
    name: string;
    description: string;
    color: string;            // For radar chart / branding
    weight: number;           // Importance (0-1), sum of all weights should be 1.0
    rubric: ScoringRubric;
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
    totalSessions: number;
    averageScore: number; // overall average
    averageScores: Record<CognitiveSkill, number>;
    trends: SkillTrend[];
    sessions: SessionHistory[];
    lastUpdated: Date;
    narrative?: string;
    narrativeGeneratedAt?: Date;
    sessionsAtLastNarrative?: number;
}
