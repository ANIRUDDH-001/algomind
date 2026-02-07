'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TOUR_STEPS, TourStep } from '@/lib/tour/steps';
import { useAuth } from '@/components/auth/AuthProvider';
import { enableDemoMode, disableDemoMode } from '@/lib/demo/manager';

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

        // Robust Auto-Start Logic
        if (isNewUser && user) {
            setIsFirstVisit(true);

            // Delay auto-start slightly for better UX and to ensure UI is ready
            const timer = setTimeout(() => {
                setIsOpen(true);
                setCurrentStepIndex(0); // Start at Welcome Modal
            }, 2000); // Increased to 2s to be safe
            return () => clearTimeout(timer);
        } else if (!user) {
            // User not yet loaded or guest, skipping auto-start
        }
    }, [loading, user]);

    const executeAction = useCallback(async (action: TourStep['action']) => {
        if (typeof action === 'function') {
            try {
                await action({ router });
            } catch (error) {
                console.error('Tour action failed:', error);
            }
        }
    }, [router]);

    const getNextValidStepIndex = useCallback((currentIndex: number, direction: 'next' | 'prev'): number => {
        let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        // Loop until we find a valid step or hit the bounds
        while (nextIndex >= 0 && nextIndex < TOUR_STEPS.length) {
            const step = TOUR_STEPS[nextIndex];
            if (!step.shouldShow || step.shouldShow(user)) {
                return nextIndex;
            }
            nextIndex = direction === 'next' ? nextIndex + 1 : nextIndex - 1;
        }

        return nextIndex; // Return out of bounds index (stops tour)
    }, [user]);

    const handleStepChange = useCallback(async (index: number) => {
        const step = TOUR_STEPS[index];
        if (!step) {
            setIsOpen(false);
            return;
        }

        // Execute pre-action if any (e.g. navigate before showing step)
        if (step.action) {
            await executeAction(step.action);
        }

        setCurrentStepIndex(index);
    }, [executeAction]);

    const nextStep = useCallback(() => {
        const nextIndex = getNextValidStepIndex(currentStepIndex, 'next');
        if (nextIndex < TOUR_STEPS.length) {
            handleStepChange(nextIndex);
        } else {
            // End of tour
            localStorage.setItem('algomind_tour_completed', 'true');

            // Auto-disable Demo Mode
            disableDemoMode();
            window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: false } }));

            setIsOpen(false);
        }
    }, [currentStepIndex, handleStepChange, getNextValidStepIndex]);

    const prevStep = useCallback(() => {
        const prevIndex = getNextValidStepIndex(currentStepIndex, 'prev');
        if (prevIndex >= 0) {
            handleStepChange(prevIndex);
        }
    }, [currentStepIndex, handleStepChange, getNextValidStepIndex]);

    const skipTour = useCallback(() => {
        localStorage.setItem('algomind_tour_skipped', 'true');

        // Auto-disable Demo Mode on skip too
        disableDemoMode();
        window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: false } }));

        setIsOpen(false);
    }, []);

    const startTour = useCallback(() => {
        // Auto-enable Demo Mode
        enableDemoMode();
        window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: true } }));

        setIsOpen(true);
        // Find first valid step
        let firstIndex = 0;
        while (firstIndex < TOUR_STEPS.length) {
            const step = TOUR_STEPS[firstIndex];
            if (!step.shouldShow || step.shouldShow(user)) break;
            firstIndex++;
        }
        handleStepChange(firstIndex);
    }, [handleStepChange, user]);

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
