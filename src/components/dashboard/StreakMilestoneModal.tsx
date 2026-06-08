/**
 * @codesage
 */
// @ts-expect-error -- automated unused local suppression
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface StreakMilestoneModalProps {
    streak: number;
    isNewRecord: boolean;
    onDismiss: () => void;
}

const MILESTONE_STREAKS = [3, 7, 14, 30, 50, 100] as const;

export function StreakMilestoneModal({ streak, isNewRecord, onDismiss }: StreakMilestoneModalProps) {
    // Auto-dismiss after 3s
    useEffect(() => {
        const t = setTimeout(onDismiss, 3000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    // Only show for milestone values
    if (!MILESTONE_STREAKS.includes(streak as any)) return null;

    const emoji = isNewRecord ? '🏆' : streak >= 30 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : '🔥';
    const title = isNewRecord
        ? `New Record! ${streak} Days`
        : `${streak}-Day Streak!`;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onDismiss}
            >
                <motion.div
                    className="relative bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 rounded-3xl p-8 text-center max-w-sm mx-4 shadow-2xl shadow-amber-900/50"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-5xl mb-3">{emoji}</div>
                    <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
                    <p className="text-zinc-400 text-sm">
                        {isNewRecord
                            ? "You've set a new personal best! Keep going."
                            : "Consistency is the key to mastery. Keep the streak alive!"}
                    </p>
                    <div className="mt-4 text-xs text-zinc-600">Tap anywhere to dismiss</div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
