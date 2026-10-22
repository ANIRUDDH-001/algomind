/**
 * @codesage
 * @file      src/lib/voice/turn-timeline.ts
 * @purpose   Per-turn voice timeline (VAD→STT→commit→LLM→TTS) shipped to system_events so every voice bug has numbers.
 * @tech      TypeScript, Beacon API
 * @connects  useInterview; POST /api/voice/telemetry
 * @apis      /api/voice/telemetry
 * @db        system_events (via route)
 * @state     Module-level send buffer
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
export type TurnStage = 'vad_end' | 'stt_start' | 'stt_done' | 'commit' | 'chat_request' | 'first_token'
    | 'first_sentence' | 'first_audio' | 'speech_done' | 'mic_rearmed' | 'error';

export interface TurnTimelinePayload {
    sessionId: string | null;
    turn: number;
    outcome: 'spoken' | 'text-only' | 'aborted' | 'error';
    stages: Partial<Record<TurnStage, number>>;
    derived: { turnGapMs: number | null; sttMs: number | null; commitWaitMs: number | null; ttftMs: number | null; ttfaMs: number | null };
    details: Record<string, unknown>;
    ua: string;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class TurnTimeline {
    private t: Partial<Record<TurnStage, number>> = {};
    private details: Record<string, unknown> = {};
    constructor(private sessionId: string | null, private turn: number) {}

    mark(stage: TurnStage, data?: Record<string, unknown>): void {
        if (this.t[stage] === undefined) this.t[stage] = now();
        if (data) Object.assign(this.details, data);
    }

    has(stage: TurnStage): boolean {
        return this.t[stage] !== undefined;
    }

    detail(key: string): unknown {
        return this.details[key];
    }

    finish(outcome: TurnTimelinePayload['outcome']): TurnTimelinePayload {
        const base = this.t.vad_end ?? this.t.commit ?? this.t.chat_request ?? now();
        const rel: Partial<Record<TurnStage, number>> = {};
        for (const [k, v] of Object.entries(this.t)) rel[k as TurnStage] = Math.round((v as number) - base);
        const d = (a: TurnStage, b: TurnStage) => (this.t[a] !== undefined && this.t[b] !== undefined ? Math.round(this.t[b]! - this.t[a]!) : null);
        const payload: TurnTimelinePayload = {
            sessionId: this.sessionId, turn: this.turn, outcome, stages: rel,
            derived: { turnGapMs: d('vad_end', 'first_audio'), sttMs: d('stt_start', 'stt_done'), commitWaitMs: d('stt_done', 'commit'), ttftMs: d('chat_request', 'first_token'), ttfaMs: d('first_sentence', 'first_audio') },
            details: this.details,
            ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'server',
        };
        console.info(`[PIPE][TURN] #${this.turn} ${outcome} gap=${payload.derived.turnGapMs}ms stt=${payload.derived.sttMs} wait=${payload.derived.commitWaitMs} ttft=${payload.derived.ttftMs} ttfa=${payload.derived.ttfaMs}`);
        return payload;
    }
}

const buffer: TurnTimelinePayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function sendVoiceTelemetry(payloads: TurnTimelinePayload[]): void {
    buffer.push(...payloads);
    if (buffer.length >= 5) { flush(); return; }
    if (!flushTimer) flushTimer = setTimeout(flush, 10_000);
}

export function flush(): void {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!buffer.length || typeof window === 'undefined') return;
    const body = JSON.stringify({ events: buffer.splice(0, 20) });
    const ok = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/voice/telemetry', new Blob([body], { type: 'application/json' }));
    if (!ok) void fetch('/api/voice/telemetry', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    if (buffer.length) flush();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
