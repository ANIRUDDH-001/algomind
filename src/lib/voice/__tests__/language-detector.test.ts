import { describe, it, expect } from 'vitest';
import {
    detectSpokenLanguage,
    containsDevanagari,
    HINGLISH_MARKERS,
} from '../language-detector';

describe('HINGLISH_MARKERS', () => {
    it('is an array of strings', () => {
        expect(Array.isArray(HINGLISH_MARKERS)).toBe(true);
        expect(HINGLISH_MARKERS.every((m) => typeof m === 'string')).toBe(true);
    });
});

describe('containsDevanagari', () => {
    it('returns false for plain English text', () => {
        expect(containsDevanagari('hello')).toBe(false);
    });

    it('returns true for Devanagari text', () => {
        expect(containsDevanagari('नमस्ते')).toBe(true);
    });
});

describe('detectSpokenLanguage', () => {
    it('classifies a pure English DSA response as english', () => {
        const text =
            'We can use binary search on the sorted array. ' +
            'The time complexity is O(log n) and space complexity is O(1).';
        expect(detectSpokenLanguage(text)).toBe('english');
    });

    it('classifies pure Devanagari text as hinglish', () => {
        expect(detectSpokenLanguage('यह बाइनरी सर्च है')).toBe('hinglish');
    });

    it('classifies a sentence with multiple markers as hinglish', () => {
        expect(
            detectSpokenLanguage('yaar yeh binary search ka approach kya hai')
        ).toBe('hinglish');
    });

    it('classifies a sentence with filler markers as hinglish', () => {
        expect(
            detectSpokenLanguage('matlab basically toh O(n log n) hoga')
        ).toBe('hinglish');
    });

    it('classifies a single common English word with no markers as english', () => {
        expect(detectSpokenLanguage('okay')).toBe('english');
    });

    it('classifies a short sentence with one marker as hinglish', () => {
        // "acha" is 1 marker, and the sentence is < 60 chars
        expect(
            detectSpokenLanguage('acha so the two pointer approach...')
        ).toBe('hinglish');
    });

    it('classifies an empty string as english', () => {
        expect(detectSpokenLanguage('')).toBe('english');
    });
});
