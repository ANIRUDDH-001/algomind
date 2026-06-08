/**
 * @codesage
 * @file      src/components/onboarding/IntroAnimation.tsx
 * @purpose   Animated introduction screen shown during user onboarding.
 * @tech      React, Framer Motion, TailwindCSS
 * @connects  framer-motion
 * @apis      None
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/* eslint-disable react-hooks/purity */
'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface IntroAnimationProps {
    onComplete: () => void;
    skip?: boolean;
}

export function IntroAnimation({ onComplete, skip }: IntroAnimationProps) {
    const [step, setStep] = useState(0);
    const particlesRef = useRef(
        [...Array(20)].map(() => ({
            x: Math.random(), // normalized 0-1
            y: Math.random(), // normalized 0-1
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2,
        }))
    );

    useEffect(() => {
        // If skip is true, immediately complete without showing animation
        if (skip) {
            onComplete();
            return;
        }

        const timers = [
            setTimeout(() => setStep(1), 1000),   // Brain appears
            setTimeout(() => setStep(2), 2500),   // Nodes build
            setTimeout(() => setStep(3), 4000),   // CTA appears
        ];

        // Keyboard listener to skip animation
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onComplete();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            timers.forEach(clearTimeout);
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [onComplete, skip]);

    // Don't render anything if skipping
    if (skip) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ background: 'var(--surface-base)' }}>
            {/* Background gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute w-[500px] h-[500px] rounded-full blur-[100px]"
                    style={{ background: 'var(--accent-glow)', top: '-10%', left: '-10%' }}
                    animate={{ x: [0, 50, 0], y: [0, -50, 0], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute w-[500px] h-[500px] rounded-full blur-[100px]"
                    style={{ background: 'rgba(139, 92, 246, 0.15)', bottom: '-10%', right: '-10%' }}
                    animate={{ x: [0, -50, 0], y: [0, 50, 0], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>

            {/* 3D Target Cube (0-1s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: step >= 0 ? 1 : 0, scale: step >= 0 ? 1 : 0.5 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute z-10"
                style={{ top: '35%' }}
            >
                <div style={{ perspective: '800px' }} className="w-20 h-20 md:w-24 md:h-24 mx-auto">
                    <motion.div
                        style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%' }}
                        animate={{ rotateY: 360, rotateX: [0, 10, 0, -10, 0] }}
                        transition={{ rotateY: { duration: 8, repeat: Infinity, ease: 'linear' }, rotateX: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
                    >
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', transform: 'translateZ(40px)', borderRadius: '12px', opacity: 0.95, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
                            <span style={{ color: 'white', fontSize: '32px', fontWeight: 900 }}>A</span>
                        </div>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', transform: 'rotateY(180deg) translateZ(40px)', borderRadius: '12px', opacity: 0.7 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.5)', transform: 'rotateY(90deg) translateZ(40px)', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.5)', transform: 'rotateY(-90deg) translateZ(40px)', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.3)', transform: 'rotateX(90deg) translateZ(40px)', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.3)', transform: 'rotateX(-90deg) translateZ(40px)', borderRadius: '12px' }} />
                    </motion.div>
                </div>
            </motion.div>

            {/* Neural Expanding Rings (1-2.5s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: step >= 1 ? 1 : 0, scale: step >= 1 ? 1 : 0.5 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute pointer-events-none"
                style={{ top: '35%' }}
            >
                <div className="relative w-64 h-64 flex items-center justify-center">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="absolute rounded-full border border-indigo-500/20"
                            style={{ width: `${(i + 1) * 100}%`, height: `${(i + 1) * 100}%` }}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: step >= 1 ? [1, 1.1, 1] : 0.8, opacity: step >= 1 ? [0, 1, 0] : 0 }}
                            transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                    ))}

                    {/* Connecting orbital nodes */}
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                        return (
                            <motion.div
                                key={i}
                                className="absolute w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]"
                                style={{
                                    left: '50%', top: '50%',
                                    marginLeft: '-4px', marginTop: '-4px',
                                    rotate: `${angle}deg`,
                                    transformOrigin: '150px 0' // Dist Radius
                                }}
                                initial={{ opacity: 0, rotate: 0 }}
                                animate={{ opacity: step >= 1 ? 1 : 0, rotate: step >= 1 ? angle + 360 : 0 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear", opacity: { duration: 1, delay: i * 0.1 + 0.5 } }}
                            />
                        );
                    })}
                </div>
            </motion.div>

            {/* Logo Text */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : -30 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="absolute top-1/4"
            >
                <h1 className="text-6xl font-black text-white tracking-tight">
                    Algo<span className="text-gradient">Mind</span>
                </h1>
            </motion.div>

            {/* DSA Labels (2.5-4s) */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 50 }}
                transition={{ duration: 0.8 }}
                className="absolute bottom-1/3 flex gap-3 flex-wrap justify-center max-w-lg z-20"
            >
                {['Arrays', 'Trees', 'Graphs', 'Dynamic Programming', 'Recursion', 'Sorting'].map((label, i) => (
                    <motion.span
                        key={label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: step >= 2 ? 1 : 0, scale: step >= 2 ? 1 : 0.8 }}
                        transition={{ delay: i * 0.08 }}
                        className="px-4 py-2 border rounded-full text-zinc-300 text-sm font-bold shadow-lg"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-edge)' }}
                    >
                        {label}
                    </motion.span>
                ))}
            </motion.div>

            {/* Tagline */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: step >= 2 ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="absolute bottom-1/4 text-zinc-300 text-lg font-medium"
            >
                AI-Powered DSA Interview Practice
            </motion.p>

            {/* CTA (4-5s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: step >= 3 ? 1 : 0, scale: step >= 3 ? 1 : 0.8 }}
                transition={{ duration: 0.6 }}
                className="absolute bottom-16 z-30"
            >
                <button
                    onClick={onComplete}
                    className="btn-primary"
                    style={{ padding: '16px 40px', fontSize: '1.125rem', borderRadius: '1rem' }}
                >
                    Start Practicing
                </button>
            </motion.div>

            {/* Skip button */}
            <button
                onClick={onComplete}
                className="absolute top-8 right-8 text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
                Skip (ESC / Space / Enter) →
            </button>

            {/* Animated particles */}
            <div className="absolute inset-0 pointer-events-none">
                {particlesRef.current.map((particle, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white/30 rounded-full"
                        initial={{
                            x: particle.x * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                            y: particle.y * (typeof window !== 'undefined' ? window.innerHeight : 800),
                        }}
                        animate={{
                            y: [null, -100],
                            opacity: [0, 1, 0],
                        }}
                        transition={{
                            duration: particle.duration,
                            repeat: Infinity,
                            delay: particle.delay,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
