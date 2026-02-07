'use client';

import { useEffect, useState } from 'react';
import { useTour } from '@/components/tour/TourContext';
import { TourTooltip } from '@/components/tour/TourTooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { isDemoMode } from '@/lib/demo/manager';
import { cn } from '@/lib/utils';
// import { TourContextType } from './TourContext';

export function IntroTour() {
    const { isOpen, currentStep, currentStepIndex, nextStep, prevStep, endTour, isFirstVisit } = useTour();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' | 'center' }>({ top: 0, left: 0, placement: 'center' });
    const isDemo = isDemoMode();

    // Effect to find target element
    useEffect(() => {
        if (!isOpen || !currentStep) return;

        let interval: NodeJS.Timeout;

        const updatePosition = () => {
            if (currentStep.selector === 'body') {
                // Special case for full screen modal
                setTargetRect({
                    top: 0,
                    left: 0,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    bottom: window.innerHeight,
                    right: window.innerWidth,
                } as DOMRect);

                setTooltipPosition({
                    top: window.innerHeight / 2 - 125, // Approximate center
                    left: window.innerWidth / 2 - 200,
                    placement: 'center'
                });
                return;
            }

            const element = document.querySelector(currentStep.selector);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);

                // Calculate Tooltip Position
                const tooltipWidth = 400; // Expected width
                const tooltipHeight = 250; // Approx height
                const gap = 20;

                let top = 0;
                let left = 0;
                const placement = currentStep.position;

                // Simple positioning logic
                switch (placement) {
                    case 'top':
                        top = rect.top - tooltipHeight - gap;
                        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                        break;
                    case 'bottom':
                        top = rect.bottom + gap;
                        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                        break;
                    case 'left':
                        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
                        left = rect.left - tooltipWidth - gap;
                        break;
                    case 'right':
                        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
                        left = rect.right + gap;
                        break;
                    case 'center':
                    default:
                        top = window.innerHeight / 2 - (tooltipHeight / 2);
                        left = window.innerWidth / 2 - (tooltipWidth / 2);
                }

                // Boundary checks to keep on screen
                if (left < 10) left = 10;
                if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
                if (top < 10) top = 10;
                if (top + tooltipHeight > window.innerHeight - 10) top = window.innerHeight - tooltipHeight - 10;

                setTooltipPosition({ top, left, placement });
            } else {
                // If element not found, just center for now so user isn't stuck
                // But better to wait/retry
                // We keep interval running
            }
        };

        updatePosition();

        // Retry for 2 seconds to find element (helpful for page transitions)
        interval = setInterval(updatePosition, 100);
        const timeout = setTimeout(() => clearInterval(interval), 3000);

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, currentStep]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent scrolling
                nextStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevStep();
            } else if (e.key === 'Escape') {
                endTour();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextStep, prevStep, endTour]);

    if (!isOpen || !currentStep) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] overflow-hidden pointer-events-none font-sans">
                    {/* Dark Overlay with Spotlight Hole */}
                    <div className="absolute inset-0 bg-transparent pointer-events-auto">
                        <div className="absolute inset-0 bg-black/60 transition-colors duration-500"
                            style={{
                                maskImage: targetRect && currentStep.selector !== 'body' ?
                                    `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 1.5}px, black ${Math.max(targetRect.width, targetRect.height) / 1.4}px)`
                                    : 'none',
                                WebkitMaskImage: targetRect && currentStep.selector !== 'body' ?
                                    `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 1.5}px, black ${Math.max(targetRect.width, targetRect.height) / 1.4}px)`
                                    : 'linear-gradient(black, black)'
                            }}>
                            {/* Fallback box shadow for older browsers if mask fails */}
                        </div>

                        {/* Spotlight Ring */}
                        {targetRect && currentStep.selector !== 'body' && (
                            <motion.div
                                layoutId="spotlight-ring"
                                className="absolute rounded-xl border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                                style={{
                                    left: targetRect.left - 8,
                                    top: targetRect.top - 8,
                                    width: targetRect.width + 16,
                                    height: targetRect.height + 16,
                                }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            />
                        )}

                        {/* Mobile Click catcher to advance */}
                        <div
                            className="absolute inset-0 z-[10001] md:hidden"
                            onClick={(e) => {
                                // Only if clicking outside tooltip
                                nextStep();
                            }}
                        />
                    </div>

                    {/* Tooltip Layer */}
                    <div className="absolute inset-0 pointer-events-none z-[10010]">
                        <div className="pointer-events-auto">
                            <TourTooltip
                                step={currentStep}
                                currentStepIndex={currentStepIndex}
                                totalSteps={14} // should update context to expose totalSteps
                                onNext={nextStep}
                                onPrev={prevStep}
                                onSkip={endTour}
                                position={tooltipPosition}
                            />
                        </div>
                    </div>

                    {/* Demo Mode Banner (Pink) */}
                    {isDemo && (
                        <motion.div
                            initial={{ y: -50 }}
                            animate={{ y: 0 }}
                            className="fixed top-0 left-0 right-0 h-10 bg-pink-500 text-white flex items-center justify-center font-bold font-mono z-[10005] shadow-lg pointer-events-none"
                        >
                            🎪 Demo Mode Active - Exploring with sample data
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
}
