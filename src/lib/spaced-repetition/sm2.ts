export interface SpacedRepetitionRecord {
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    lastQuality: number | null;
    nextReviewDate: string;
    lastReviewedAt: string | null;
}

export function computeNextReview(
    current: Pick<SpacedRepetitionRecord, 'intervalDays' | 'easeFactor' | 'repetitions'>,
    overallScore: number
): { intervalDays: number; easeFactor: number; repetitions: number; lastQuality: number } {
    const quality = Math.round((overallScore / 10) * 5);
    const newEaseFactor = Math.max(1.3, current.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    let newInterval: number;
    let newRepetitions: number;

    if (quality < 3) {
        newInterval = 1;
        newRepetitions = 0;
    } else if (current.repetitions === 0) {
        newInterval = 1;
        newRepetitions = 1;
    } else if (current.repetitions === 1) {
        newInterval = 6;
        newRepetitions = 2;
    } else {
        newInterval = Math.round(current.intervalDays * newEaseFactor);
        newRepetitions = current.repetitions + 1;
    }

    // Cap interval at 180 days maximum.
    newInterval = Math.min(newInterval, 180);

    return {
        intervalDays: newInterval,
        easeFactor: newEaseFactor,
        repetitions: newRepetitions,
        lastQuality: quality
    };
}

export function formatNextReviewDate(intervalDays: number): string {
    return new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0];
}
