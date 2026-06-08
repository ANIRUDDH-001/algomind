/**
 * @codesage
 * @description Interruption context builder to provide the AI model with what it was saying before being cut off.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

/**
 * Interruption context builder.
 *
 * When the user interrupts the AI mid-response, this utility builds a
 * concise prompt fragment that can be injected into the next AI turn so
 * the model is aware of what it was saying before being cut off.
 *
 * @module interruption-context
 */

/** Maximum characters of partial content to include in the prompt. */
const MAX_PARTIAL_LENGTH = 150;

/**
 * Build a context fragment describing an interrupted AI response.
 *
 * @param partialResponse - The text the AI had spoken before interruption.
 * @param interruptedAt   - Unix timestamp of the interruption.
 * @returns A short prompt fragment, or empty string if input is empty.
 */
export function buildInterruptionContext(
    partialResponse: string,
    _interruptedAt: number,
): string {
    if (!partialResponse || partialResponse.trim().length === 0) {
        return '';
    }

    // Truncate to avoid bloating the prompt
    const truncated =
        partialResponse.length > MAX_PARTIAL_LENGTH
            ? partialResponse.slice(0, MAX_PARTIAL_LENGTH).trimEnd() + '…'
            : partialResponse;

    return (
        `[INTERRUPTION CONTEXT] You were explaining: "${truncated}" ` +
        `but the user interrupted you. Briefly acknowledge what you were saying ` +
        `and address their new input. Do not repeat your previous explanation in full.`
    );
}

/**
 * Extract the portion of an AI response that was actually spoken (heard)
 * before the user interrupted.
 *
 * Since TTS processes text in sentence-level chunks, we estimate the
 * spoken portion by counting how many chunks could have been spoken
 * given the elapsed time since speech started.
 *
 * @param fullResponse   - The full AI response text.
 * @param speechStartMs  - Unix timestamp when speech began.
 * @param interruptionMs - Unix timestamp when interruption occurred.
 * @param avgChunkMs     - Average time to speak one chunk (default 3000ms).
 * @returns The estimated partial content that was heard.
 */
export function estimateSpokenContent(
    fullResponse: string,
    speechStartMs: number,
    interruptionMs: number,
    avgChunkMs = 3000,
): string {
    if (!fullResponse) return '';

    const elapsed = Math.max(0, interruptionMs - speechStartMs);
    const estimatedChunks = Math.max(1, Math.ceil(elapsed / avgChunkMs));

    // Split into sentences (rough approximation)
    const sentences = fullResponse.match(/[^.!?]+[.!?]+/g) || [fullResponse];
    const spokenSentences = sentences.slice(0, estimatedChunks);

    return spokenSentences.join('').trim();
}
