/**
 * @codesage
 * @file      src/lib/design-tokens.ts
 * @purpose   Defines shared design tokens and animations.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

// Single source of truth for design decisions used in JS/TSX
// (where Tailwind classes alone aren't enough)

export const COLORS = {
    accent: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        glow: 'rgba(99,102,241,0.15)',
        glowHi: 'rgba(99,102,241,0.30)',
    },
    surface: {
        base: '#0a0a0f',
        s1: '#111118',
        s2: '#16161f',
        s3: '#1e1e2a',
        edge: 'rgba(255,255,255,0.06)',
    },
    semantic: {
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
    },
    difficulty: {
        easy: '#10b981',
        medium: '#f59e0b',
        hard: '#ef4444',
    },
    // Recharts / chart palette — replaces the flat default colors
    chart: [
        '#6366f1', // indigo
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#10b981', // emerald
        '#f59e0b', // amber
        '#3b82f6', // blue
        '#06b6d4', // cyan
        '#f97316', // orange
    ],
    // Skill-specific colors (matches existing SKILL_DEFINITIONS but unified here)
    skills: {
        'problem-decomposition': '#3b82f6',
        'pattern-recognition': '#8b5cf6',
        'algorithmic-thinking': '#6366f1',
        'complexity-analysis': '#ec4899',
        'communication-clarity': '#10b981',
        'edge-case-awareness': '#f59e0b',
        'optimization-mindset': '#06b6d4',
        'debugging-approach': '#f97316',
    },
} as const;

export const SPRING = {
    gentle: { type: 'spring', stiffness: 300, damping: 30 },
    bouncy: { type: 'spring', stiffness: 400, damping: 20 },
    stiff: { type: 'spring', stiffness: 600, damping: 40 },
    slow: { type: 'spring', stiffness: 100, damping: 20 },
} as const;

export const TRANSITIONS = {
    page: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    card: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
    fast: { duration: 0.15 },
} as const;

export const ANIM = {
    fadeUp: {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
    },
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    },
    scaleIn: {
        initial: { opacity: 0, scale: 0.94 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
    },
    slideLeft: {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
    },
    slideRight: {
        initial: { opacity: 0, x: -24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 24 },
    },
} as const;

// Stagger children helper
export function staggerChildren(delayBetween = 0.07, initial = 0) {
    return {
        animate: { transition: { staggerChildren: delayBetween, delayChildren: initial } }
    };
}
