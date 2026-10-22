/**
 * @codesage
 * @file      src/components/voice/VoiceCheckClient.tsx
 * @purpose   /voice-check self-test: mic → speech detection → transcription → speaker, each ✓/✗ with a fix hint, plus a copyable JSON report.
 * @tech      React, Web Audio (level meter), Web Speech (via SpeechQueue)
 * @connects  MicController + createBrowserVad (same mic path as interviews), getSpeechQueue, transcribeVoiceAudio, float32ToWav
 * @apis      POST /api/voice/transcribe
 * @db        none
 * @state     Row results, mic level, transcript, chosen voice, "did you hear it" answer
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api/client';
import { transcribeVoiceAudio } from '@/lib/api/adapters/voice-adapter';
import { MicController, createBrowserVad } from '@/lib/voice/mic-controller';
import { getSpeechQueue, type SpeechQueueEvent } from '@/lib/voice/speech-queue';
import { float32ToWav } from '@/lib/voice/wav';

type RowId = 'mic' | 'speech' | 'transcription' | 'speaker';
type RowStatus = 'idle' | 'running' | 'pass' | 'fail' | 'skipped';
interface RowResult { status: RowStatus; value?: string; ms?: number; detail?: string; hint?: string }
type Rows = Record<RowId, RowResult>;

const ROWS: { id: RowId; label: string; prompt: string }[] = [
    { id: 'mic', label: 'Microphone', prompt: 'Allow the microphone if the browser asks.' },
    { id: 'speech', label: 'Speech detection', prompt: 'Say: “testing one two three”' },
    { id: 'transcription', label: 'Transcription', prompt: 'Turning what you said into text…' },
    { id: 'speaker', label: 'Speaker', prompt: 'Listen for Kai.' },
];

const SPEECH_TIMEOUT_MS = 10_000;
const SPEAKER_TIMEOUT_MS = 8_000;
const KAI_LINE = "This is Kai. If you can hear me, you're all set.";
const SOUND_HINT = "Check your sound output: on Windows, Settings → System → Sound → Output (pick your speakers or headphones), and make sure this tab isn't muted.";

const idleRows = (): Rows => ({ mic: { status: 'idle' }, speech: { status: 'idle' }, transcription: { status: 'idle' }, speaker: { status: 'idle' } });

function micHint(err: unknown): string {
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Allow microphone in the address bar (the mic icon), then run the check again.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found. Plug one in, or choose it in your system sound settings.';
    if (name === 'NotReadableError' || name === 'AbortError') return 'Another app is using the microphone (Zoom, Teams, another tab). Close it and retry.';
    return 'This browser could not open a microphone here. Use Chrome on this site and retry.';
}

/** RMS level of the mic stream (0–1), ~15 updates/s. Returns a stop function; no-op without Web Audio. */
function startLevelMeter(stream: MediaStream, onLevel: (v: number) => void): () => void {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return () => {};
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
        if (t - last > 66) { onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4)); last = t; }
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); source.disconnect(); void ctx.close(); onLevel(0); };
}

const ICON: Record<RowStatus, string> = { idle: '○', running: '…', pass: '✓', fail: '✗', skipped: '—' };
const STATUS_LABEL: Record<RowStatus, string> = { idle: 'Not run', running: 'Running', pass: 'Passed', fail: 'Failed', skipped: 'Skipped' };

export function VoiceCheckClient() {
    const [rows, setRows] = useState<Rows>(idleRows);
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [level, setLevel] = useState(0);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [voice, setVoice] = useState<string | null>(null);
    const [heard, setHeard] = useState<boolean | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

    const runIdRef = useRef(0);
    const cleanupsRef = useRef<Array<() => void>>([]);
    const releaseAll = useCallback(() => {
        const fns = cleanupsRef.current;
        cleanupsRef.current = [];
        fns.forEach(fn => { try { fn(); } catch { /* best effort */ } });
    }, []);

    // Leaving the page mid-check must not leave the mic open or Kai talking.
    useEffect(() => () => { runIdRef.current++; releaseAll(); }, [releaseAll]);

    const run = useCallback(() => {
        const runId = ++runIdRef.current;
        const alive = () => runIdRef.current === runId;
        releaseAll(); // before unlock(): releasing a previous run stops the queue, which would cancel the unlock
        // Synchronous inside the click: Chrome only lets speech play after a user gesture.
        const queue = getSpeechQueue();
        queue.unlock();

        setRows(idleRows());
        setRunning(true); setFinished(false); setTranscript(null); setVoice(null); setHeard(null); setCopyState('idle');
        const set = (id: RowId, r: RowResult) => { if (alive()) setRows(prev => ({ ...prev, [id]: r })); };

        void (async () => {
            // ── 1. Microphone ───────────────────────────────────────
            set('mic', { status: 'running' });
            let stream: MediaStream | null = null;
            let stopMeter = () => {};
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('getUserMedia unavailable', 'NotSupportedError');
                const t0 = performance.now();
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const label = stream.getAudioTracks()[0]?.label || 'Default microphone';
                set('mic', { status: 'pass', value: label, ms: Math.round(performance.now() - t0) });
                stopMeter = startLevelMeter(stream, v => { if (alive()) setLevel(v); });
                const s = stream;
                cleanupsRef.current.push(() => { stopMeter(); s.getTracks().forEach(t => t.stop()); });
            } catch (e) {
                set('mic', { status: 'fail', hint: micHint(e), detail: (e as Error)?.name });
            }
            if (!alive()) return;

            // ── 2. Speech detection (the interview's own mic + Silero VAD path) ──
            let audio: Float32Array | null = null;
            if (!stream) {
                set('speech', { status: 'skipped', hint: 'Needs the microphone.' });
                set('transcription', { status: 'skipped', hint: 'Needs the microphone.' });
            } else {
                set('speech', { status: 'running' });
                let mic: MicController | null = null;
                let timer: ReturnType<typeof setTimeout> | undefined;
                const t0 = performance.now();
                try {
                    audio = await new Promise<Float32Array>((resolve, reject) => {
                        timer = setTimeout(() => reject(new Error('timeout')), SPEECH_TIMEOUT_MS);
                        mic = new MicController({
                            createVad: createBrowserVad,
                            onSpeechEnd: a => resolve(a),
                            onStatus: (s, detail) => { if (s === 'failed') reject(new Error(detail || 'VAD failed')); },
                        });
                        const m = mic;
                        cleanupsRef.current.push(() => { void m.dispose(); });
                        void mic.setIntent('listen');
                    });
                    set('speech', { status: 'pass', value: `${(audio.length / 16000).toFixed(1)} s of speech captured`, ms: Math.round(performance.now() - t0) });
                } catch (e) {
                    const timedOut = (e as Error).message === 'timeout';
                    set('speech', {
                        status: 'fail',
                        detail: timedOut ? undefined : (e as Error).message,
                        hint: timedOut
                            ? 'No speech heard in 10 s. Speak louder or closer, or check the input device in your system sound settings.'
                            : 'Speech detection could not start. Reload the page and run the check again.',
                    });
                    set('transcription', { status: 'skipped', hint: 'Needs speech detection.' });
                } finally {
                    clearTimeout(timer);
                    if (mic) await (mic as MicController).dispose();
                    stopMeter();
                    stream.getTracks().forEach(t => t.stop());
                }
                if (!alive()) return;

                // ── 3. Transcription ────────────────────────────────
                if (audio) {
                    set('transcription', { status: 'running' });
                    const t1 = performance.now();
                    try {
                        const form = new FormData();
                        form.append('audio', new Blob([float32ToWav(audio, 16000)], { type: 'audio/wav' }), 'audio.wav');
                        const res = await transcribeVoiceAudio(form);
                        const ms = Math.round(performance.now() - t1);
                        const text = (res.text ?? '').trim();
                        const detail = res.timing ? `server ${res.timing.preMs} ms prep + ${res.timing.groqMs} ms Whisper${res.model ? ` (${res.model})` : ''}` : res.model;
                        if (alive()) setTranscript(text);
                        set('transcription', text
                            ? { status: 'pass', value: `“${text}”`, ms, detail }
                            : { status: 'fail', ms, detail, hint: 'Nothing was recognised. Speak a little louder and closer to the mic.' });
                    } catch (e) {
                        const status = e instanceof ApiClientError ? e.status : undefined;
                        set('transcription', {
                            status: 'fail',
                            detail: (e as Error)?.message,
                            hint: status === 429
                                ? 'Too many checks in a row. Wait a minute and retry.'
                                : 'The transcription service could not be reached. Check your connection and retry.',
                        });
                    }
                }
            }
            if (!alive()) return;

            // ── 4. Speaker (independent of the mic) ─────────────────
            set('speaker', { status: 'running' });
            let unsubscribe = () => {};
            let timer: ReturnType<typeof setTimeout> | undefined;
            let note: string | undefined;
            try {
                const first = await new Promise<{ latencyMs: number; voice: string | null }>((resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('timeout')), SPEAKER_TIMEOUT_MS);
                    unsubscribe = queue.on((e: SpeechQueueEvent) => {
                        if (e.type === 'first-audio') resolve({ latencyMs: e.latencyMs, voice: e.voice });
                        else if (e.type === 'blocked') reject(new Error('blocked'));
                        else if (e.type === 'error' && e.code === 'no-english-voice') note = 'No English voice installed — Kai may sound wrong. Add one in your system speech settings.';
                        else if (e.type === 'error') reject(new Error(e.code));
                    });
                    cleanupsRef.current.push(() => { unsubscribe(); queue.stop(); });
                    queue.enqueue(KAI_LINE);
                });
                if (alive()) setVoice(first.voice);
                set('speaker', { status: 'pass', value: first.voice ?? 'Default voice', ms: first.latencyMs, hint: note });
            } catch (e) {
                const code = (e as Error).message;
                set('speaker', {
                    status: 'fail',
                    detail: code === 'timeout' || code === 'blocked' ? undefined : code,
                    hint: code === 'blocked'
                        ? 'Your browser blocked audio. Click “Run check” again.'
                        : code === 'timeout'
                            ? `No audio started within 8 s. ${SOUND_HINT}`
                            : `The speech engine failed. ${SOUND_HINT}`,
                });
            } finally {
                clearTimeout(timer);
                unsubscribe();
            }
            if (alive()) { setRunning(false); setFinished(true); }
        })();
    }, [releaseAll]);

    const answerHeard = (yes: boolean) => {
        setHeard(yes);
        if (!yes) setRows(prev => ({ ...prev, speaker: { ...prev.speaker, status: 'fail', hint: SOUND_HINT } }));
    };

    const copyReport = () => {
        const report = {
            at: new Date().toISOString(),
            browser: navigator.userAgent,
            voices: typeof window !== 'undefined' ? window.speechSynthesis?.getVoices?.().length ?? 0 : 0,
            chosenVoice: voice,
            transcript,
            heard,
            rows: ROWS.map(r => ({ id: r.id, status: rows[r.id].status, ms: rows[r.id].ms ?? null, value: rows[r.id].value ?? null, detail: rows[r.id].detail ?? null })),
        };
        navigator.clipboard.writeText(JSON.stringify(report))
            .then(() => setCopyState('copied'))
            .catch(() => setCopyState('failed'));
    };

    return (
        <div className="w-full max-w-2xl mx-auto py-8 lg:py-12">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Voice check</h1>
            <p className="mt-2 text-sm text-zinc-400">
                Tests your microphone, speech detection, transcription and speaker — the same pipeline Kai uses in
                interviews. Takes about 20 seconds.
            </p>

            <ol className="mt-6 space-y-3">
                {ROWS.map((r, i) => {
                    const row = rows[r.id];
                    return (
                        <li
                            key={r.id}
                            data-testid={`check-${r.id}`}
                            data-status={row.status}
                            className={cn(
                                'rounded-2xl border px-4 py-3 bg-zinc-900/60',
                                row.status === 'pass' && 'border-emerald-500/40',
                                row.status === 'fail' && 'border-red-500/50',
                                (row.status === 'idle' || row.status === 'skipped' || row.status === 'running') && 'border-zinc-800',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    role="img"
                                    aria-label={STATUS_LABEL[row.status]}
                                    className={cn(
                                        'mt-0.5 w-6 text-center text-lg font-bold',
                                        row.status === 'pass' && 'text-emerald-400',
                                        row.status === 'fail' && 'text-red-400',
                                        row.status === 'running' && 'text-indigo-300 animate-pulse',
                                        (row.status === 'idle' || row.status === 'skipped') && 'text-zinc-600',
                                    )}
                                >
                                    {ICON[row.status]}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <span className="font-semibold text-zinc-100">{i + 1}. {r.label}</span>
                                        {row.ms !== undefined && <span className="text-xs tabular-nums text-zinc-400">{row.ms} ms</span>}
                                    </div>
                                    {row.status === 'running' && <p className="mt-1 text-sm text-indigo-200">{r.prompt}</p>}
                                    {row.value && <p className="mt-1 text-sm text-zinc-200 break-words">{row.value}</p>}
                                    {row.detail && <p className="mt-0.5 text-xs text-zinc-500 break-words">{row.detail}</p>}
                                    {row.hint && <p className={cn('mt-1 text-sm', row.status === 'fail' ? 'text-red-300' : 'text-zinc-400')}>{row.hint}</p>}
                                    {r.id === 'mic' && level > 0 && (
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" aria-label="Microphone level">
                                            <div className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
                                        </div>
                                    )}
                                    {r.id === 'speaker' && row.status === 'pass' && heard === null && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                                            <span>Did you hear it?</span>
                                            <Button size="sm" variant="secondary" onClick={() => answerHeard(true)}>Yes</Button>
                                            <Button size="sm" variant="secondary" onClick={() => answerHeard(false)}>No</Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className="mt-6 flex flex-wrap gap-3">
                <Button
                    onClick={run}
                    disabled={running}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold"
                >
                    {running ? 'Checking…' : finished ? 'Run check again' : 'Run check'}
                </Button>
                <Button variant="outline" onClick={copyReport} disabled={!finished}>
                    {copyState === 'copied' ? 'Report copied' : 'Copy report'}
                </Button>
            </div>
            {copyState === 'failed' && (
                <p className="mt-2 text-sm text-red-300">Could not copy to the clipboard. Take a screenshot of this page instead.</p>
            )}
        </div>
    );
}
