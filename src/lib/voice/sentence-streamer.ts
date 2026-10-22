/**
 * @codesage
 * @file      src/lib/voice/sentence-streamer.ts
 * @purpose   Turn streamed LLM deltas into speakable sentences so TTS starts before generation finishes.
 * @tech      TypeScript
 * @connects  useInterview (chat SSE → SpeechQueue)
 * @apis      none
 * @db        none
 * @state     Per-reply buffer
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
const CONTROL_TOKENS = ['TERMINATE_INTERVIEW'];
const ABBREVIATION_END = /\b(e\.g|i\.e|etc|vs|approx|Dr|Mr|Mrs|Ms|No)\.$/i;
const MIN_CHARS = 12;
const MAX_CHARS = 220;
const FENCE = '```';

function split(text: string, final: boolean): { sentences: string[]; rest: string } {
    const sentences: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;
        const next = text[i + 1];
        if (next === undefined && !final) break;                              // need lookahead
        if (ch !== '\n' && next !== undefined && !/\s/.test(next)) continue;   // 1.5, O(n).x
        const candidate = text.slice(start, i + 1);
        if (!candidate.trim()) { start = i + 1; continue; }
        if (ch === '.' && ABBREVIATION_END.test(candidate.trim())) continue;
        // Merge short fragments ("Okay.") with the next sentence: always while streaming,
        // and on flush only if more text follows.
        const hasMore = text.slice(i + 1).trim().length > 0;
        if (candidate.trim().length < MIN_CHARS && ch !== '\n' && (hasMore || !final)) continue;
        sentences.push(candidate.trim());
        start = i + 1;
    }
    let rest = text.slice(start);
    while (rest.length > MAX_CHARS) {
        const win = rest.slice(0, MAX_CHARS);
        const comma = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
        const at = comma > 40 ? comma + 1 : win.lastIndexOf(' ');
        if (at <= 0) break;
        sentences.push(rest.slice(0, at).trim());
        rest = rest.slice(at);
    }
    if (final && rest.trim()) {
        sentences.push(rest.trim());
        rest = '';
    }
    return { sentences, rest };
}

export class SentenceStreamer {
    private buffer = '';
    private inFence = false;

    push(delta: string): string[] {
        this.buffer += delta ?? '';
        return this.drain(false);
    }

    flush(): string[] {
        return this.drain(true);
    }

    private drain(final: boolean): string[] {
        for (const t of CONTROL_TOKENS) this.buffer = this.buffer.split(t).join('');
        const out: string[] = [];
        for (;;) {
            if (this.inFence) {
                const close = this.buffer.indexOf(FENCE);
                if (close === -1) {
                    // Discard code, but keep a possible partial closing fence at the tail.
                    this.buffer = final ? '' : this.buffer.slice(-2);
                    break;
                }
                this.buffer = this.buffer.slice(close + FENCE.length);
                this.inFence = false;
                continue;
            }
            const open = this.buffer.indexOf(FENCE);
            if (open !== -1) {
                out.push(...split(this.buffer.slice(0, open), true).sentences);
                this.buffer = this.buffer.slice(open + FENCE.length);
                this.inFence = true;
                continue;
            }
            // Text without a terminator (incl. a partial control token or fence) stays buffered.
            const { sentences, rest } = split(this.buffer, final);
            out.push(...sentences);
            this.buffer = rest;
            break;
        }
        return out.map(s => s.replace(/^[-*•]\s+/, '').trim()).filter(s => s.length > 0);
    }
}
