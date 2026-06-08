/**
 * @codesage
 * @file      src/lib/spaced-repetition/sm2.ts
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

/**
 * @deprecated SM-2 spaced repetition algorithm removed.
 * All scheduling now uses FSRS-5. See fsrs.ts.
 *
 * Types and utilities have been moved to types.ts.
 * This file is kept to prevent import errors in legacy test files
 * during the migration period. It will be deleted in a future cleanup.
 */

// Re-export from the new location so any remaining imports don't break
export type { SpacedRepetitionRecord } from './types';
export { formatNextReviewDate } from './types';

// computeNextReview is intentionally NOT re-exported.
// The SM-2 algorithm has been removed. Use computeNextReviewFSRS from fsrs.ts.
