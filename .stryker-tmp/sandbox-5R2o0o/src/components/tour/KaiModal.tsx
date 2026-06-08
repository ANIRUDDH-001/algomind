/**
 * @codesage
 * @file      src/components/tour/KaiModal.tsx
 * @purpose   3D animated 'Kai' avatar used in modal tour steps.
 * @tech      React, Framer Motion
 * @connects  framer-motion, @/lib/tour/index
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import { motion } from 'framer-motion';
import type { KaiMood } from '@/lib/tour/index';

interface KaiModalProps {
    mood: KaiMood;
}

const MOOD_CONFIG = {
    waving: {
        rotateY: [0, 25, -25, 25, 0],
        rotateDuration: 3,
        scale: [1, 1.06, 1],
        glow: 'rgba(99,102,241,0.5)',
        shadowGlow: '0 0 40px rgba(99,102,241,0.4)',
        faceContent: (
            <span style={{ color: 'white', fontSize: 36, fontWeight: 900 }}>K</span>
        ),
        bounceDuration: 2.5,
    },
    celebrating: {
        rotateY: [0, 180, 360],
        rotateDuration: 1.8,
        scale: [1, 1.18, 0.92, 1.18, 1],
        glow: 'rgba(16,185,129,0.6)',
        shadowGlow: '0 0 60px rgba(16,185,129,0.5)',
        faceContent: (
            <span style={{ fontSize: 36 }}>★</span>
        ),
        bounceDuration: 0.9,
    },
};

export function KaiModal({ mood }: KaiModalProps) {
    const cfg = MOOD_CONFIG[mood];
    const SIZE = 88; // px
    const HALF = SIZE / 2;

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Glow rings */}
            <div style={{ position: 'relative', width: SIZE + 64, height: SIZE + 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {[1, 2].map((i) => (
                    <motion.div
                        key={i}
                        style={{
                            position: 'absolute',
                            inset: -i * 20,
                            borderRadius: '50%',
                            border: `1px solid ${cfg.glow.replace('0.6', String(0.25 / i))}`,
                        }}
                        animate={{
                            scale: [1, 1.2 + i * 0.15, 1],
                            opacity: [0.4, 0, 0.4],
                        }}
                        transition={{
                            duration: 2 + i * 0.6,
                            repeat: Infinity,
                            delay: i * 0.4,
                            ease: 'easeOut',
                        }}
                    />
                ))}

                {/* 3D Cube */}
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: cfg.bounceDuration, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ perspective: 700, width: SIZE, height: SIZE }}
                >
                    <motion.div
                        style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%' }}
                        animate={{
                            rotateY: cfg.rotateY,
                            rotateX: mood === 'celebrating' ? [0, 20, -20, 20, 0] : [0, 8, 0, -8, 0],
                            scale: cfg.scale,
                        }}
                        transition={{
                            rotateY: { duration: cfg.rotateDuration, repeat: Infinity, ease: mood === 'celebrating' ? 'linear' : 'easeInOut' },
                            rotateX: { duration: cfg.rotateDuration * 0.7, repeat: Infinity, ease: 'easeInOut' },
                            scale: { duration: cfg.bounceDuration, repeat: Infinity, ease: 'easeInOut' },
                        }}
                    >
                        {/* Front */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            transform: `translateZ(${HALF}px)`,
                            borderRadius: SIZE * 0.22,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: cfg.shadowGlow,
                        }}>
                            {cfg.faceContent}
                        </div>
                        {/* Back */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', transform: `rotateY(180deg) translateZ(${HALF}px)`, borderRadius: SIZE * 0.22, opacity: 0.7 }} />
                        {/* Right */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.55)', transform: `rotateY(90deg) translateZ(${HALF}px)`, borderRadius: SIZE * 0.22 }} />
                        {/* Left */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.55)', transform: `rotateY(-90deg) translateZ(${HALF}px)`, borderRadius: SIZE * 0.22 }} />
                        {/* Top */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.4)', transform: `rotateX(90deg) translateZ(${HALF}px)`, borderRadius: SIZE * 0.22 }} />
                        {/* Bottom */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.3)', transform: `rotateX(-90deg) translateZ(${HALF}px)`, borderRadius: SIZE * 0.22 }} />
                    </motion.div>
                </motion.div>
            </div>

            {/* Particle burst for celebrating mood */}
            {mood === 'celebrating' && (
                <div style={{ position: 'absolute', pointerEvents: 'none', overflow: 'visible' }}>
                    {['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'].map((color, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                            animate={{
                                opacity: 0,
                                x: Math.cos((i / 6) * Math.PI * 2) * 70,
                                y: Math.sin((i / 6) * Math.PI * 2) * 70,
                                scale: 0,
                            }}
                            transition={{ duration: 0.9, delay: i * 0.06, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.5 }}
                            style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: 10, height: 10,
                                borderRadius: '50%',
                                background: color,
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
