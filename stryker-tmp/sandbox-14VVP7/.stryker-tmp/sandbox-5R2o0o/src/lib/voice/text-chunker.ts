/**
 * @codesage
 * @description Splits text into optimized chunks for the Speech Synthesis API to avoid timeouts and limits.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

/**
 * Splits text into optimized chunks for Speech Synthesis API.
 * The API has character limits and can timeout with long text.
 * We also want to avoid reading code blocks aloud.
 */

export function chunkTextForSpeech(text: string): string[] {
    if (!text) return [];

    // 1. First split by code blocks (```...```) to handle them separately
    // The regex captures the content including the backticks
    const parts = text.split(/(```[\s\S]*?```)/g);

    const chunks: string[] = [];

    parts.forEach(part => {
        // If it's a code block, we replace it with a placeholder phrase
        if (part.startsWith('```') && part.endsWith('```')) {
            chunks.push("I have provided the code implementation for this solution.");
            return;
        }

        // 2. Normal text: Split into sentences to keep chunks small (< 200 chars if possible)
        // Clean up markdown bold/italic markers which might mess up TTS
        const cleanText = part.replace(/[*_#]/g, '').trim();
        if (!cleanText) return;

        // Split by sentence boundaries (.?! followed by space or newline)
        // We use a lookbehind/lookahead or just simple regex split keeping delimiters
        const sentences = cleanText.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [cleanText];

        let currentChunk = '';

        sentences.forEach(sentence => {
            const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence.trim();

            // If adding this sentence keeps us under limit (200 chars soft limit), add it
            if (potentialChunk.length < 200) {
                currentChunk = potentialChunk;
            } else {
                // Otherwise push current chunk and start new one
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = sentence.trim();
            }
        });

        if (currentChunk) {
            chunks.push(currentChunk);
        }
    });

    return chunks;
}
