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

// 
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
const fsrs = new FSRS(stryMutAct_9fa48("0") ? {} : (stryCov_9fa48("0"), {
  request_retention: 0.85,
  // 85% recall target (good for DSA — not too aggressive)
  maximum_interval: 180,
  // Keep 180-day max from original implementation
  enable_fuzz: stryMutAct_9fa48("1") ? false : (stryCov_9fa48("1"), true),
  // Slight randomness prevents review day clustering
  w: stryMutAct_9fa48("2") ? [] : (stryCov_9fa48("2"), [
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
  if (stryMutAct_9fa48("3")) {
    {}
  } else {
    stryCov_9fa48("3");
    if (stryMutAct_9fa48("7") ? score >= 4 : stryMutAct_9fa48("6") ? score <= 4 : stryMutAct_9fa48("5") ? false : stryMutAct_9fa48("4") ? true : (stryCov_9fa48("4", "5", "6", "7"), score < 4)) return Rating.Again as Grade;
    if (stryMutAct_9fa48("11") ? score >= 6 : stryMutAct_9fa48("10") ? score <= 6 : stryMutAct_9fa48("9") ? false : stryMutAct_9fa48("8") ? true : (stryCov_9fa48("8", "9", "10", "11"), score < 6)) return Rating.Hard as Grade;
    if (stryMutAct_9fa48("15") ? score >= 8 : stryMutAct_9fa48("14") ? score <= 8 : stryMutAct_9fa48("13") ? false : stryMutAct_9fa48("12") ? true : (stryCov_9fa48("12", "13", "14", "15"), score < 8)) return Rating.Good as Grade;
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
  if (stryMutAct_9fa48("16")) {
    {}
  } else {
    stryCov_9fa48("16");
    return stryMutAct_9fa48("17") ? {} : (stryCov_9fa48("17"), {
      due: record.fsrs_due ? new Date(record.fsrs_due) : new Date(),
      stability: stryMutAct_9fa48("20") ? record.fsrs_stability && 0 : stryMutAct_9fa48("19") ? false : stryMutAct_9fa48("18") ? true : (stryCov_9fa48("18", "19", "20"), record.fsrs_stability || 0),
      difficulty: stryMutAct_9fa48("23") ? record.fsrs_difficulty && 5 : stryMutAct_9fa48("22") ? false : stryMutAct_9fa48("21") ? true : (stryCov_9fa48("21", "22", "23"), record.fsrs_difficulty || 5),
      elapsed_days: stryMutAct_9fa48("26") ? record.fsrs_elapsed_days && 0 : stryMutAct_9fa48("25") ? false : stryMutAct_9fa48("24") ? true : (stryCov_9fa48("24", "25", "26"), record.fsrs_elapsed_days || 0),
      scheduled_days: stryMutAct_9fa48("29") ? record.fsrs_scheduled_days && 0 : stryMutAct_9fa48("28") ? false : stryMutAct_9fa48("27") ? true : (stryCov_9fa48("27", "28", "29"), record.fsrs_scheduled_days || 0),
      reps: stryMutAct_9fa48("32") ? record.fsrs_reps && 0 : stryMutAct_9fa48("31") ? false : stryMutAct_9fa48("30") ? true : (stryCov_9fa48("30", "31", "32"), record.fsrs_reps || 0),
      lapses: stryMutAct_9fa48("35") ? record.fsrs_lapses && 0 : stryMutAct_9fa48("34") ? false : stryMutAct_9fa48("33") ? true : (stryCov_9fa48("33", "34", "35"), record.fsrs_lapses || 0),
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
  if (stryMutAct_9fa48("36")) {
    {}
  } else {
    stryCov_9fa48("36");
    const card = dbToCard(record);
    const rating = scoreToFSRSRating(overallScore);
    const now = new Date();
    const {
      card: nextCard
    } = fsrs.next(card, now, rating);
    const intervalDays = nextCard.scheduled_days;
    return stryMutAct_9fa48("37") ? {} : (stryCov_9fa48("37"), {
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
      nextReviewDate: nextCard.due.toISOString().split(stryMutAct_9fa48("38") ? "" : (stryCov_9fa48("38"), 'T'))[0],
      lastQuality: rating
    });
  }
}

/**
 * Create initial FSRS card data for a problem that has never been reviewed.
 */
export function createNewFSRSCardData(): FSRSCardData {
  if (stryMutAct_9fa48("39")) {
    {}
  } else {
    stryCov_9fa48("39");
    const emptyCard = createEmptyCard();
    return stryMutAct_9fa48("40") ? {} : (stryCov_9fa48("40"), {
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