import { describe, it, expect } from 'vitest';
import { preprocessForTTS } from '../tts-preprocessor';
import { calculateSpeakingDuration, splitIntoSpeakableChunks, MAX_CHUNK_LENGTH } from '../voice-utils';

describe('Voice Utilities', () => {

    describe('tts-preprocessor.ts', () => {
        it('1. Code blocks replaced with "code block" or equivalent spoken form', () => {
            const input = 'Here is a ```function main() {}``` and an inline `const x = 1` var.';
            const result = preprocessForTTS(input);
            expect(result).toContain('Here is a code block and an inline code block var.');
        });

        it('2. Markdown bold/italic syntax stripped before speaking', () => {
            const input = 'This is **bold** and *italic* and __underline__ and _also italic_.';
            const result = preprocessForTTS(input);
            expect(result).toBe('This is bold and italic and underline and also italic.');
        });

        it('3. URLs replaced with "link" or omitted', () => {
            const input = 'Check out https://example.com/page?id=123 for details.';
            const result = preprocessForTTS(input);
            expect(result).toBe('Check out link for details.');
        });

        it('4. Numbered lists converted to speakable format', () => {
            const input = 'Here are steps:\n1. First step\n2. Second step';
            const result = preprocessForTTS(input);
            // Matches our ' $1 ' Regex replacements
            expect(result).toBe('Here are steps:\n 1 First step\n 2 Second step');
        });

        it('5. LaTeX/math expressions handled gracefully (not spoken as raw LaTeX)', () => {
            const input = 'The math $x = y^2$ and inline \\( x \\) and block \\[ y \\]';
            const result = preprocessForTTS(input);
            expect(result).toBe('The math x = y^2 and inline  x  and block  y ');
        });

        it('6. Empty string -> empty string returned', () => {
            const input = '';
            const result = preprocessForTTS(input);
            expect(result).toBe('');
        });
    });

    describe('voice-utils.ts', () => {
        it('1. calculateSpeakingDuration(text): reasonable estimate for typical sentences', () => {
            const text = 'This is a normal sentence with seven words.';
            // 8 words / 2.5 wps = 3.2 seconds = 3200ms
            const duration = calculateSpeakingDuration(text);
            expect(duration).toBe(3200);

            expect(calculateSpeakingDuration('')).toBe(0);
        });

        it('2. splitIntoSpeakableChunks(text): no chunk exceeds MAX_CHUNK_LENGTH', () => {
            const longText = 'A'.repeat(MAX_CHUNK_LENGTH + 50);
            const chunks = splitIntoSpeakableChunks(longText);

            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach(chunk => {
                expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
            });
        });

        it('3. All returned chunks together reconstruct the original text (minus whitespace normalization)', () => {
            const original = 'First sentence. Second sentence! Third sentence? Yes.';
            const chunks = splitIntoSpeakableChunks(original);

            const reconstructed = chunks.join(' ');

            // Should match ignoring varying spaces
            expect(reconstructed.replace(/\s+/g, '')).toBe(original.replace(/\s+/g, ''));
        });

        it('4. calculateSpeakingDuration: returns 0 for falsy input', () => {
            expect(calculateSpeakingDuration(null as unknown as string)).toBe(0);
            expect(calculateSpeakingDuration(undefined as unknown as string)).toBe(0);
        });

        it('5. calculateSpeakingDuration: collapses multiple spaces (2 words = 800ms)', () => {
            expect(calculateSpeakingDuration('hello     world')).toBe(800);
        });

        it('6. splitIntoSpeakableChunks: returns [] for empty/null input', () => {
            expect(splitIntoSpeakableChunks('')).toEqual([]);
            expect(splitIntoSpeakableChunks(null as unknown as string)).toEqual([]);
        });

        it('7. splitIntoSpeakableChunks: short text returns single chunk without splitting', () => {
            const result = splitIntoSpeakableChunks('Hello! How are you?');
            expect(result).toHaveLength(1);
        });

        it('8. splitIntoSpeakableChunks: no empty string chunks produced', () => {
            const text = 'First. Second. Third.';
            splitIntoSpeakableChunks(text).forEach(c => {
                expect(c.length).toBeGreaterThan(0);
            });
        });

        it('9. splitIntoSpeakableChunks: handles sentence with no ending punctuation', () => {
            const result = splitIntoSpeakableChunks('This sentence has no punctuation at the end');
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result.join('')).toContain('punctuation');
        });
    });
});

// ─── Standalone: getProcesedVoices and findBestMatchingVoice ─────────────────

import {
    getProcesedVoices,
    findBestMatchingVoice,
} from '../voice-utils';

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
    return { name, lang, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

describe('getProcesedVoices()', () => {
    it('returns [] for empty array', () => {
        expect(getProcesedVoices([])).toEqual([]);
    });

    it('returns [] for null input (falsy guard)', () => {
        expect(getProcesedVoices(null as unknown as SpeechSynthesisVoice[])).toEqual([]);
    });

    it('filters non-English voices', () => {
        const voices = [
            makeVoice('French', 'fr-FR'),
            makeVoice('English US', 'en-US'),
        ];
        expect(getProcesedVoices(voices)).toHaveLength(1);
        expect(getProcesedVoices(voices)[0].lang).toBe('en-US');
    });

    it('filters out hi-IN voices', () => {
        expect(getProcesedVoices([makeVoice('Hindi', 'hi-IN')])).toHaveLength(0);
    });

    it('deduplicates voices with the same normalised name', () => {
        const voices = [
            makeVoice('Google US English', 'en-US'),
            makeVoice('Google US English (Network)', 'en-US'),
        ];
        expect(getProcesedVoices(voices)).toHaveLength(1);
    });

    it('sorts en-US → en-GB → others', () => {
        const voices = [
            makeVoice('A', 'en-AU'),
            makeVoice('G', 'en-GB'),
            makeVoice('U', 'en-US'),
        ];
        const result = getProcesedVoices(voices);
        expect(result[0].lang).toBe('en-US');
        expect(result[1].lang).toBe('en-GB');
    });

    it('caps output at 8 voices when many are available', () => {
        const voices = Array.from({ length: 20 }, (_, i) => makeVoice(`Voice ${i}`, 'en-US'));
        expect(getProcesedVoices(voices).length).toBeLessThanOrEqual(8);
    });

    it('preserves locale diversity when trimming', () => {
        const voices = [
            ...Array.from({ length: 6 }, (_, i) => makeVoice(`US ${i}`, 'en-US')),
            makeVoice('British', 'en-GB'),
            makeVoice('Australian', 'en-AU'),
        ];
        const result = getProcesedVoices(voices);
        const langs = result.map(v => v.lang);
        expect(langs).toContain('en-GB');
    });
});

describe('findBestMatchingVoice()', () => {
    const voices = [
        makeVoice('Google US English', 'en-US'),
        makeVoice('Microsoft Zira', 'en-US'),
        makeVoice('English GB', 'en-GB'),
        makeVoice('Generic', 'en-AU'),
    ];

    it('returns null for empty voices array', () => {
        expect(findBestMatchingVoice([], 'Any')).toBeNull();
    });

    it('returns exact name match when available', () => {
        expect(findBestMatchingVoice(voices, 'Microsoft Zira')?.name).toBe('Microsoft Zira');
    });

    it('falls back to Google US English when no exact match', () => {
        expect(findBestMatchingVoice(voices, 'Nonexistent')?.name).toBe('Google US English');
    });

    it('falls back to Microsoft Zira when Google is absent', () => {
        const noGoogle = voices.filter(v => !v.name.includes('Google'));
        expect(findBestMatchingVoice(noGoogle, null)?.name).toBe('Microsoft Zira');
    });

    it('falls back to en-US lang when Google and Zira absent', () => {
        const minimal = [makeVoice('Plain US', 'en-US')];
        expect(findBestMatchingVoice(minimal, null)?.lang).toBe('en-US');
    });

    it('falls back to en-* when en-US absent', () => {
        const onlyGB = [makeVoice('British', 'en-GB')];
        expect(findBestMatchingVoice(onlyGB, null)?.lang).toBe('en-GB');
    });

    it('falls back to first voice when no English available', () => {
        const onlyFrench = [makeVoice('French', 'fr-FR')];
        expect(findBestMatchingVoice(onlyFrench, null)?.name).toBe('French');
    });

    it('returns first voice as absolute last resort', () => {
        const obscure = [makeVoice('Klingon', 'x-KL')];
        expect(findBestMatchingVoice(obscure, null)?.name).toBe('Klingon');
    });

    it('handles null preferredName without crashing', () => {
        expect(() => findBestMatchingVoice(voices, null)).not.toThrow();
    });
});
