/**
 * @codesage
 * @file      src/lib/recommendations/difficulty-calibrator.ts
 * @purpose   Recommendation engine, calibrator, and insight processing.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

export interface DifficultyTier {
    tier: 1 | 2 | 3 | 4 | 5;
    label: 'Beginner' | 'Developing' | 'Intermediate' | 'Advanced' | 'Expert';
    easyPct: number;
    mediumPct: number;
    hardPct: number;
    description: string;
}

export const DIFFICULTY_TIERS: DifficultyTier[] = [
    { tier: 1, label: 'Beginner', easyPct: 100, mediumPct: 0, hardPct: 0, description: 'Building core fundamentals' },
    { tier: 2, label: 'Developing', easyPct: 70, mediumPct: 30, hardPct: 0, description: 'Comfortable with easy, starting medium' },
    { tier: 3, label: 'Intermediate', easyPct: 25, mediumPct: 60, hardPct: 15, description: 'Medium-focused with hard exposure' },
    { tier: 4, label: 'Advanced', easyPct: 10, mediumPct: 50, hardPct: 40, description: 'Medium-hard balance' },
    { tier: 5, label: 'Expert', easyPct: 5, mediumPct: 30, hardPct: 65, description: 'Hard-weighted, interview-ready' },
];

export interface SessionSummary {
    overall_score: number;
    problem_difficulty: 'easy' | 'medium' | 'hard';
}

export function computeDifficultyTier(
    sessions: SessionSummary[]
): { tier: DifficultyTier; reasoning: string } {
    let amTier = 1;
    const count = sessions.length;
    const avgScore = count > 0 ? sessions.reduce((acc, s) => acc + s.overall_score, 0) / count : 0;

    if (count === 0) {
        amTier = 1;
    } else if (count >= 1 && count <= 4) {
        if (avgScore < 6) amTier = 1;
        else amTier = 2;
    } else if (count >= 5 && count <= 14) {
        if (avgScore < 5) amTier = 1;
        else if (avgScore < 7) amTier = 2;
        else amTier = 3;
    } else if (count >= 15 && count <= 29) {
        if (avgScore < 5) amTier = 2;
        else if (avgScore < 7) amTier = 3;
        else amTier = 4;
    } else if (count >= 30) {
        if (avgScore < 6) amTier = 3;
        else if (avgScore < 7.5) amTier = 4;
        else amTier = 5;
    }

    const finalTierValue = amTier as 1 | 2 | 3 | 4 | 5;
    const tierObj = DIFFICULTY_TIERS.find(t => t.tier === finalTierValue)!;

    let reasoning = '';
    const amText = count > 0 ? `${count} AlgoMind session${count === 1 ? '' : 's'} with avg score ${avgScore.toFixed(1)}` : '';

    if (amText) {
        reasoning = `Based on your ${amText}, you're calibrated at ${tierObj.label} level.`;
    } else {
        reasoning = `Based on your initial profile, you're calibrated at ${tierObj.label} level.`;
    }

    return { tier: tierObj, reasoning };
}

export function selectProblemDifficulty(tier: DifficultyTier): 'easy' | 'medium' | 'hard' {
    const roll = Math.random() * 100;
    if (roll < tier.easyPct) return 'easy';
    if (roll < tier.easyPct + tier.mediumPct) return 'medium';
    return 'hard';
}
