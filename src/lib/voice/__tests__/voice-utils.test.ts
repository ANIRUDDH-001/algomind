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
    });
});
