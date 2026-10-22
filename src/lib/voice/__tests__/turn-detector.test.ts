/**
 * @codesage
 * @file      src/lib/voice/__tests__/turn-detector.test.ts
 * @purpose   Turn detector — commit fast on complete sentences, wait longer on trailing / filler speech.
 * @tech      Vitest
 * @connects  ../turn-detector
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect } from 'vitest';
import { decideTurn, requiredSilenceMs, TURN_TIMING } from '../turn-detector';

describe('turn detector', () => {
    it('commits a complete sentence after a short silence', () => {
        expect(requiredSilenceMs('I would use a hash map to store the complements.')).toBe(TURN_TIMING.completeMs);
        expect(decideTurn({ transcript: 'What are the constraints?', silenceMs: 1500 })).toEqual({ action: 'commit' });
    });
    it('waits longer when the candidate trails off mid-thought', () => {
        for (const t of ['So the approach would be', 'I think we can sort it and', 'Let me think', 'um', 'The time complexity is...', 'First, we iterate,']) {
            expect(requiredSilenceMs(t)).toBeGreaterThanOrEqual(TURN_TIMING.incompleteMs);
        }
        expect(decideTurn({ transcript: 'So the approach would be', silenceMs: 1500 })).toEqual({ action: 'wait', remainingMs: TURN_TIMING.incompleteMs - 1500 });
    });
    it('treats a Whisper-added period after a trailing word as incomplete', () => {
        expect(requiredSilenceMs('So the approach would be.')).toBe(TURN_TIMING.incompleteMs);
        expect(requiredSilenceMs('We can just store it.')).toBe(TURN_TIMING.completeMs);
    });
    it('filler-only utterances wait the longest', () => {
        expect(requiredSilenceMs('Hmm.')).toBe(TURN_TIMING.fillerOnlyMs);
    });
    it('never commits an empty transcript', () => {
        expect(decideTurn({ transcript: '   ', silenceMs: 99_999 })).toEqual({ action: 'wait', remainingMs: Infinity });
    });
});
