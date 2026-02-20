/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import { TourStep } from '@/lib/tour/steps';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demo/manager';

interface TourTooltipProps {
    step: TourStep;
    currentStepIndex: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    position: { top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' | 'center' };
}

export function TourTooltip({
    step,
    currentStepIndex,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    position
}: TourTooltipProps) {
    const isLastStep = currentStepIndex === totalSteps - 1;
    const isDemo = isDemoMode();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed z-[10002] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-6 max-w-[90vw] w-[400px]"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            {/* Skip Button */}
            <button
                onClick={onSkip}
                className="absolute top-4 right-4 text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider transition-colors"
                aria-label="Skip Tour"
            >
                Skip Tour
            </button>

            {/* Content */}
            <div className="space-y-4 pt-2">
                <div>
                    <h3 className="text-lg font-bold text-white mb-2 pr-16">{step.title}</h3>
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                        {step.content}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-semibold text-slate-500">
                        Step {currentStepIndex + 1} of {totalSteps}
                    </span>

                    <div className="flex gap-2">
                        {currentStepIndex > 0 && (
                            <Button
                                onClick={onPrev}
                                variant="outline"
                                size="sm"
                                className="border-slate-700 hover:bg-slate-800 text-slate-300"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                Back
                            </Button>
                        )}
                        <Button
                            onClick={onNext}
                            size="sm"
                            className={cn(
                                "font-bold shadow-lg shadow-blue-900/20",
                                isLastStep
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                            )}
                        >
                            {isLastStep ? "Finish" : "Next"}
                            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Arrow/Pointer (Optional visual flair) */}
            {/* We can calculate arrow position based on placement prop if needed, 
                but for now slight offset handling in IntroTour is enough */}
        </motion.div>
    );
}
