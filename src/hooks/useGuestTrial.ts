'use client';

import { useState, useCallback } from 'react';

// Guest trial configuration
const GUEST_MAX_TURNS = 5; // AI speaks → User speaks → AI responds (x2) = 5 turns
const STORAGE_KEY = 'algomind_guest_trial';

export interface GuestTrial {
    turnsUsed: number;
    isTrialComplete: boolean;
    showLoginPrompt: boolean;
    recordTurn: () => void;
    reset: () => void;
}

export function useGuestTrial(isGuest: boolean): GuestTrial {
    const [turnsUsed, setTurnsUsed] = useState(() => {
        if (typeof window === 'undefined') return 0;
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            return stored ? parseInt(stored, 10) : 0;
        } catch {
            return 0;
        }
    });

    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    const isTrialComplete = isGuest && turnsUsed >= GUEST_MAX_TURNS;

    const recordTurn = useCallback(() => {
        if (!isGuest) return;

        const newCount = turnsUsed + 1;
        setTurnsUsed(newCount);

        try {
            sessionStorage.setItem(STORAGE_KEY, newCount.toString());
        } catch {
            // Ignore storage errors
        }

        // Show login prompt after trial complete
        if (newCount >= GUEST_MAX_TURNS) {
            setShowLoginPrompt(true);
        }
    }, [isGuest, turnsUsed]);

    const reset = useCallback(() => {
        setTurnsUsed(0);
        setShowLoginPrompt(false);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
    }, []);

    return {
        turnsUsed,
        isTrialComplete,
        showLoginPrompt,
        recordTurn,
        reset
    };
}

// Export constants
export const GUEST_TRIAL_LIMITS = {
    MAX_TURNS: GUEST_MAX_TURNS
};
