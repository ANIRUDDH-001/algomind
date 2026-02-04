import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type PulseState = 'idle' | 'listening' | 'processing' | 'speaking';

interface MicPulseProps {
    state: PulseState;
    className?: string;
}

export function MicPulse({ state, className }: MicPulseProps) {
    return (
        <div className={cn("absolute inset-0 overflow-hidden pointer-events-none rounded-xl", className)}>
            <AnimatePresence mode="wait">

                {/* ATMOSPHERIC AURA (Always present but changes color) */}
                <motion.div
                    key={`aura-${state}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className={cn(
                        "absolute inset-0 blur-[60px] opacity-20 transition-colors duration-1000",
                        state === 'idle' && "bg-slate-400/10",
                        state === 'listening' && "bg-blue-500/30",
                        state === 'processing' && "bg-purple-500/30",
                        state === 'speaking' && "bg-emerald-500/30",
                    )}
                />

                {/* STATE-SPECIFIC ANIMATIONS */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">

                    {/* LISTENING: Ethereal rings that feel integrated */}
                    {state === 'listening' && (
                        <div className="relative w-40 h-40">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={`ring-${i}`}
                                    className="absolute inset-0 rounded-full border border-blue-400/20"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1.5, opacity: [0, 0.4, 0] }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        delay: i * 1,
                                        ease: "easeOut"
                                    }}
                                />
                            ))}
                            <motion.div
                                className="absolute inset-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
                                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        </div>
                    )}

                    {/* PROCESSING: Nebula-like rotation */}
                    {state === 'processing' && (
                        <div className="relative w-32 h-32">
                            <motion.div
                                className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-blue-500 blur-xl opacity-40"
                                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                transition={{
                                    rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                }}
                            />
                            <motion.div
                                className="absolute inset-8 rounded-full border-2 border-t-white border-white/20"
                                animate={{ rotate: -360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                        </div>
                    )}

                    {/* SPEAKING: Modern Visualizer Bars */}
                    {state === 'speaking' && (
                        <div className="flex items-end justify-center gap-[3px] h-12">
                            {[...Array(12)].map((_, i) => (
                                <motion.div
                                    key={`bar-${i}`}
                                    className="w-1.5 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-full"
                                    animate={{
                                        height: [10, Math.random() * 40 + 10, 15],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: 0.4 + Math.random() * 0.4,
                                        repeat: Infinity,
                                        repeatType: "mirror"
                                    }}
                                    style={{ height: 20 }}
                                />
                            ))}
                        </div>
                    )}

                    {/* IDLE: Minimal pulse */}
                    {state === 'idle' && (
                        <motion.div
                            className="w-2 h-2 rounded-full bg-slate-500/30"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                    )}

                </div>
            </AnimatePresence>
        </div>
    );
}
