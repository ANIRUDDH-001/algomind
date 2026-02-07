'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TOUR_STEPS, TourStep } from '@/lib/tour/steps';
import { useAuth } from '@/components/auth/AuthProvider';

interface TourContextType {
    isOpen: boolean;
    currentStepIndex: number;
    currentStep: TourStep | null;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => void;
    startTour: () => void;
    isFirstVisit: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isFirstVisit, setIsFirstVisit] = useState(false);
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    // const searchParams = useSearchParams(); // Not used directly in logic yet, but good to have if needed

    // Load tour state on mount
    useEffect(() => {
        if (loading) return;

        const hasCompletedTour = localStorage.getItem('algomind_tour_completed');
        const hasSkippedTour = localStorage.getItem('algomind_tour_skipped');
        const isNewUser = !hasCompletedTour && !hasSkippedTour;

        if (isNewUser) {
            setIsFirstVisit(true);
            // Delay auto-start slightly for better UX
            const timer = setTimeout(() => {
                setIsOpen(true);
                setCurrentStepIndex(0); // Start at Welcome Modal
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    const executeAction = useCallback(async (action: TourStep['action'], params: any) => {
        if (!action) return;

        if (action === 'navigate' && params?.path) {
            let url = params.path;
            if (params.query) {
                const queryString = new URLSearchParams(params.query).toString();
                url += `?${queryString}`;
            }
            router.push(url);

            // Wait for navigation
            // Simple delay, but in production ideally we'd wait for pathname change
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        if (action === 'wait') {
            await new Promise(resolve => setTimeout(resolve, params?.duration || 500));
        }
    }, [router]);

    const handleStepChange = useCallback(async (index: number) => {
        const step = TOUR_STEPS[index];
        if (!step) {
            setIsOpen(false);
            return;
        }

        // Execute pre-action if any (e.g. navigate before showing step)
        if (step.action) {
            await executeAction(step.action, step.actionParams);
        }

        setCurrentStepIndex(index);
    }, [executeAction]);

    const nextStep = useCallback(() => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < TOUR_STEPS.length) {
            handleStepChange(nextIndex);
        } else {
            // End of tour
            localStorage.setItem('algomind_tour_completed', 'true');
            setIsOpen(false);
        }
    }, [currentStepIndex, handleStepChange]);

    const prevStep = useCallback(() => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            handleStepChange(prevIndex);
        }
    }, [currentStepIndex, handleStepChange]);

    const skipTour = useCallback(() => {
        localStorage.setItem('algomind_tour_skipped', 'true');
        setIsOpen(false);
    }, []);

    const startTour = useCallback(() => {
        setIsOpen(true);
        handleStepChange(0); // Start from beginning
    }, [handleStepChange]);

    // Listen for custom start event (from settings)
    useEffect(() => {
        const handleStart = () => startTour();
        window.addEventListener('start-tour', handleStart);
        return () => window.removeEventListener('start-tour', handleStart);
    }, [startTour]);

    // Current step specific logic
    const currentStep = TOUR_STEPS[currentStepIndex];

    return (
        <TourContext.Provider value={{
            isOpen,
            currentStepIndex,
            currentStep,
            nextStep,
            prevStep,
            skipTour,
            startTour,
            isFirstVisit
        }}>
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (context === undefined) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
}
