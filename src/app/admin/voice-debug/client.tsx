/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getVoiceConfig,
    setVoiceConfig,
    resetVoiceConfig,
    VOICE_CONFIG_DEFAULTS,
    type VoiceConfigValues,
} from '@/config/voice-config';
import type { InterruptionEventData } from '@/lib/voice/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

const EVENT_COLORS: Record<string, string> = {
    interruption: 'text-red-400',
    resumption: 'text-green-400',
    debounce: 'text-orange-400',
    state_change: 'text-slate-500',
    confidence_reject: 'text-yellow-500',
    duration_reject: 'text-amber-500',
    manual_stop: 'text-red-300',
    manual_continue: 'text-blue-300',
    diagnostic: 'text-slate-600',
};

// ---------------------------------------------------------------------------
// Config slider component
// ---------------------------------------------------------------------------

function ConfigSlider({
    label,
    configKey,
    min,
    max,
    step,
    unit,
    config,
    onChange,
}: {
    label: string;
    configKey: keyof VoiceConfigValues;
    min: number;
    max: number;
    step: number;
    unit: string;
    config: VoiceConfigValues;
    onChange: (key: keyof VoiceConfigValues, value: number) => void;
}) {
    const value = config[configKey] as number;
    const defaultVal = VOICE_CONFIG_DEFAULTS[configKey] as number;
    const isModified = value !== defaultVal;

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{label}</span>
                <span className={isModified ? 'text-blue-400 font-bold' : 'text-slate-500'}>
                    {value}{unit}
                    {isModified && (
                        <span className="text-slate-600 ml-1">(default: {defaultVal})</span>
                    )}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(configKey, Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VoiceDebugPage() {
    const [config, setLocalConfig] = useState<VoiceConfigValues>(VOICE_CONFIG_DEFAULTS);
    const [eventStream, setEventStream] = useState<InterruptionEventData[]>([]);
    const streamRef = useRef<HTMLDivElement>(null);

    // Load config from localStorage on mount
    useEffect(() => {
        setLocalConfig(getVoiceConfig());
    }, []);

    // Poll for event stream updates (from the InterruptionManager singleton)
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;

        async function pollEvents() {
            try {
                const { InterruptionManager } = await import('@/lib/voice/interruption-manager');
                // We can't access the singleton from here since it's in ConversationView
                // Instead, read from a global debug hook if available

                const w = window as unknown as { __algomind_im_debug?: InstanceType<typeof InterruptionManager> };
                if (w.__algomind_im_debug) {
                    const im = w.__algomind_im_debug;
                    setEventStream([...im.getEventStream()]);
                }
            } catch {
                // InterruptionManager not available
            }
        }

        timer = setInterval(pollEvents, 500);
        return () => clearInterval(timer);
    }, []);

    // Auto-scroll event stream
    useEffect(() => {
        if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
    }, [eventStream]);

    const handleConfigChange = useCallback((key: keyof VoiceConfigValues, value: number | boolean) => {
        const updated = setVoiceConfig({ [key]: value });
        setLocalConfig(updated);

        // Also hot-update any live InterruptionManager instance

        const w = window as unknown as { __algomind_im_debug?: { setConfig: (c: Partial<VoiceConfigValues>) => void } };
        if (w.__algomind_im_debug?.setConfig) {
            w.__algomind_im_debug.setConfig({ [key]: value });
        }
    }, []);

    const handleReset = useCallback(() => {
        const defaults = resetVoiceConfig();
        setLocalConfig(defaults);

        const w = window as unknown as { __algomind_im_debug?: { setConfig: (c: Partial<VoiceConfigValues>) => void } };
        if (w.__algomind_im_debug?.setConfig) {
            w.__algomind_im_debug.setConfig(defaults);
        }
    }, []);

    // Compute stats from event stream
    const stats = React.useMemo(() => {
        const interruptions = eventStream.filter(e => e.event === 'interruption');
        const confidenceRejects = eventStream.filter(e => e.event === 'confidence_reject');
        const durationRejects = eventStream.filter(e => e.event === 'duration_reject');
        const manualStops = eventStream.filter(e => e.event === 'manual_stop');
        const avgConfidence = interruptions.length > 0
            ? interruptions.reduce((sum, e) => sum + (e.confidence ?? 0), 0) / interruptions.length
            : 0;

        return {
            total: eventStream.length,
            interruptions: interruptions.length,
            confidenceRejects: confidenceRejects.length,
            durationRejects: durationRejects.length,
            manualStops: manualStops.length,
            avgConfidence,
            rejectRate: eventStream.length > 0
                ? ((confidenceRejects.length + durationRejects.length) / eventStream.length * 100)
                : 0,
        };
    }, [eventStream]);

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Voice Debug Panel</h1>
                    <p className="text-sm text-slate-400">
                        Tune interruption parameters and monitor VAD events in real-time.
                    </p>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Interruptions', value: stats.interruptions, color: 'text-red-400' },
                        { label: 'Rejected (conf)', value: stats.confidenceRejects, color: 'text-yellow-400' },
                        { label: 'Rejected (dur)', value: stats.durationRejects, color: 'text-amber-400' },
                        { label: 'Reject Rate', value: `${stats.rejectRate.toFixed(1)}%`, color: 'text-orange-400' },
                    ].map(s => (
                        <div key={s.label} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/50">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Config tuning */}
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/50 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                            Configuration
                        </h2>
                        <button
                            onClick={handleReset}
                            className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                        >
                            Reset Defaults
                        </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <ConfigSlider label="Grace Period" configKey="graceMs" min={100} max={2000} step={50} unit="ms" config={config} onChange={handleConfigChange} />
                        <ConfigSlider label="Debounce Cooldown" configKey="debounceMs" min={200} max={3000} step={100} unit="ms" config={config} onChange={handleConfigChange} />
                        <ConfigSlider label="Speech End Confirm" configKey="speechEndConfirmMs" min={200} max={3000} step={100} unit="ms" config={config} onChange={handleConfigChange} />
                        <ConfigSlider label="Min Confidence" configKey="minConfidence" min={0.3} max={1.0} step={0.05} unit="" config={config} onChange={handleConfigChange} />
                        <ConfigSlider label="Min Speech Duration" configKey="minSpeechDurationMs" min={50} max={1000} step={25} unit="ms" config={config} onChange={handleConfigChange} />
                        <ConfigSlider label="Consecutive Frames" configKey="consecutiveHighFrames" min={1} max={10} step={1} unit="" config={config} onChange={handleConfigChange} />
                    </div>

                    {/* Debug mode toggle */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                        <div>
                            <span className="text-xs font-bold text-slate-300">Debug Mode</span>
                            <p className="text-[10px] text-slate-500">Verbose console logging for all decisions</p>
                        </div>
                        <button
                            role="switch"
                            aria-checked={config.debugMode}
                            onClick={() => handleConfigChange('debugMode', !config.debugMode)}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${config.debugMode
                                ? 'bg-blue-600 border-blue-500'
                                : 'bg-slate-700 border-slate-600'
                                }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 mt-[1px] ${config.debugMode ? 'translate-x-[22px]' : 'translate-x-[2px]'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Event stream */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                            Event Stream
                        </h2>
                        <span className="text-[10px] text-slate-500">
                            {eventStream.length} events
                            {eventStream.length === 0 && ' — start an interview with VAD enabled to see events'}
                        </span>
                    </div>
                    <div
                        ref={streamRef}
                        className="h-64 overflow-y-auto rounded-xl bg-slate-900/60 border border-slate-800/50 p-3 font-mono text-[11px] space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700"
                    >
                        {eventStream.length === 0 ? (
                            <div className="text-slate-600 text-center py-8">
                                No events yet. Expose the InterruptionManager instance to <code>window.__algomind_im_debug</code> during an interview to enable live monitoring.
                            </div>
                        ) : (
                            eventStream.map((evt, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <span className="text-slate-600 shrink-0">{formatTs(evt.timestamp)}</span>
                                    <span className={`font-bold shrink-0 ${EVENT_COLORS[evt.event] ?? 'text-slate-400'}`}>
                                        {evt.event}
                                    </span>
                                    {evt.decision && (
                                        <span className="text-slate-500">→ {evt.decision}</span>
                                    )}
                                    {evt.confidence !== undefined && (
                                        <span className="text-blue-400/60">conf={evt.confidence.toFixed(3)}</span>
                                    )}
                                    {evt.speechDurationMs !== undefined && (
                                        <span className="text-purple-400/60">{evt.speechDurationMs}ms</span>
                                    )}
                                    {evt.reason && (
                                        <span className="text-slate-600 truncate">{evt.reason}</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Current config dump */}
                <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer hover:text-slate-300 font-bold uppercase tracking-widest transition-colors">
                        Debug: Raw Config
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800/50 overflow-auto font-mono text-[10px]">
                        {JSON.stringify(config, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
}
