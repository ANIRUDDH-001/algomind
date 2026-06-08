/**
 * @codesage
 * @file      src/components/tour/TourCard.tsx
 * @purpose   Floating tooltip card for interactive tour steps.
 * @tech      React, Framer Motion, TailwindCSS
 * @connects  framer-motion, lucide-react, @/components/ui/button
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
import { X, ChevronRight, ChevronLeft, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TourCardProps {
    title: string;
    body: string;
    kaiSays: string;
    stepIndex: number;     // 0-based, counting only spotlight steps shown
    totalSpotlight: number;
    audioEnabled: boolean;
    isNavigating: boolean;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onToggleAudio: () => void;
    showBack: boolean;
    isLast: boolean;
}

export function TourCard({
    title, body, kaiSays, stepIndex, totalSpotlight,
    audioEnabled, isNavigating, onNext, onPrev, onSkip,
    onToggleAudio, showBack, isLast,
}: TourCardProps) {
    const progress = ((stepIndex + 1) / totalSpotlight) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--surface-edge-hi, rgba(255,255,255,0.12))',
                width: 340,
                maxWidth: 'calc(100vw - 32px)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)', backgroundSize: '200% 100%' }} />

            <div style={{ padding: '16px 18px 18px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.35, flex: 1, margin: 0 }}>
                        {title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <button
                            onClick={onToggleAudio}
                            title={audioEnabled ? 'Mute hints' : 'Hear hints'}
                            style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: audioEnabled ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.3)', transition: 'color 0.15s' }}
                        >
                            {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                        </button>
                        <button
                            onClick={onSkip}
                            title="Exit tour"
                            style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', transition: 'color 0.15s' }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Kai hint chip */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 11px', borderRadius: 10, marginBottom: 10,
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)',
                }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 900, color: 'white',
                    }}>K</div>
                    <p style={{ fontSize: 12, color: 'rgba(165,180,252,0.9)', margin: 0, fontWeight: 600, lineHeight: 1.3 }}>
                        {kaiSays}
                    </p>
                </div>

                {/* Body */}
                <p style={{ fontSize: 13, color: 'rgba(161,161,170,0.9)', lineHeight: 1.6, margin: '0 0 16px' }}>
                    {body}
                </p>

                {/* Progress bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-3, rgba(255,255,255,0.06))', marginBottom: 14, overflow: 'hidden' }}>
                    <motion.div
                        style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(113,113,122,0.9)', fontVariantNumeric: 'tabular-nums' }}>
                        {stepIndex + 1} / {totalSpotlight}
                    </span>

                    <div style={{ display: 'flex', gap: 8 }}>
                        {showBack && (
                            <Button
                                onClick={onPrev}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                disabled={isNavigating}
                            >
                                <ChevronLeft size={13} className="mr-0.5" />
                                Back
                            </Button>
                        )}
                        <Button
                            onClick={onNext}
                            size="sm"
                            disabled={isNavigating}
                            className={cn(
                                'h-8 px-4 text-xs font-bold',
                                isLast
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                            )}
                        >
                            {isNavigating ? (
                                <Loader2 size={13} className="animate-spin mr-1" />
                            ) : null}
                            {isLast ? 'Finish' : 'Next'}
                            {!isLast && !isNavigating && <ChevronRight size={13} className="ml-0.5" />}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
