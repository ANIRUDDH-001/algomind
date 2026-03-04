'use client';

import { useState, useCallback } from 'react';

const MAX_USER_TURNS = 10;  // Guest mode: 10 full rounds for a meaningful interview
const MAX_AI_TURNS = 10;
const STORAGE_KEY = 'algomind_guest_session';

export interface GuestSession {
    userTurns: number;
    aiTurns: number;
    isTrialComplete: boolean;
    showLoginPrompt: boolean;
    recordUserTurn: () => void;
    recordAITurn: () => void;
    reset: () => void;
}

export function useGuestSession(isGuest: boolean): GuestSession {
    const [userTurns, setUserTurns] = useState(() => {
        if (typeof window === 'undefined') return 0;
        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY}_user`);
            return stored ? parseInt(stored, 10) : 0;
        } catch {
            return 0;
        }
    });

    const [aiTurns, setAITurns] = useState(() => {
        if (typeof window === 'undefined') return 0;
        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY}_ai`);
            return stored ? parseInt(stored, 10) : 0;
        } catch {
            return 0;
        }
    });

    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    const isTrialComplete = isGuest && (userTurns >= MAX_USER_TURNS || aiTurns >= MAX_AI_TURNS);

    const checkLimits = useCallback((newUser: number, newAI: number) => {
        if (newUser >= MAX_USER_TURNS || newAI >= MAX_AI_TURNS) {
            setShowLoginPrompt(true);
        }
    }, []);

    const recordUserTurn = useCallback(() => {
        if (!isGuest) return;
        const newCount = userTurns + 1;
        setUserTurns(newCount);
        try { sessionStorage.setItem(`${STORAGE_KEY}_user`, newCount.toString()); } catch { }
        checkLimits(newCount, aiTurns);
    }, [isGuest, userTurns, aiTurns, checkLimits]);

    const recordAITurn = useCallback(() => {
        if (!isGuest) return;
        const newCount = aiTurns + 1;
        setAITurns(newCount);
        try { sessionStorage.setItem(`${STORAGE_KEY}_ai`, newCount.toString()); } catch { }
        checkLimits(userTurns, newCount);
    }, [isGuest, userTurns, aiTurns, checkLimits]);

    const reset = useCallback(() => {
        setUserTurns(0);
        setAITurns(0);
        setShowLoginPrompt(false);
        try {
            sessionStorage.removeItem(`${STORAGE_KEY}_user`);
            sessionStorage.removeItem(`${STORAGE_KEY}_ai`);
        } catch { }
    }, []);

    return {
        userTurns,
        aiTurns,
        isTrialComplete,
        showLoginPrompt,
        recordUserTurn,
        recordAITurn,
        reset
    };
}

export const GUEST_SESSION_LIMITS = { MAX_USER_TURNS, MAX_AI_TURNS };
