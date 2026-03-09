import { describe, it, expect } from 'vitest';
import { preprocessForTTS, stripDevanagariForTTS } from '../tts-preprocessor';

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

describe('stripDevanagariForTTS', () => {
    it("removes Devanagari words and leaves English intact", () => {
        expect(stripDevanagariForTTS('hello नमस्ते world')).toBe('hello world');
    });

    it('leaves pure English text unchanged', () => {
        expect(stripDevanagariForTTS('pure english text')).toBe('pure english text');
    });

    it('strips leading Devanagari and returns the rest', () => {
        expect(stripDevanagariForTTS('यार binary search')).toBe('binary search');
    });

    it('handles an empty string safely', () => {
        expect(stripDevanagariForTTS('')).toBe('');
    });

    it('collapses multiple spaces into one', () => {
        expect(stripDevanagariForTTS('a  b')).toBe('a b');
    });
});
