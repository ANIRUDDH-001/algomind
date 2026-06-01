/**
 * @codesage
 * @file      src/components/interview/ManualControls.tsx
 * @purpose   Floating controls to manually pause or resume AI speech during interviews.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { StopCircle, RotateCcw } from 'lucide-react';
import type { InterruptionReadiness } from '@/lib/voice/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManualControlsProps {
    /** Current readiness status from InterruptionManager. */
    readiness: InterruptionReadiness;
    /** Whether the AI is currently speaking. */
    isAISpeaking: boolean;
    /** Whether the last AI message was interrupted. */
    wasInterrupted: boolean;
    /** Called when user presses the Stop button. */
    onStop: () => void;
    /** Called when user presses the Continue button. */
    onContinue: () => void;
    /** Whether to show the controls (VAD enabled). */
    visible?: boolean;
}

// ---------------------------------------------------------------------------
// Readiness indicator config
// ---------------------------------------------------------------------------

const READINESS_DOT: Record<InterruptionReadiness, { color: string; label: string }> = {
    blocked: { color: 'bg-zinc-500', label: 'Blocked' },
    grace_period: { color: 'bg-amber-400 animate-pulse', label: 'Grace period' },
    cooldown: { color: 'bg-orange-400', label: 'Cooldown' },
    ready: { color: 'bg-emerald-400', label: 'Ready' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating pill bar with manual Stop/Continue buttons
 * and a readiness indicator dot.
 *
 * Shown during AI speech when VAD is enabled.
 */
export function ManualControls({
    readiness,
    isAISpeaking,
    wasInterrupted,
    onStop,
    onContinue,
    visible = true,
}: ManualControlsProps) {
    if (!visible) return null;

    const dot = READINESS_DOT[readiness];
    const showStop = isAISpeaking;
    const showContinue = !isAISpeaking && wasInterrupted;

    // Nothing to show
    if (!showStop && !showContinue) return null;

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-[var(--surface-1)]/80 backdrop-blur-sm border border-white/15',
                'shadow-lg shadow-black/20',
                'animate-in fade-in slide-in-from-bottom-2 duration-200',
            )}
        >
            {/* Readiness dot */}
            <div className="flex items-center gap-1.5">
                <span
                    className={cn('w-2 h-2 rounded-full', dot.color)}
                    title={dot.label}
                />
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    {dot.label}
                </span>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-[var(--surface-3)]" />

            {/* Stop button — always works, bypasses debounce */}
            {showStop && (
                <button
                    onClick={onStop}
                    className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
                        'text-[11px] font-bold uppercase tracking-wider',
                        'bg-red-500/20 text-red-400 border border-red-500/30',
                        'hover:bg-red-500/30 hover:border-red-500/50',
                        'active:scale-95',
                        'transition-all duration-150',
                    )}
                    title="Stop AI speech immediately (bypasses debouncing)"
                >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop
                </button>
            )}

            {/* Continue button — after incorrect interruption */}
            {showContinue && (
                <button
                    onClick={onContinue}
                    className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
                        'text-[11px] font-bold uppercase tracking-wider',
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                        'hover:bg-amber-500/30 hover:border-amber-500/50',
                        'active:scale-95',
                        'transition-all duration-150',
                    )}
                    title="Ask AI to continue its interrupted response"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Continue
                </button>
            )}
        </div>
    );
}
