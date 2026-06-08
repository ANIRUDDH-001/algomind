/**
 * @codesage
 * @file      src/components/interview/SilentObserverNudge.tsx
 * @purpose   Displays non-intrusive coaching nudges based on silent observer signals.
 * @tech      React, Framer Motion, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

// @ts-expect-error -- automated unused local suppression
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SilentObserverNudgeProps {
    nudge: string | null;
    onDismiss: () => void;
}

export function SilentObserverNudge({ nudge, onDismiss }: SilentObserverNudgeProps) {
    useEffect(() => {
        if (nudge) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [nudge, onDismiss]);

    return (
        <AnimatePresence>
            {nudge && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-full px-4"
                >
                    <div className="bg-amber-950/90 border border-amber-500/50 shadow-2xl shadow-amber-900/20 rounded-2xl p-3 flex items-start gap-3 backdrop-blur-md">
                        <div className="text-xl shrink-0 mt-0.5 animate-bounce">💡</div>
                        <div className="flex-1 pr-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-1">
                                Coaching Nudge
                            </h4>
                            <p className="text-sm font-medium text-amber-100 leading-snug">
                                {nudge}
                            </p>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="absolute top-3 right-3 text-amber-500/50 hover:text-amber-400 hover:bg-amber-500/10 p-1 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
