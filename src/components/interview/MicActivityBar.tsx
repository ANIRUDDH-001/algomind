/**
 * @codesage
 * @file      src/components/interview/MicActivityBar.tsx
 * @purpose   Live visualizer for Silero VAD speech-probability.
 * @tech      React, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

/**
 * MicActivityBar — Live Silero VAD speech-probability visualizer.
 *
 * Shows a thin animated bar below the mic button that reflects the real-time
 * speech probability emitted by the VAD engine on every audio frame (~30ms).
 *
 * Color:
 *   green  (prob > 0.7) — speech confidently detected
 *   amber  (prob > 0.3) — borderline / possible speech
 *   neutral (prob ≤ 0.3) — silence / background noise
 */

interface MicActivityBarProps {
    probability: number; // 0–1 from VAD onFrameProcessed
    isListening: boolean;
    className?: string;
}

export function MicActivityBar({ probability, isListening, className = '' }: MicActivityBarProps) {
    if (!isListening) return null;

    const pct = Math.round(Math.min(1, Math.max(0, probability)) * 100);

    let barColor: string;
    if (probability > 0.7) {
        barColor = '#10b981'; // emerald-500
    } else if (probability > 0.3) {
        barColor = '#f59e0b'; // amber-500
    } else {
        barColor = 'rgba(255,255,255,0.15)';
    }

    return (
        <div
            className={`h-1 w-full rounded-full overflow-hidden bg-white/5 ${className}`}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Voice activity level"
        >
            <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    boxShadow: probability > 0.7 ? `0 0 6px ${barColor}` : undefined,
                }}
            />
        </div>
    );
}
