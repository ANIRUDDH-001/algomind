'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type PulseState = 'idle' | 'listening' | 'processing' | 'speaking';

interface MicPulseProps {
    state: PulseState;
    className?: string;
    /** Compact mode: 48px, full mode: 80px. Default: full */
    size?: 'compact' | 'full';
}

export function MicPulse({ state, className, size = 'full' }: MicPulseProps) {
    const dim = size === 'compact' ? 'w-12 h-12' : 'w-20 h-20';

    return (
        <div className={cn("relative flex items-center justify-center", dim, className)}>
            <AnimatePresence mode="wait">

                {/* IDLE — single dim dot */}
                {state === 'idle' && (
                    <motion.div key="idle"
                        className="w-2 h-2 rounded-full bg-zinc-600"
                        initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.6, 0.3] }} exit={{ opacity: 0 }}
                        transition={{ duration: 3, repeat: Infinity }}
                    />
                )}

                {/* LISTENING — concentric pulsing rings */}
                {state === 'listening' && (
                    <motion.div key="listening" className="relative flex items-center justify-center w-full h-full"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {[0, 1].map(i => (
                            <motion.div key={i}
                                className="absolute rounded-full border border-indigo-400/30"
                                style={{ inset: i * 10 }}
                                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 1.8, delay: i * 0.9, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                    </motion.div>
                )}

                {/* PROCESSING — minimal spinner arc */}
                {state === 'processing' && (
                    <motion.div key="processing" className="relative"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div
                            className="w-8 h-8 rounded-full border-2 border-transparent"
                            style={{ borderTopColor: '#6366f1', borderRightColor: 'rgba(99,102,241,0.2)' }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        <div className="absolute inset-2 rounded-full bg-violet-500/20" />
                    </motion.div>
                )}

                {/* SPEAKING — minimal waveform bars (5 bars, clean) */}
                {state === 'speaking' && (
                    <motion.div key="speaking"
                        className="flex items-center gap-0.5 h-8"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {[0.5, 1, 0.7, 1, 0.5].map((intensity, i) => (
                            <motion.div key={i}
                                className="w-1 rounded-full"
                                style={{ background: 'linear-gradient(to top, #6366f1, #8b5cf6)' }}
                                animate={{ height: [`${intensity * 10}px`, `${intensity * 28}px`, `${intensity * 10}px`] }}
                                transition={{ duration: 0.5 + i * 0.08, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
                            />
                        ))}
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
