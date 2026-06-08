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
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { FSRS, Card, Grade, Rating, createEmptyCard, State } from 'ts-fsrs';

// FSRS instance with recommended settings for DSA problem review
const fsrs = new FSRS(stryMutAct_9fa48("2896") ? {} : (stryCov_9fa48("2896"), {
  request_retention: 0.85,
  // 85% recall target (good for DSA — not too aggressive)
  maximum_interval: 180,
  // Keep 180-day max from original implementation
  enable_fuzz: stryMutAct_9fa48("2897") ? false : (stryCov_9fa48("2897"), true),
  // Slight randomness prevents review day clustering
  w: stryMutAct_9fa48("2898") ? [] : (stryCov_9fa48("2898"), [
  // FSRS-6 default weights (full 21-parameter vector)
  // See: https://github.com/open-spaced-repetition/fsrs4anki/wiki
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0590, 1.5330, 0.1544, 1.0070, 1.9395, 0.1100, 0.2900, 2.3850, 0.1695, 2.9898, 0.5100, 0.6000, 0.0000, 0.0000])
}));
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
  if (stryMutAct_9fa48("2899")) {
    {}
  } else {
    stryCov_9fa48("2899");
    if (stryMutAct_9fa48("2903") ? score >= 4 : stryMutAct_9fa48("2902") ? score <= 4 : stryMutAct_9fa48("2901") ? false : stryMutAct_9fa48("2900") ? true : (stryCov_9fa48("2900", "2901", "2902", "2903"), score < 4)) return Rating.Again as Grade;
    if (stryMutAct_9fa48("2907") ? score >= 6 : stryMutAct_9fa48("2906") ? score <= 6 : stryMutAct_9fa48("2905") ? false : stryMutAct_9fa48("2904") ? true : (stryCov_9fa48("2904", "2905", "2906", "2907"), score < 6)) return Rating.Hard as Grade;
    if (stryMutAct_9fa48("2911") ? score >= 8 : stryMutAct_9fa48("2910") ? score <= 8 : stryMutAct_9fa48("2909") ? false : stryMutAct_9fa48("2908") ? true : (stryCov_9fa48("2908", "2909", "2910", "2911"), score < 8)) return Rating.Good as Grade;
    return Rating.Easy as Grade;
  }
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
  if (stryMutAct_9fa48("2912")) {
    {}
  } else {
    stryCov_9fa48("2912");
    return stryMutAct_9fa48("2913") ? {} : (stryCov_9fa48("2913"), {
      due: record.fsrs_due ? new Date(record.fsrs_due) : new Date(),
      stability: stryMutAct_9fa48("2916") ? record.fsrs_stability && 0 : stryMutAct_9fa48("2915") ? false : stryMutAct_9fa48("2914") ? true : (stryCov_9fa48("2914", "2915", "2916"), record.fsrs_stability || 0),
      difficulty: stryMutAct_9fa48("2919") ? record.fsrs_difficulty && 5 : stryMutAct_9fa48("2918") ? false : stryMutAct_9fa48("2917") ? true : (stryCov_9fa48("2917", "2918", "2919"), record.fsrs_difficulty || 5),
      elapsed_days: stryMutAct_9fa48("2922") ? record.fsrs_elapsed_days && 0 : stryMutAct_9fa48("2921") ? false : stryMutAct_9fa48("2920") ? true : (stryCov_9fa48("2920", "2921", "2922"), record.fsrs_elapsed_days || 0),
      scheduled_days: stryMutAct_9fa48("2925") ? record.fsrs_scheduled_days && 0 : stryMutAct_9fa48("2924") ? false : stryMutAct_9fa48("2923") ? true : (stryCov_9fa48("2923", "2924", "2925"), record.fsrs_scheduled_days || 0),
      reps: stryMutAct_9fa48("2928") ? record.fsrs_reps && 0 : stryMutAct_9fa48("2927") ? false : stryMutAct_9fa48("2926") ? true : (stryCov_9fa48("2926", "2927", "2928"), record.fsrs_reps || 0),
      lapses: stryMutAct_9fa48("2931") ? record.fsrs_lapses && 0 : stryMutAct_9fa48("2930") ? false : stryMutAct_9fa48("2929") ? true : (stryCov_9fa48("2929", "2930", "2931"), record.fsrs_lapses || 0),
      state: (record.fsrs_state || 0) as State,
      learning_steps: 0,
      // ↑ Intentional: AlgoMind does not use intra-day re-learning steps.
      // When a user fails a problem, it returns at the next scheduled session
      // (next_review_date) rather than multiple times within the same day.
      // If daily re-practice is added in future, store this in the DB and
      // populate from concept_states.learning_steps.
      last_review: record.fsrs_last_review ? new Date(record.fsrs_last_review) : undefined
    });
  }
}

/**
 * Compute next FSRS review schedule given current record and interview score.
 * Returns DB-ready fields to update.
 */
export function computeNextReviewFSRS(record: Partial<FSRSCardData>, overallScore: number): FSRSCardData & {
  intervalDays: number;
  nextReviewDate: string;
  lastQuality: number;
} {
  if (stryMutAct_9fa48("2932")) {
    {}
  } else {
    stryCov_9fa48("2932");
    const card = dbToCard(record);
    const rating = scoreToFSRSRating(overallScore);
    const now = new Date();
    const {
      card: nextCard
    } = fsrs.next(card, now, rating);
    const intervalDays = nextCard.scheduled_days;
    return stryMutAct_9fa48("2933") ? {} : (stryCov_9fa48("2933"), {
      // FSRS fields
      fsrs_stability: nextCard.stability,
      fsrs_difficulty: nextCard.difficulty,
      fsrs_elapsed_days: nextCard.elapsed_days,
      fsrs_scheduled_days: nextCard.scheduled_days,
      fsrs_reps: nextCard.reps,
      fsrs_lapses: nextCard.lapses,
      fsrs_state: nextCard.state,
      fsrs_last_review: now.toISOString(),
      fsrs_due: nextCard.due.toISOString(),
      // Use what FSRS gives natively for due date

      // Shared compatibility fields used by UI and actions
      intervalDays,
      nextReviewDate: nextCard.due.toISOString().split(stryMutAct_9fa48("2934") ? "" : (stryCov_9fa48("2934"), 'T'))[0],
      lastQuality: rating
    });
  }
}

/**
 * Create initial FSRS card data for a problem that has never been reviewed.
 */
export function createNewFSRSCardData(): FSRSCardData {
  if (stryMutAct_9fa48("2935")) {
    {}
  } else {
    stryCov_9fa48("2935");
    const emptyCard = createEmptyCard();
    return stryMutAct_9fa48("2936") ? {} : (stryCov_9fa48("2936"), {
      fsrs_stability: emptyCard.stability,
      fsrs_difficulty: emptyCard.difficulty,
      fsrs_elapsed_days: emptyCard.elapsed_days,
      fsrs_scheduled_days: emptyCard.scheduled_days,
      fsrs_reps: emptyCard.reps,
      fsrs_lapses: emptyCard.lapses,
      fsrs_state: emptyCard.state,
      fsrs_last_review: null,
      fsrs_due: new Date().toISOString()
    });
  }
}