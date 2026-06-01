/**
 * @codesage
 * @description Tests for text preprocessing logic targeting spoken audio adjustments.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 * @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { preprocessForTTS } from '../tts-preprocessor';

describe('preprocessForTTS', () => {
    it("converts O(n^2) to 'O of N squared'", () => {
        expect(preprocessForTTS('O(n^2)')).toBe('O of N squared');
    });

    it("expands BFS acronym to 'breadth first search'", () => {
        expect(preprocessForTTS('use BFS here')).toBe('use breadth first search here');
    });

    it('strips Devanagari and converts Big-O in a mixed sentence', () => {
        const result = preprocessForTTS('basically यह O(n) approach है');
        // Must not contain any Devanagari character
        expect(/[\u0900-\u097F]/.test(result)).toBe(false);
        // O(n) must be expanded
        expect(result).toContain('O of N');
        // English words should survive
        expect(result).toContain('basically');
        expect(result).toContain('approach');
    });
});
