/**
 * @codesage
 * @file      src/components/tour/TourProvider.tsx
 * @purpose   Context provider orchestrating the interactive application tour logic.
 * @tech      React, Next.js App Router
 * @connects  next/navigation, @/lib/tour/index
 * @apis      None
 * @db        None
 * @state     Tour Context State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    TOUR_STEPS,
    TourStep,
    waitForElement,
    speakHint,
    stopSpeech,
} from '@/lib/tour/index';
// ─── Context type ─────────────────────────────────────────────────────────────

interface TourContextType {
    isOpen: boolean;
    currentStepIndex: number;
    currentStep: TourStep | null;
    targetRect: DOMRect | null;
    audioEnabled: boolean;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => void;
    startTour: () => void;
    toggleAudio: () => void;
    isNavigating: boolean; // true while waitForElement is polling
}

const TourContext = createContext<TourContextType | undefined>(undefined);

// ─── TourProvider ─────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true); // default ON for tour
    const router = useRouter();
    const pathname = usePathname();
    const navigatingRef = useRef(false);

    const currentStep = TOUR_STEPS[stepIndex] ?? null;

    // ─── resolveStep ────────────────────────────────────────────────────────────
    // Navigate to the step's route if needed, then wait for the target element.
    // Returns the element's rect (or null if not found / step is modal).

    const resolveStep = useCallback(
        async (step: TourStep): Promise<DOMRect | null> => {
            if (step.type === 'modal' || !step.target) {
                return null;
            }

            // Build full route string including optional tab param
            const fullRoute = step.route
                ? `${step.route}${step.routeParams ?? ''}${step.tabParam ? `${step.routeParams ? '&' : '?'}tab=${step.tabParam}` : ''
                }`
                : null;

            // Navigate if needed
            if (fullRoute) {
                const targetPath = step.route!;
                const targetTab = step.tabParam;
                const currentTab = new URLSearchParams(window.location.search).get('tab');
                const needsNav =
                    pathname !== targetPath ||
                    (targetTab && currentTab !== targetTab);

                if (needsNav) {
                    router.push(fullRoute);
                }
            }

            // Wait for the element to appear in the DOM
            setIsNavigating(true);
            const el = await waitForElement(step.target, 6000);
            setIsNavigating(false);

            if (!el) return null;

            // Scroll into view smoothly (only if not in a fixed container)
            if (!el.closest('.fixed') && !el.closest('[style*="position: fixed"]')) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Brief pause for scroll to settle before measuring
                await new Promise((r) => setTimeout(r, 200));
            }

            return el.getBoundingClientRect();
        },
        [pathname, router]
    );

    // ─── goToStep ───────────────────────────────────────────────────────────────

    const goToStep = useCallback(
        async (index: number) => {
            if (navigatingRef.current) return;
            navigatingRef.current = true;

            const step = TOUR_STEPS[index];
            if (!step) {
                // Past the end — finish tour
                localStorage.setItem('algomind_tour_completed', 'true');
                stopSpeech();
                setIsOpen(false);
                setStepIndex(0);
                navigatingRef.current = false;
                // Navigate to dashboard with post-tour flag
                router.push('/dashboard?tour=done');
                return;
            }

            setStepIndex(index);

            // Resolve target rect (navigates + polls)
            const rect = await resolveStep(step);
            setTargetRect(rect);

            // Speak hint after navigation settles
            speakHint(step.kaiSays, audioEnabled);

            navigatingRef.current = false;
        },
        [resolveStep, audioEnabled, router]
    );

    // ─── nextStep / prevStep / skipTour ─────────────────────────────────────────

    const nextStep = useCallback(() => {
        goToStep(stepIndex + 1);
    }, [stepIndex, goToStep]);

    const prevStep = useCallback(() => {
        if (stepIndex > 0) goToStep(stepIndex - 1);
    }, [stepIndex, goToStep]);

    const skipTour = useCallback(() => {
        localStorage.setItem('algomind_tour_skipped', 'true');
        stopSpeech();
        setIsOpen(false);
        setStepIndex(0);
        setTargetRect(null);
    }, []);

    // ─── startTour ──────────────────────────────────────────────────────────────

    const startTour = useCallback(() => {
        // Clear any old skipped flag so they can restart
        localStorage.removeItem('algomind_tour_skipped');
        setStepIndex(0);
        setTargetRect(null);
        setIsOpen(true);
        goToStep(0);
    }, [goToStep]);

    // ─── toggleAudio ────────────────────────────────────────────────────────────

    const toggleAudio = useCallback(() => {
        setAudioEnabled((prev) => {
            if (prev) stopSpeech();
            return !prev;
        });
    }, []);

    // ─── Re-measure target rect on resize/scroll ─────────────────────────────
    // Keep the spotlight ring aligned if the user resizes the window.

    useEffect(() => {
        if (!isOpen || !currentStep?.target) return;

        const update = () => {
            if (currentStep.target) {
                const el = document.querySelector(currentStep.target);
                if (el) setTargetRect(el.getBoundingClientRect());
            }
        };

        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('scroll', update, { passive: true, capture: true });
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [isOpen, currentStep]);

    // ─── Keyboard navigation ────────────────────────────────────────────────────

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') skipTour();
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                nextStep();
            }
            if (e.key === 'ArrowLeft') prevStep();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, nextStep, prevStep, skipTour]);

    // ─── Manual start trigger ─────────────────────────────────────────────────────
    // Only responds to 'start-tour' — dispatched by Settings panel + the manual Tour button.
    // Tour never auto-starts; only explicit button clicks trigger it.

    useEffect(() => {
        const onStartTour = () => startTour();

        window.addEventListener('start-tour', onStartTour);
        return () => {
            window.removeEventListener('start-tour', onStartTour);
        };
    }, [startTour]);

    return (
        <TourContext.Provider
            value={{
                isOpen,
                currentStepIndex: stepIndex,
                currentStep,
                targetRect,
                audioEnabled,
                nextStep,
                prevStep,
                skipTour,
                startTour,
                toggleAudio,
                isNavigating,
            }}
        >
            {children}
        </TourContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTour(): TourContextType {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error('useTour must be used within TourProvider');
    return ctx;
}
