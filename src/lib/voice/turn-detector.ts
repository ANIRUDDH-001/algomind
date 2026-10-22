/**
 * @codesage
 * @file      src/lib/voice/turn-detector.ts
 * @purpose   Decide when the candidate has finished their turn, from transcript content + silence length.
 * @tech      TypeScript
 * @connects  useInterview turn-commit scheduler
 * @apis      none
 * @db        none
 * @state     none (pure)
 * @env       none
 * @issues    Stage 2 replaces the text heuristic with Smart Turn v3 (audio prosody)
 * @audit     CODESAGE-v1
 */
export const TURN_TIMING = { completeMs: 900, incompleteMs: 2800, fillerOnlyMs: 4000 } as const;

const FILLER_ONLY = /^(um+|uh+|hmm+|er+|erm|okay|ok|so|well|right|let me think|let me see|give me a (second|sec|moment))[\s.,!?…]*$/i;
const TRAILING_INCOMPLETE = new RegExp(
    '(' + [
        '\\b(and|or|but|so|because|then|if|when|while|which|that|where|whether)',
        '\\b(the|a|an|to|of|in|on|with|for|from|by|like|than|into)',
        '\\b(is|are|was|were|be|would|will|can|could|should|might|must|do|does)',
        '\\b(we|i|my|its)',   // not it/this/these/those — "…store it." is a complete sentence
        '\\b(um+|uh+|hmm+|er+|basically|actually|i mean|for example|such as|let me (think|see))',
    ].join('|') + ')[\\s,]*$', 'i');

export function requiredSilenceMs(transcript: string): number {
    const t = (transcript ?? '').trim();
    if (!t) return Infinity;
    if (FILLER_ONLY.test(t)) return TURN_TIMING.fillerOnlyMs;
    if (/(\.\.\.|…)$/.test(t) || /[,;:\-–—]$/.test(t)) return TURN_TIMING.incompleteMs;
    // Whisper often closes a trailing fragment with a period ("So the approach would be.").
    if (TRAILING_INCOMPLETE.test(t.replace(/[.!?]+$/, ''))) return TURN_TIMING.incompleteMs;
    return TURN_TIMING.completeMs;
}

export function decideTurn({ transcript, silenceMs }: { transcript: string; silenceMs: number }):
    { action: 'commit' } | { action: 'wait'; remainingMs: number } {
    const need = requiredSilenceMs(transcript);
    if (!Number.isFinite(need)) return { action: 'wait', remainingMs: Infinity };
    return silenceMs >= need ? { action: 'commit' } : { action: 'wait', remainingMs: need - silenceMs };
}
