'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { TOUR_STEPS, TourStep } from '@/lib/tour/steps';
import { useRouter, usePathname } from 'next/navigation';
import { isDemoMode } from '@/lib/demo/manager';

interface TourContextType {
    isOpen: boolean;
    currentStepIndex: number;
    currentStep: TourStep | null;
    startTour: () => void;
    endTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
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
    const isDemo = isDemoMode();

    // Filter steps based on authentication and demo mode
    const filteredSteps = TOUR_STEPS.filter(step => {
        // 1. Guest Logic: If user is guest (!user), only allow guestAllowed steps
        if (!user && !step.guestAllowed) return false;

        // 2. Demo Logic: If specific step is demoOnly, usage depends on isDemo
        // But current steps list doesn't have strict demoOnly logic preventing non-demo, 
        // except possibly history.
        // Let's rely on guestAllowed mainly.
        return true;
    });

    const currentStep = filteredSteps[currentStepIndex] || null;

    useEffect(() => {
        // Check local storage for first visit
        const visited = localStorage.getItem('algomind_tour_completed');
        if (!visited) {
            setIsFirstVisit(true);
            // Auto start if not visited and not loading auth
            if (!loading) {
                // setTimeout(() => setIsOpen(true), 1000); // Delay for intro animation?
                // Actually user said intro animation (video) remains. 
                // We should probably wait for user to finish video or just let them click start.
                // Requirement: "First-Time Users: Auto-start the tour immediately after login/signup or when entering as guest"
                // IntroAnimation component handles the "video".
                // We shouldn't interrupt the video. 
                // The IntroAnimation calls `onComplete`. maybe we hook into that?
                // For now, let's just expose startTour and let Page.tsx call it?
                // OR check if we are on home page and intro is done?
                // Let's set a flag to auto-start.
            }
        }
    }, [loading]);

    // Handle navigation when step changes
    useEffect(() => {
        if (isOpen && currentStep) {
            if (pathname !== currentStep.targetPath) {
                // Check if we need to add query params or just path
                const [path, query] = currentStep.targetPath.split('?');
                if (pathname !== path) {
                    router.push(currentStep.targetPath);
                } else if (query) {
                    // Check if query params match, if not push
                    // Simple check: just push to ensure consistency
                    router.push(currentStep.targetPath);
                }
            }
        }
    }, [isOpen, currentStep, pathname, router]);

    // Listen for custom event from Settings
    useEffect(() => {
        const handleStart = () => startTour();
        window.addEventListener('start-tour', handleStart);
        return () => window.removeEventListener('start-tour', handleStart);
    }, []);

    const startTour = useCallback(() => {
        setCurrentStepIndex(0);
        setIsOpen(true);
        // If first step is not current path, router will handle it in effect
    }, []);

    const endTour = useCallback(() => {
        setIsOpen(false);
        localStorage.setItem('algomind_tour_completed', 'true');
    }, []);

    const nextStep = useCallback(() => {
        if (currentStepIndex < filteredSteps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            endTour();
        }
    }, [currentStepIndex, filteredSteps.length, endTour]);

    const prevStep = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    }, [currentStepIndex]);

    return (
        <TourContext.Provider value={{
            isOpen,
            currentStepIndex,
            currentStep,
            startTour,
            endTour,
            nextStep,
            prevStep,
            isFirstVisit
        }}>
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (!context) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
}
