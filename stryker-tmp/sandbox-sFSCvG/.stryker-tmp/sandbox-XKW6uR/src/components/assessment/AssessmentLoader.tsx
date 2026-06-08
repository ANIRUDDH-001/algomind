// @ts-nocheck
// 
'use client';

/**
 * @codesage
 * @file      src/components/assessment/AssessmentLoader.tsx
 * @purpose   Shows an animated loading screen during the cognitive assessment process.
 * @tech      React, framer-motion, lucide-react, TailwindCSS
 * @connects  none
 * @apis      none
 * @db        none
 * @state     Local state for currentSkill animation cycling
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */

//  -- automated unused local suppression
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';

const SKILL_NAMES = [
    'Problem Decomposition',
    'Pattern Recognition',
    'Algorithmic Thinking',
    'Complexity Analysis',
    'Communication Clarity',
    'Edge Case Awareness',
    'Optimization Mindset',
    'Debugging Approach'
];

export function AssessmentLoader() {
    const [currentSkill, setCurrentSkill] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSkill(prev => (prev + 1) % SKILL_NAMES.length);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--surface-base)]/80 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-8 max-w-md w-full px-6">

                <div className="relative">
                    {/* Outer rotating rings */}
                    <motion.div
                        className="absolute -inset-10 rounded-full border border-blue-500/20"
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                        className="absolute -inset-16 rounded-full border border-purple-500/10"
                        animate={{ rotate: -360, scale: [1, 1.05, 1] }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Central Logo */}
                    <div className="relative z-10 p-8 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                        <BrainCircuit className="w-20 h-20 text-blue-400 animate-pulse" />
                    </div>
                </div>

                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                        Cognitive Analysis in Progress
                    </h2>
                    <p className="text-zinc-400 font-medium">
                        AlgoMind is processing your interview transcript to extract skill insights. This usually takes about 10-15 seconds.
                    </p>

                    <div className="flex flex-col gap-2 mt-8">
                        <div className="h-1.5 w-full bg-[var(--surface-2)] rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500"
                                animate={{ x: [-400, 400] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-black text-zinc-500">
                            <motion.span
                                key={currentSkill}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                            >
                                Analyzing: {SKILL_NAMES[currentSkill]}
                            </motion.span>
                            <span>Scoring Dimension {currentSkill + 1}/{SKILL_NAMES.length}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
