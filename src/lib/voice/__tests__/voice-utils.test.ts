import { describe, test, expect } from 'vitest';
import { getProcesedVoices, findBestMatchingVoice } from '../voice-utils';

// Helper to create mock voice
const createVoice = (name: string, lang: string, defaultVoice = false): SpeechSynthesisVoice => ({
    name,
    lang,
    default: defaultVoice,
    localService: true,
    voiceURI: name,
});

describe('voice-utils', () => {
    describe('getProcesedVoices', () => {
        test('returns empty array for empty input', () => {
            expect(getProcesedVoices([])).toEqual([]);
        });

        test('filters out non-target languages', () => {
            const voices = [
                createVoice('English Voice', 'en-US'),
                createVoice('Spanish Voice', 'es-ES'), // Should be filtered out
                createVoice('Hindi Voice', 'hi-IN'),
            ];
            const processed = getProcesedVoices(voices);
            expect(processed).toHaveLength(2);
            expect(processed.map(v => v.lang)).toContain('en-US');
            expect(processed.map(v => v.lang)).toContain('hi-IN');
        });

        test('sorts by priority: US -> GB -> IN -> HI', () => {
            const voices = [
                createVoice('Hindi', 'hi-IN'),
                createVoice('Indian English', 'en-IN'),
                createVoice('British', 'en-GB'),
                createVoice('American', 'en-US'),
            ];
            const processed = getProcesedVoices(voices);
            const langs = processed.map(v => v.lang);
            expect(langs).toEqual(['en-US', 'en-GB', 'en-IN', 'hi-IN']);
        });

        test('deduplicates exact matches', () => {
            const v1 = createVoice('Voice A', 'en-US');
            const v2 = createVoice('Voice A', 'en-US');
            const processed = getProcesedVoices([v1, v2]);
            expect(processed).toHaveLength(1);
        });

        test('keeps distinct voices', () => {
            const v1 = createVoice('Voice A', 'en-US');
            const v2 = createVoice('Voice B', 'en-US');
            expect(getProcesedVoices([v1, v2])).toHaveLength(2);
        });

        test('limits to 8 voices but ensures diversity', () => {
            const voices = [
                // 10 US voices
                ...Array.from({ length: 10 }, (_, i) => createVoice(`US Voice ${i}`, 'en-US')),
                // 1 Hindi voice
                createVoice('Hindi Voice', 'hi-IN'),
            ];

            const processed = getProcesedVoices(voices);
            expect(processed).toHaveLength(8); // limit is 8
            // Should contain the Hindi voice
            expect(processed.some(v => v.lang === 'hi-IN')).toBe(true);
        });
    });

    describe('findBestMatchingVoice', () => {
        test('returns null for empty list', () => {
            expect(findBestMatchingVoice([], 'foo')).toBeNull();
        });

        test('returns exact match', () => {
            const v1 = createVoice('Voice A', 'en-US');
            const v2 = createVoice('Voice B', 'en-US');
            expect(findBestMatchingVoice([v1, v2], 'Voice B')).toBe(v2);
        });

        test('falls back to Google US English', () => {
            const v1 = createVoice('Microsoft Zira', 'en-US');
            const v2 = createVoice('Google US English', 'en-US');
            expect(findBestMatchingVoice([v1, v2], 'Non Existent')).toBe(v2); // Google preferred
        });

        test('falls back to Microsoft Zira if Google missing', () => {
            const v1 = createVoice('Microsoft Zira', 'en-US');
            const v2 = createVoice('Other', 'en-GB');
            expect(findBestMatchingVoice([v1, v2], 'Non Existent')).toBe(v1);
        });

        test('falls back to any en-US', () => {
            const v1 = createVoice('Other', 'en-US');
            expect(findBestMatchingVoice([v1], 'Non Existent')).toBe(v1);
        });

        test('falls back to any English', () => {
            const v1 = createVoice('Other', 'en-GB');
            expect(findBestMatchingVoice([v1], 'Non Existent')).toBe(v1);
        });

        test('falls back to first available as last resort', () => {
            const v1 = createVoice('Unknown', 'fr-FR');
            expect(findBestMatchingVoice([v1], 'Non Existent')).toBe(v1);
        });
    });
});
