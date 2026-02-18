import { describe, test, expect } from 'vitest';
import { DSA_VOCABULARY } from '../vocabulary';

describe('DSA Vocabulary', () => {
    test('exports a non-empty array of strings', () => {
        expect(Array.isArray(DSA_VOCABULARY)).toBe(true);
        expect(DSA_VOCABULARY.length).toBeGreaterThan(0);
        expect(typeof DSA_VOCABULARY[0]).toBe('string');
    });
});
