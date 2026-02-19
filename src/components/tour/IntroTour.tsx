'use client';

import React, { useEffect, useState } from 'react';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { useTour } from './TourContext';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMobileDevice } from '@/lib/utils/device-detection';

export function IntroTour() {
    const { isOpen, currentStep, nextStep, prevStep, skipTour, currentStepIndex } = useTour();
    const steps = TOUR_STEPS;
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const updateTargetRect = React.useCallback(() => {
        if (!currentStep || currentStep.type === 'modal' || !currentStep.target) {
            setTargetRect(null);
            return;
        }

        // Try to find the element
        const el = document.querySelector(currentStep.target);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
            // Ensure element is in view
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } else {
            // Check if we should wait for it (retry handled by effect below)
            setTargetRect(null);
        }
    }, [currentStep]);

    useEffect(() => {
        setIsMounted(true);
        setIsMobile(isMobileDevice());

        const handleResize = () => {
            setIsMobile(isMobileDevice());
            updateTargetRect();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', updateTargetRect, true);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', updateTargetRect, true);
        };
    }, [updateTargetRect]);

    // Smart Polling & Resize Logic
    useEffect(() => {
        if (!isOpen || !currentStep) return;

        let pollingInterval: NodeJS.Timeout;
        let stopPollingTimeout: NodeJS.Timeout;
        let resizeObserver: ResizeObserver;

        const cleanup = () => {
            clearInterval(pollingInterval);
            clearTimeout(stopPollingTimeout);
            if (resizeObserver) resizeObserver.disconnect();
        };

        let currentEl: Element | null = null;

        const checkTarget = () => {
            if (currentStep.type === 'modal' || !currentStep.target) {
                setTargetRect(null);
                currentEl = null;
                if (resizeObserver) resizeObserver.disconnect();
                return;
            }

            const el = document.querySelector(currentStep.target);

            // Case 1: Element found and is different from what we're tracking
            if (el && el !== currentEl) {
                currentEl = el;
                setTargetRect(el.getBoundingClientRect());
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

                // Re-attach observer to new element
                if (resizeObserver) resizeObserver.disconnect();
                resizeObserver = new ResizeObserver(() => {
                    if (el.isConnected) {
                        setTargetRect(el.getBoundingClientRect());
                    }
                });
                resizeObserver.observe(el);
            }
            // Case 2: Element found and same as tracking -> Check if it moved/detached
            else if (el && el === currentEl) {
                if (!el.isConnected) {
                    // Detached! Reset.
                    currentEl = null;
                    setTargetRect(null);
                } else {
                    // Still there, update rect just in case (e.g. scroll/layout shift not caught by resize)
                    // Optional: only do this if really needed, ResizeObserver covers size. 
                    // Scroll listener covers scroll.
                    // But if it was hidden via display:none, rect might be 0.
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) {
                        setTargetRect(null);
                    } else {
                        setTargetRect(rect);
                    }
                }
            }
            // Case 3: Element not found
            else if (!el) {
                currentEl = null;
                setTargetRect(null);
                if (resizeObserver) resizeObserver.disconnect();
            }
        };

        // 1. Immediate check
        checkTarget();

        // 2. Continuous Poll (every 200ms) - WE DO NOT STOP POLLING
        // This ensures if the element is replaced (React re-render), we find the new one.
        pollingInterval = setInterval(checkTarget, 200);

        // 3. Safety Timeout (30s) - Only stop if step takes too long, to save memory
        stopPollingTimeout = setTimeout(() => {
            clearInterval(pollingInterval);
        }, 30000);

        return cleanup;
    }, [isOpen, currentStep]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                skipTour();
            }
            if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                nextStep();
            }
            if (e.key === 'ArrowLeft') {
                prevStep();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextStep, prevStep, skipTour]);

    if (!isMounted || !isOpen || !currentStep) return null;

    // Portal for rendering outside normal flow
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (isMobile) {
            e.stopPropagation();
            nextStep();
        }
    };

    // Portal for rendering outside normal flow
    const renderContent = () => {
        // --- 1. Modal Step (Welcome / Completion) ---
        if (currentStep.type === 'modal') {
            return (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                            <div className="text-center space-y-6 pt-4">
                                <div className="w-20 h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4 relative">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-75" />
                                    <Sparkles className="w-10 h-10 text-blue-400" />
                                </div>

                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h2>
                                    <div className="text-slate-400 text-base leading-relaxed whitespace-pre-line">
                                        {currentStep.content}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 pt-4">
                                    <Button
                                        size="lg"
                                        onClick={nextStep}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/20"
                                    >
                                        {currentStepIndex === 0 ? "Start Tour" : "Finish"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={skipTour}
                                        className="text-slate-500 hover:text-white"
                                    >
                                        {currentStepIndex === 0 ? "Skip for now" : "Close"}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            );
        }

        // --- 2. Spotlight Step ---
        const hasTarget = !!targetRect;

        return (
            <div
                className={cn(
                    "fixed inset-0 z-[100]",
                    // On mobile, capture clicks everywhere (Tap to Next). 
                    // On desktop, passthrough events so user can interact IF target found.
                    isMobile ? "pointer-events-auto" : "pointer-events-none"
                )}
                onClick={handleBackdropClick}
            >
                {/* Spotlight Overlay via Box-Shadow */}
                {hasTarget ? (
                    <div
                        className={cn(
                            "absolute transition-all duration-300 ease-in-out pointer-events-none",
                            currentStep.spotlightShape === 'circle' ? "rounded-full" : "rounded-xl",
                            "border-[3px] border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                        )}
                        style={{
                            top: targetRect!.top - 8,
                            left: targetRect!.left - 8,
                            width: targetRect!.width + 16,
                            height: targetRect!.height + 16,
                            // The Box Shadow Trick: Creates the dark overlay with a cutout
                            boxShadow: `0 0 0 9999px ${isMobile ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0.75)'}`,
                        }}
                    />
                ) : (
                    // Fallback full overlay if target not found yet
                    // Make this pointer-events-auto always to block page interaction when target missing
                    <div className="absolute inset-0 bg-slate-950/80 pointer-events-auto" />
                )}

                {/* Tooltip */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()} // Prevent tap-to-next when clicking tooltip itself
                        className={cn(
                            "pointer-events-auto absolute",
                            isMobile
                                ? cn(
                                    "left-0 right-0 p-4",
                                    // Default to bottom sheet, but allow override to top
                                    currentStep.mobilePosition === 'top'
                                        ? "top-20 rounded-b-3xl border-t-0 shadow-xl"
                                        : "bottom-0 rounded-t-3xl border-b-0"
                                )
                                : "max-w-xs" // Desktop
                        )}
                        style={!isMobile && hasTarget ? {
                            // Desktop Positioning with Clamping to prevent overflow
                            top: Math.max(10, Math.min(window.innerHeight - 300,
                                currentStep.position === 'top' ? targetRect!.top - 200 :
                                    currentStep.position === 'bottom' ? targetRect!.bottom + 20 :
                                        targetRect!.top
                            )),
                            left: Math.max(10, Math.min(window.innerWidth - 350,
                                currentStep.position === 'left' ? targetRect!.left - 340 :
                                    currentStep.position === 'right' ? targetRect!.right + 20 :
                                        targetRect!.left + (targetRect!.width / 2) - 160
                            )),
                        } : isMobile ? undefined : {
                            // Centered Desktop Fallback if target missing
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <div className={cn(
                            "bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden",
                            isMobile
                                ? cn(
                                    currentStep.mobilePosition === 'top' ? "rounded-b-2xl border-t-0" : "rounded-t-3xl border-b-0 pb-8"
                                )
                                : "rounded-2xl"
                        )}>
                            {isMobile && currentStep.mobilePosition !== 'top' && (
                                <div className="w-full flex justify-center pt-3 pb-1">
                                    <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
                                </div>
                            )}

                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-white text-lg">{currentStep.title}</h3>
                                    <button onClick={skipTour} className="text-slate-500 hover:text-white p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                    {currentStep.content}
                                </p>

                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-medium text-slate-500">
                                        Step {currentStepIndex + 1} of {steps.length}
                                    </span>
                                    <div className="flex gap-2">
                                        {currentStepIndex > 0 && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={prevStep}
                                                className="h-9 px-3 border-slate-700 text-slate-300"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={nextStep}
                                            className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20"
                                        >
                                            {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
                                            {currentStepIndex !== steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600" />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div >
        );
    };

    return createPortal(renderContent(), document.body);
}
