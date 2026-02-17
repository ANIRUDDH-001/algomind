'use client';

/**
 * VADTestContent — the actual VAD test UI.
 *
 * Loaded via `next/dynamic` with `ssr: false` from `page.tsx`,
 * so all browser APIs (AudioContext, etc.) are safe to use.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';
import { getVADErrorMessage, VAD_SUPPORTED_BROWSERS } from '@/lib/voice/vad-utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
    id: number;
    time: string;
    type: 'info' | 'speech-start' | 'speech-end' | 'error' | 'warn';
    message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VADTestContent() {
    // ---- State --------------------------------------------------------------
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [speechStartTime, setSpeechStartTime] = useState<number | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [level, setLevel] = useState(0);
    const [loadElapsed, setLoadElapsed] = useState(0);
    const logIdRef = useRef(0);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // ---- Helpers ------------------------------------------------------------

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        const entry: LogEntry = {
            id: logIdRef.current++,
            time: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }),
            type,
            message,
        };
        setLogs((prev) => [...prev.slice(-99), entry]); // keep last 100
    }, []);

    // Auto-scroll log panel
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // ---- VAD hook -----------------------------------------------------------

    const {
        isListening,
        isSpeaking,
        error,
        isSupported,
        isInitializing,
        startListening,
        stopListening,
    } = useVoiceActivityDetection({
        enabled: true,
        autoStart: false,
        onSpeechStart: () => {
            const now = performance.now();
            setSpeechStartTime(now);
            addLog('speech-start', 'Speech detected');
        },
        onSpeechEnd: () => {
            if (speechStartTime) {
                const duration = Math.round(performance.now() - speechStartTime);
                setLatency(duration);
                addLog('speech-end', `Speech ended (duration: ${duration}ms)`);
            } else {
                addLog('speech-end', 'Speech ended');
            }
            setSpeechStartTime(null);
        },
        onError: (err) => {
            addLog('error', getVADErrorMessage(err));
        },
    });

    // ---- Elapsed timer for loading state ------------------------------------

    useEffect(() => {
        if (!isInitializing) {
            setLoadElapsed(0);
            return;
        }
        const start = Date.now();
        const interval = setInterval(() => {
            setLoadElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isInitializing]);

    // ---- Simulated level meter (pulse while speaking) -----------------------

    useEffect(() => {
        if (!isSpeaking) {
            setLevel(0);
            return;
        }
        const interval = setInterval(() => {
            setLevel(0.5 + Math.random() * 0.5);
        }, 100);
        return () => clearInterval(interval);
    }, [isSpeaking]);

    // ---- Handlers -----------------------------------------------------------

    const handleStart = async () => {
        addLog('info', 'Starting VAD…');
        try {
            await startListening();
            addLog('info', 'VAD started — listening for speech');
        } catch (err) {
            addLog('error', getVADErrorMessage(err));
        }
    };

    const handleStop = () => {
        stopListening();
        addLog('info', 'VAD stopped');
        setLevel(0);
        setSpeechStartTime(null);
    };

    const handleClearLogs = () => setLogs([]);

    // ---- Render -------------------------------------------------------------

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
            {/* ── Header ──────────────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold tracking-tight">VAD Test Page</h1>
                    <Badge variant="outline" className="text-xs">
                        Isolated Test
                    </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                    Verify Voice Activity Detection before integrating into the interview flow.
                    Speak into your microphone after clicking Start.
                </p>
            </div>

            {/* ── Browser Warning ─────────────────────────────────── */}
            {!isSupported && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="pt-0">
                        <div className="flex items-start gap-3">
                            <span className="text-destructive text-xl mt-0.5">⚠</span>
                            <div>
                                <p className="font-medium text-destructive">Browser Not Supported</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your browser lacks required APIs (AudioContext, WASM, getUserMedia).
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Supported: {VAD_SUPPORTED_BROWSERS.join(', ')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Status Dashboard ────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Status</CardTitle>
                    <CardDescription>Real-time VAD state and metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Status indicators row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatusIndicator
                            label="VAD"
                            active={isListening}
                            activeLabel="Listening"
                            inactiveLabel="Idle"
                        />
                        <StatusIndicator
                            label="Speech"
                            active={isSpeaking}
                            activeLabel="Speaking"
                            inactiveLabel="Silent"
                            activeColor="green"
                        />
                        <StatusIndicator
                            label="Support"
                            active={isSupported}
                            activeLabel="Yes"
                            inactiveLabel="No"
                            activeColor="blue"
                        />
                        <div className="text-center space-y-1">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Latency</span>
                            <p className="text-xl font-mono font-semibold tabular-nums">
                                {latency !== null ? `${latency}ms` : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Level meter */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Audio Level</span>
                            <span className="text-xs text-muted-foreground tabular-nums font-mono">
                                {Math.round(level * 100)}%
                            </span>
                        </div>
                        <div className="h-3 rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-100"
                                style={{
                                    width: `${level * 100}%`,
                                    backgroundColor: level > 0.7
                                        ? 'hsl(142, 71%, 45%)'
                                        : level > 0.3
                                            ? 'hsl(48, 96%, 53%)'
                                            : 'hsl(215, 20%, 65%)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Speech indicator dot */}
                    <div className="flex items-center justify-center py-4">
                        <div className="relative">
                            <div
                                className={`w-20 h-20 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${isSpeaking
                                    ? 'bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                    : isListening
                                        ? 'bg-blue-500/10 border-blue-500/50'
                                        : 'bg-muted/50 border-border'
                                    }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full transition-all duration-200 ${isSpeaking
                                        ? 'bg-green-500 scale-110 animate-pulse'
                                        : isListening
                                            ? 'bg-blue-500/60'
                                            : 'bg-muted-foreground/30'
                                        }`}
                                />
                            </div>
                            {isSpeaking && (
                                <div className="absolute -inset-2 rounded-full border border-green-500/30 animate-ping" />
                            )}
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                            <p className="text-sm text-destructive">{getVADErrorMessage(error)}</p>
                        </div>
                    )}

                    {/* Dev-mode notice */}
                    {isInitializing && (
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                            <p className="text-sm text-blue-400">
                                ⏳ Compiling ONNX runtime… ({loadElapsed}s)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                First load in dev mode takes 30–60s while Turbopack compiles the ONNX
                                runtime. Subsequent loads within the same dev session are instant.
                            </p>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleStart}
                            disabled={isListening || isInitializing || !isSupported}
                            className="flex-1"
                        >
                            {isInitializing ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Loading Model… ({loadElapsed}s)
                                </>
                            ) : (
                                'Start VAD'
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleStop}
                            disabled={!isListening}
                            className="flex-1"
                        >
                            Stop VAD
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ── Event Log ───────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Event Log</CardTitle>
                            <CardDescription>{logs.length} events</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleClearLogs}>
                            Clear
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div
                        ref={logContainerRef}
                        className="h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed"
                    >
                        {logs.length === 0 ? (
                            <p className="text-zinc-500 italic">No events yet. Click Start VAD to begin.</p>
                        ) : (
                            logs.map((entry) => (
                                <div key={entry.id} className="flex gap-2">
                                    <span className="text-zinc-500 shrink-0 select-none">{entry.time}</span>
                                    <LogBadge type={entry.type} />
                                    <span className={LOG_TEXT_COLORS[entry.type]}>{entry.message}</span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Instructions ────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">How to Test</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Click <strong>Start VAD</strong> (first load downloads the ~2 MB ONNX model).</li>
                        <li>Allow microphone access when prompted.</li>
                        <li>Speak naturally — the green indicator should pulse while you talk.</li>
                        <li>Pause — the indicator should turn off after ~768 ms of silence.</li>
                        <li>Check the Event Log for <code>speech-start</code> / <code>speech-end</code> events.</li>
                        <li>Verify latency values are reasonable ({'<'}500 ms expected).</li>
                    </ol>
                </CardContent>
            </Card>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIndicator({
    label,
    active,
    activeLabel,
    inactiveLabel,
    activeColor = 'emerald',
}: {
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
    activeColor?: 'green' | 'blue' | 'emerald';
}) {
    const dotColors: Record<string, string> = {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500',
    };

    return (
        <div className="text-center space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className="flex items-center justify-center gap-1.5">
                <div
                    className={`w-2 h-2 rounded-full transition-colors ${active ? dotColors[activeColor] : 'bg-zinc-400 dark:bg-zinc-600'
                        }`}
                />
                <span className="text-sm font-medium">{active ? activeLabel : inactiveLabel}</span>
            </div>
        </div>
    );
}

const LOG_TEXT_COLORS: Record<LogEntry['type'], string> = {
    info: 'text-zinc-300',
    'speech-start': 'text-green-400',
    'speech-end': 'text-amber-400',
    error: 'text-red-400',
    warn: 'text-yellow-400',
};

const LOG_BADGE_STYLES: Record<LogEntry['type'], string> = {
    info: 'text-blue-400',
    'speech-start': 'text-green-400',
    'speech-end': 'text-amber-400',
    error: 'text-red-400',
    warn: 'text-yellow-400',
};

function LogBadge({ type }: { type: LogEntry['type'] }) {
    const labels: Record<LogEntry['type'], string> = {
        info: 'INFO',
        'speech-start': 'START',
        'speech-end': 'END',
        error: 'ERR',
        warn: 'WARN',
    };

    return (
        <span className={`shrink-0 w-12 text-right ${LOG_BADGE_STYLES[type]}`}>
            [{labels[type]}]
        </span>
    );
}
