/**
 * @codesage
 * @file      src/components/tour/TourOverlay.tsx
 * @purpose   Global overlay that renders the active tour step (modal or spotlight).
 * @tech      React, Framer Motion, ReactDOM Portals
 * @connects  framer-motion, @/hooks/use-media-query, ./TourProvider, ./KaiModal, ./TourCard
 * @apis      None
 * @db        None
 * @state     Local Component State (isMounted)
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
'use client';

/* eslint-disable react-hooks/set-state-in-effect */


import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTour } from './TourProvider';
import { KaiModal } from './KaiModal';
import { TourCard } from './TourCard';
import { TOUR_STEPS, type TourStep } from '@/lib/tour/index';
import { cn } from '@/lib/utils';

const SPOTLIGHT_PADDING = 10; // px padding around target element
const TOOLTIP_WIDTH = 340;
const TOOLTIP_VIEWPORT_PADDING = 16;

// Count of spotlight steps for progress display
const TOTAL_SPOTLIGHT = TOUR_STEPS.filter((s: TourStep) => s.type === 'spotlight').length;
// Map from overall step index → spotlight-only step index (for progress display)
let _spotlightCounter = 0;
const SPOTLIGHT_INDEX_MAP: Record<number, number> = {};
TOUR_STEPS.forEach((s: TourStep, i: number) => {
    if (s.type === 'spotlight') {
        SPOTLIGHT_INDEX_MAP[i] = _spotlightCounter++;
    }
});

// ─── Tooltip position calculator ─────────────────────────────────────────────

function calcTooltipPosition(
    targetRect: DOMRect,
    position: string,
    isMobile: boolean
): { top: number; left: number } {
    if (isMobile) {
        // Handled via CSS fixed positioning, not JS
        return { top: 0, left: 0 };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = TOOLTIP_VIEWPORT_PADDING;
    const tw = TOOLTIP_WIDTH;
    const th = 260; // approximate tooltip height

    let top = 0;
    let left = 0;

    switch (position) {
        case 'top':
            top = targetRect.top - SPOTLIGHT_PADDING - th - 12;
            left = targetRect.left + targetRect.width / 2 - tw / 2;
            break;
        case 'bottom':
            top = targetRect.bottom + SPOTLIGHT_PADDING + 12;
            left = targetRect.left + targetRect.width / 2 - tw / 2;
            break;
        case 'left':
            top = targetRect.top + targetRect.height / 2 - th / 2;
            left = targetRect.left - SPOTLIGHT_PADDING - tw - 12;
            break;
        case 'right':
            top = targetRect.top + targetRect.height / 2 - th / 2;
            left = targetRect.right + SPOTLIGHT_PADDING + 12;
            break;
        default:
            top = targetRect.bottom + SPOTLIGHT_PADDING + 12;
            left = targetRect.left + targetRect.width / 2 - tw / 2;
    }

    // Clamp to viewport
    top = Math.max(pad, Math.min(vh - th - pad, top));
    left = Math.max(pad, Math.min(vw - tw - pad, left));

    return { top, left };
}

// ─── TourOverlay ─────────────────────────────────────────────────────────────

export function TourOverlay() {
    const {
        isOpen,
        currentStep,
        currentStepIndex,
        targetRect,
        audioEnabled,
        isNavigating,
        nextStep,
        prevStep,
        skipTour,
        toggleAudio,
    } = useTour();

    const [isMounted, setIsMounted] = useState(false);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const tooltipRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(false);

    const restorePreviousFocus = useCallback(() => {
        window.setTimeout(() => {
            previousFocusRef.current?.focus();
        }, 100);
    }, []);

    const handleTourEnd = useCallback(() => {
        skipTour();
    }, [skipTour]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            handleTourEnd();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusableElements = tooltipRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
        }
    }, [handleTourEnd]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            wasOpenRef.current = true;
            return;
        }

        if (!isOpen && wasOpenRef.current) {
            wasOpenRef.current = false;
            restorePreviousFocus();
        }
    }, [isOpen, restorePreviousFocus]);

    useEffect(() => {
        if (!isOpen || !currentStep || currentStep.type !== 'spotlight') return;

        const timer = window.setTimeout(() => {
            tooltipRef.current?.focus();
        }, 50);

        return () => {
            window.clearTimeout(timer);
        };
    }, [currentStepIndex, currentStep, isOpen]);

    if (!isMounted || !isOpen || !currentStep) return null;

    const renderContent = () => {
        // ── Modal step ────────────────────────────────────────────────────────────
        if (currentStep.type === 'modal') {
            const isWelcome = currentStep.id === 0;
            const isFinish = currentStep.id === TOUR_STEPS[TOUR_STEPS.length - 1].id;

            return (
                <AnimatePresence>
                    <motion.div
                        key={`modal-${currentStep.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 10050,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(10,10,15,0.88)',
                            backdropFilter: 'blur(8px)',
                            padding: 20,
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 16 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                            style={{
                                background: 'var(--surface-1)',
                                border: '1px solid rgba(99,102,241,0.25)',
                                borderRadius: 24,
                                padding: '36px 32px',
                                maxWidth: 460,
                                width: '100%',
                                boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Top gradient bar */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #10b981)' }} />

                            {/* Ambient glow */}
                            <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

                            {/* Kai 3D cube */}
                            <div style={{ marginBottom: 20 }}>
                                <KaiModal mood={currentStep.kaiMood ?? 'waving'} />
                            </div>

                            {/* Title */}
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 12px', lineHeight: 1.25 }}>
                                {currentStep.title}
                            </h2>

                            {/* Body */}
                            <p style={{ fontSize: 14, color: 'rgba(161,161,170,0.9)', lineHeight: 1.7, margin: '0 0 28px' }}>
                                {currentStep.body}
                            </p>

                            {/* Final modal — report card preview bullets */}
                            {isFinish && (
                                <div style={{
                                    background: 'rgba(99,102,241,0.08)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: 14,
                                    padding: '14px 16px',
                                    marginBottom: 24,
                                    textAlign: 'left',
                                }}>
                                    {[
                                        { icon: '🎯', text: 'Animated score circle (0–10, live fill)' },
                                        { icon: '🧠', text: '8-skill breakdown with transcript evidence' },
                                        { icon: '💡', text: 'Key moments: approach found, self-corrections, misses' },
                                        { icon: '📝', text: '"What You Should Have Said" for weak areas' },
                                        { icon: '🏢', text: 'Hire Decision: STRONG_HIRE → STRONG_NO_HIRE' },
                                    ].map(({ icon, text }) => (
                                        <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                                            <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                                            <span style={{ fontSize: 12, color: 'rgba(199,199,210,0.9)', lineHeight: 1.4 }}>{text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Button
                                    onClick={nextStep}
                                    size="lg"
                                    className={cn(
                                        'w-full h-12 font-bold rounded-xl text-sm',
                                        isFinish
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                                    )}
                                >
                                    {currentStep.ctaLabel ?? (isWelcome ? 'Show Me Around' : 'Finish')}
                                </Button>
                                <Button
                                    onClick={handleTourEnd}
                                    variant="ghost"
                                    size="sm"
                                    className="text-zinc-600 hover:text-zinc-300 text-xs"
                                >
                                    {isWelcome ? 'Skip tour' : 'Close'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            );
        }

        // ── Spotlight step ────────────────────────────────────────────────────────
        const hasTarget = !!targetRect;
        const spotlightIndex = SPOTLIGHT_INDEX_MAP[currentStepIndex] ?? 0;
        const isLastSpotlight = currentStepIndex === TOUR_STEPS.length - 2;
        const tooltipPos = hasTarget && !isMobile
            ? calcTooltipPosition(
                targetRect!,
                currentStep.position ?? 'bottom',
                isMobile
            )
            : null;

        return (
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 10050 }}
                onClick={isMobile ? nextStep : undefined}
            >
                {/* Dark overlay with spotlight cutout using box-shadow trick */}
                {hasTarget ? (
                    <motion.div
                        key={`spot-${currentStep.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: 'fixed',
                            pointerEvents: 'none',
                            top: targetRect!.top - SPOTLIGHT_PADDING,
                            left: targetRect!.left - SPOTLIGHT_PADDING,
                            width: targetRect!.width + SPOTLIGHT_PADDING * 2,
                            height: targetRect!.height + SPOTLIGHT_PADDING * 2,
                            borderRadius:
                                currentStep.shape === 'pill'
                                    ? 999
                                    : currentStep.shape === 'rounded'
                                        ? 14
                                        : 8,
                            border: '2px solid rgba(99,102,241,0.75)',
                            boxShadow: [
                                '0 0 0 9999px rgba(5,5,10,0.78)',
                                '0 0 20px rgba(99,102,241,0.4)',
                                '0 0 40px rgba(99,102,241,0.15)',
                            ].join(', '),
                            zIndex: 10051,
                        }}
                    />
                ) : (
                    // Fallback: solid overlay if element not found yet
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.78)', pointerEvents: 'none' }} />
                )}

                {/* Tooltip card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`card-${currentStep.id}`}
                        ref={tooltipRef}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Tour step ${spotlightIndex + 1} of ${TOTAL_SPOTLIGHT}`}
                        style={
                            isMobile
                                ? {
                                    position: 'fixed',
                                    left: 0,
                                    right: 0,
                                    [currentStep.mobilePosition === 'top' ? 'top' : 'bottom']: 0,
                                    zIndex: 10052,
                                    padding: '12px 12px 24px',
                                    pointerEvents: 'auto',
                                }
                                : {
                                    position: 'fixed',
                                    top: tooltipPos?.top ?? '50%',
                                    left: tooltipPos?.left ?? '50%',
                                    transform: tooltipPos ? 'none' : 'translate(-50%,-50%)',
                                    zIndex: 10052,
                                    pointerEvents: 'auto',
                                }
                        }
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                    >
                        <TourCard
                            title={currentStep.title}
                            body={currentStep.body}
                            kaiSays={currentStep.kaiSays}
                            stepIndex={spotlightIndex}
                            totalSpotlight={TOTAL_SPOTLIGHT}
                            audioEnabled={audioEnabled}
                            isNavigating={isNavigating}
                            onNext={nextStep}
                            onPrev={prevStep}
                            onSkip={handleTourEnd}
                            onToggleAudio={toggleAudio}
                            showBack={currentStepIndex > 1}
                            isLast={isLastSpotlight}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Mobile tap hint */}
                {isMobile && (
                    <div style={{
                        position: 'fixed', bottom: 130, left: 0, right: 0,
                        textAlign: 'center', pointerEvents: 'none', zIndex: 10052,
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(113,113,122,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                            tap anywhere to advance
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return createPortal(renderContent(), document.body);
}
