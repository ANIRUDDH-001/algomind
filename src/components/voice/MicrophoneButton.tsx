/**
 * @codesage
 * @file      src/components/voice/MicrophoneButton.tsx
 * @purpose   Interactive button to toggle voice listening state with visual feedback.
 * @tech      React, Framer Motion, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicrophoneButtonProps {
    isListening: boolean;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
    error?: string | null;
    /** Phase 5c: Real-time mic volume level (0.0 to 1.0) */
    audioLevel?: number;
    /** Phase 5e: Called when user taps the button while in error state */
    onRetry?: () => void;
    /** Whether the underlying VAD engine is initialized */
    isReady?: boolean;
}

export function MicrophoneButton({
    isListening,
    onClick,
    disabled,
    className,
    error,
    audioLevel = 0,
    onRetry,
    isReady = true,
}: MicrophoneButtonProps) {
    return (
        <div className="flex flex-col items-center gap-3">
            {/* Outer ring — only visible when listening */}
            <div className="relative flex items-center justify-center">
                {isListening && !error && (
                    <>
                        {[0, 1, 2].map(i => (
                            <motion.div key={i}
                                className="absolute rounded-full border border-indigo-400/20"
                                style={{ inset: -(i + 1) * 12 }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 1.5] }}
                                transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: 'easeOut' }}
                            />
                        ))}
                    </>
                )}

                {/* Phase 5c: Audio level ring — green when audio detected, amber when no sound */}
                {isListening && !error && audioLevel > 0 && (
                    <motion.div
                        className="absolute rounded-full border-2 border-green-400/60"
                        style={{ inset: -4 }}
                        animate={{
                            scale: 1 + audioLevel * 0.3,
                            opacity: 0.3 + audioLevel * 0.7,
                        }}
                        transition={{ duration: 0.1 }}
                    />
                )}

                <motion.button
                    onClick={error && onRetry ? onRetry : onClick}
                    disabled={disabled}
                    data-testid="mic-button"
                    aria-label={isListening ? 'Disable microphone' : 'Enable microphone'}
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                        "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 outline-none",
                        "border focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                        error
                            ? "bg-red-500/15 border-red-500/40"
                            : !isReady
                                ? "bg-zinc-800 border-zinc-700"
                                : isListening
                                    ? "bg-indigo-600 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                                    : "bg-zinc-900 border-zinc-700 hover:border-zinc-500",
                        (disabled || !isReady) && "opacity-40 cursor-not-allowed",
                        className
                    )}
                >
                    {error
                        ? <AlertCircle className="w-6 h-6 text-red-400" />
                        : !isReady
                            ? <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                            : isListening
                                ? <Mic className="w-6 h-6 text-white" />
                                : <MicOff className="w-6 h-6 text-zinc-400" />
                    }
                </motion.button>
            </div>

            {/* State label */}
            <motion.span
                key={error ? 'error' : isListening ? 'on' : 'off'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "text-xs font-semibold tracking-wide",
                    error ? "text-red-400"
                        : isListening ? "text-indigo-400"
                            : "text-zinc-500"
                )}
            >
                {error
                    ? (onRetry ? "Tap to retry" : "Mic error")
                    : !isReady
                        ? "Initializing..."
                        : isListening
                            ? "Listening..."
                            : "Click to speak"}
            </motion.span>
        </div>
    );
}
