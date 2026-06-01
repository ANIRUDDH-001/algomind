/**
 * @codesage
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { CognitiveSkill } from '@/types/assessment';
import { Zap } from 'lucide-react';

interface SkillBadgeProps {
    skillId: CognitiveSkill;
    triggerPhrase: string;
    shown: boolean;
}

export function SkillBadge({ skillId, triggerPhrase, shown }: SkillBadgeProps) {
    const definition = SKILL_DEFINITIONS[skillId];

    return (
        <AnimatePresence>
            {shown && (
                <motion.div
                    initial={{ opacity: 0, x: 50, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                    className="flex items-center gap-3 bg-[var(--surface-1)]/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl pointer-events-none"
                    style={{ borderLeft: `4px solid ${definition.color}` }}
                >
                    <div className="p-2 rounded-lg bg-white/5">
                        <Zap className="w-5 h-5" style={{ color: definition.color }} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-tighter text-zinc-400 font-black leading-none mb-1">
                            {definition.name}
                        </p>
                        <p className="text-sm font-bold text-white leading-none">
                            {triggerPhrase}
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
