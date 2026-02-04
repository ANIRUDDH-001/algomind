'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface IntroAnimationProps {
    onComplete: () => void;
}

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const timers = [
            setTimeout(() => setStep(1), 1000),   // Brain appears
            setTimeout(() => setStep(2), 2500),   // Nodes build
            setTimeout(() => setStep(3), 4000),   // CTA appears
        ];

        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center overflow-hidden">
            {/* Background gradient orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute w-96 h-96 rounded-full bg-blue-500/20 blur-3xl"
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    style={{ top: '10%', left: '10%' }}
                />
                <motion.div
                    className="absolute w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
                    animate={{
                        x: [0, -100, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    style={{ bottom: '10%', right: '10%' }}
                />
            </div>

            {/* User Silhouette (0-1s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: step >= 0 ? 1 : 0, scale: step >= 0 ? 1 : 0.5 }}
                transition={{ duration: 1 }}
                className="absolute"
            >
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 opacity-20" />
            </motion.div>

            {/* Brain Network (1-2.5s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: step >= 1 ? 1 : 0, scale: step >= 1 ? 1 : 0 }}
                transition={{ duration: 1.5 }}
                className="absolute"
            >
                <svg width="300" height="300" viewBox="0 0 300 300">
                    {/* Central node */}
                    <motion.circle
                        cx="150"
                        cy="150"
                        r="20"
                        fill="url(#centerGradient)"
                        initial={{ r: 0 }}
                        animate={{ r: step >= 1 ? 20 : 0 }}
                        transition={{ duration: 0.5 }}
                        filter="url(#glow)"
                    />

                    {/* Connecting nodes */}
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                        const x = 150 + Math.cos((angle * Math.PI) / 180) * 80;
                        const y = 150 + Math.sin((angle * Math.PI) / 180) * 80;

                        return (
                            <g key={i}>
                                <motion.line
                                    x1="150"
                                    y1="150"
                                    x2={x}
                                    y2={y}
                                    stroke="url(#lineGradient)"
                                    strokeWidth="3"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{
                                        pathLength: step >= 1 ? 1 : 0,
                                        opacity: step >= 1 ? 1 : 0
                                    }}
                                    transition={{ duration: 0.8, delay: i * 0.1 }}
                                />
                                <motion.circle
                                    cx={x}
                                    cy={y}
                                    r="14"
                                    fill="url(#nodeGradient)"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{
                                        scale: step >= 1 ? 1 : 0,
                                        opacity: step >= 1 ? 1 : 0
                                    }}
                                    transition={{ duration: 0.3, delay: i * 0.1 + 0.5 }}
                                    filter="url(#glow)"
                                />
                            </g>
                        );
                    })}

                    {/* Gradients */}
                    <defs>
                        <linearGradient id="centerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                </svg>
            </motion.div>

            {/* Logo Text */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : -30 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="absolute top-1/4"
            >
                <h1 className="text-6xl font-black text-white tracking-tight">
                    Algo<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Mind</span>
                </h1>
            </motion.div>

            {/* DSA Labels (2.5-4s) */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 50 }}
                transition={{ duration: 0.8 }}
                className="absolute bottom-1/3 flex gap-3 flex-wrap justify-center max-w-lg"
            >
                {['Arrays', 'Trees', 'Graphs', 'Dynamic Programming', 'Recursion', 'Sorting'].map((label, i) => (
                    <motion.span
                        key={label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: step >= 2 ? 1 : 0, scale: step >= 2 ? 1 : 0.8 }}
                        transition={{ delay: i * 0.08 }}
                        className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium"
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
                className="absolute bottom-1/4 text-slate-300 text-lg font-medium"
            >
                AI-Powered DSA Interview Practice
            </motion.p>

            {/* CTA (4-5s) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: step >= 3 ? 1 : 0, scale: step >= 3 ? 1 : 0.8 }}
                transition={{ duration: 0.6 }}
                className="absolute bottom-16"
            >
                <button
                    onClick={onComplete}
                    className="group relative px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-2xl hover:shadow-blue-500/25 hover:scale-105 transition-all duration-300 overflow-hidden"
                >
                    <span className="relative z-10">Start Practicing</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </motion.div>

            {/* Skip button */}
            <button
                onClick={onComplete}
                className="absolute top-8 right-8 text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
                Skip →
            </button>

            {/* Animated particles */}
            <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white/30 rounded-full"
                        initial={{
                            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                        }}
                        animate={{
                            y: [null, -100],
                            opacity: [0, 1, 0],
                        }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
