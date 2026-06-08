/**
 * @codesage
 * @file      src/components/interview/InterruptionIndicator.tsx
 * @purpose   Provides visual feedback when the user interrupts the AI via voice.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

//  -- automated unused local suppression
import React from 'react';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterruptionIndicatorProps {
    /** Whether the user is currently interrupting the AI. */
    isInterrupting: boolean;
    /** Optional className override. */
    className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Visual feedback overlay shown when the user interrupts the AI mid-speech
 * via Voice Activity Detection.
 *
 * Renders:
 * - A pulsing "Listening..." badge with mic icon
 * - Smooth enter/exit animations
 *
 * Only rendered when the VAD feature flag is enabled.
 */
export function InterruptionIndicator({
    isInterrupting,
    className,
}: InterruptionIndicatorProps) {
    if (!isInterrupting) return null;

    return (
        <div
            className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-blue-500/20 border border-blue-500/40',
                'animate-in fade-in slide-in-from-bottom-2 duration-300',
                className,
            )}
        >
            <Mic className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-300 tracking-wide">
                Listening...
            </span>
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
        </div>
    );
}
