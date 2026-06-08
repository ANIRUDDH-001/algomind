/**
 * @codesage
 * @file      src/lib/spaced-repetition/fsrs.ts
 * @purpose   Spaced repetition algorithms (FSRS, SM2) and scheduling queues.
 * @tech      Node.js, ts-fsrs
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
import { FSRS, Card, Grade, Rating, createEmptyCard, State } from 'ts-fsrs';

// FSRS instance with recommended settings for DSA problem review
const fsrs = new FSRS({
    request_retention: 0.85,  // 85% recall target (good for DSA — not too aggressive)
    maximum_interval: 180,    // Keep 180-day max from original implementation
    enable_fuzz: true,        // Slight randomness prevents review day clustering
    w: [
        // FSRS-6 default weights (full 21-parameter vector)
        // See: https://github.com/open-spaced-repetition/fsrs4anki/wiki
        0.4072, 1.1829, 3.1262, 15.4722,
        7.2102, 0.5316, 1.0651, 0.0590,
        1.5330, 0.1544, 1.0070, 1.9395,
        0.1100, 0.2900, 2.3850, 0.1695,
        2.9898, 0.5100, 0.6000, 0.0000,
        0.0000
    ],
});

export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Convert a 0-10 DSA interview score to an FSRS rating.
 * Scale:
 *   0-3: Again  (failed — reset interval)
 *   4-5: Hard   (struggled but got it)
 *   6-7: Good   (normal successful recall)
 *   8-10: Easy  (instant recall, no effort)
 */
export function scoreToFSRSRating(score: number): Grade {
    if (score < 4) return Rating.Again as Grade;
    if (score < 6) return Rating.Hard as Grade;
    if (score < 8) return Rating.Good as Grade;
    return Rating.Easy as Grade;
}

export interface FSRSCardData {
    fsrs_stability: number;
    fsrs_difficulty: number;
    fsrs_elapsed_days: number;
    fsrs_scheduled_days: number;
    fsrs_reps: number;
    fsrs_lapses: number;
    fsrs_state: number;
    fsrs_last_review: string | null;
    fsrs_due: string;
}

/**
 * Convert DB record to ts-fsrs Card object.
 */
function dbToCard(record: Partial<FSRSCardData>): Card {
    return {
        due: record.fsrs_due ? new Date(record.fsrs_due) : new Date(),
        stability: record.fsrs_stability || 0,
        difficulty: record.fsrs_difficulty || 5,
        elapsed_days: record.fsrs_elapsed_days || 0,
        scheduled_days: record.fsrs_scheduled_days || 0,
        reps: record.fsrs_reps || 0,
        lapses: record.fsrs_lapses || 0,
        state: (record.fsrs_state || 0) as State,
        learning_steps: 0,
        // ↑ Intentional: AlgoMind does not use intra-day re-learning steps.
        // When a user fails a problem, it returns at the next scheduled session
        // (next_review_date) rather than multiple times within the same day.
        // If daily re-practice is added in future, store this in the DB and
        // populate from concept_states.learning_steps.
        last_review: record.fsrs_last_review ? new Date(record.fsrs_last_review) : undefined,
    };
}

/**
 * Compute next FSRS review schedule given current record and interview score.
 * Returns DB-ready fields to update.
 */
export function computeNextReviewFSRS(
    record: Partial<FSRSCardData>,
    overallScore: number
): FSRSCardData & { intervalDays: number; nextReviewDate: string; lastQuality: number } {
    const card = dbToCard(record);
    const rating = scoreToFSRSRating(overallScore);
    const now = new Date();

    const { card: nextCard } = fsrs.next(card, now, rating);

    const intervalDays = nextCard.scheduled_days;

    return {
        // FSRS fields
        fsrs_stability: nextCard.stability,
        fsrs_difficulty: nextCard.difficulty,
        fsrs_elapsed_days: nextCard.elapsed_days,
        fsrs_scheduled_days: nextCard.scheduled_days,
        fsrs_reps: nextCard.reps,
        fsrs_lapses: nextCard.lapses,
        fsrs_state: nextCard.state,
        fsrs_last_review: now.toISOString(),
        fsrs_due: nextCard.due.toISOString(), // Use what FSRS gives natively for due date

        // Shared compatibility fields used by UI and actions
        intervalDays,
        nextReviewDate: nextCard.due.toISOString().split('T')[0],
        lastQuality: rating,
    };
}

/**
 * Create initial FSRS card data for a problem that has never been reviewed.
 */
export function createNewFSRSCardData(): FSRSCardData {
    const emptyCard = createEmptyCard();
    return {
        fsrs_stability: emptyCard.stability,
        fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: emptyCard.elapsed_days,
        fsrs_scheduled_days: emptyCard.scheduled_days,
        fsrs_reps: emptyCard.reps,
        fsrs_lapses: emptyCard.lapses,
        fsrs_state: emptyCard.state,
        fsrs_last_review: null,
        fsrs_due: new Date().toISOString(),
    };
}
