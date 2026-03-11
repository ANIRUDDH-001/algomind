'use client';

import { useState, useCallback } from 'react';

const TURNS_PER_PROBLEM = 15;
const MAX_USER_TURNS = 75; // 15 turns × 5 problems
const MAX_AI_TURNS = 75;
const STORAGE_KEY = 'algomind_guest_session';

export interface GuestSession {
    userTurns: number;
    aiTurns: number;
    isTrialComplete: boolean;
    showLoginPrompt: boolean;
    recordUserTurn: () => void;
    recordAITurn: () => void;
    recordTurnForProblem: (problemId: string) => void;
    getTurnsForProblem: (problemId: string) => number;
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

    const [problemTurns, setProblemTurns] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return {};
        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY}_problem_turns`);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    const isTrialComplete = isGuest && (userTurns >= MAX_USER_TURNS || aiTurns >= MAX_AI_TURNS);

    const checkLimits = useCallback((newUser: number, newAI: number) => {
        if (newUser >= MAX_USER_TURNS || newAI >= MAX_AI_TURNS) {
            setShowLoginPrompt(true);
        }
    }, []);

    const recordTurnForProblem = useCallback((problemId: string) => {
        if (!isGuest) return;
        setProblemTurns(prev => {
            const next = { ...prev, [problemId]: (prev[problemId] ?? 0) + 1 };
            try { sessionStorage.setItem(`${STORAGE_KEY}_problem_turns`, JSON.stringify(next)); } catch { }
            return next;
        });
    }, [isGuest]);

    const getTurnsForProblem = useCallback((problemId: string) => {
        return problemTurns[problemId] ?? 0;
    }, [problemTurns]);

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
        setProblemTurns({});
        setShowLoginPrompt(false);
        try {
            sessionStorage.removeItem(`${STORAGE_KEY}_user`);
            sessionStorage.removeItem(`${STORAGE_KEY}_ai`);
            sessionStorage.removeItem(`${STORAGE_KEY}_problem_turns`);
        } catch { }
    }, []);

    return {
        userTurns,
        aiTurns,
        isTrialComplete,
        showLoginPrompt,
        recordUserTurn,
        recordAITurn,
        recordTurnForProblem,
        getTurnsForProblem,
        reset
    };
}

export { TURNS_PER_PROBLEM };
export const GUEST_SESSION_LIMITS = { MAX_USER_TURNS, MAX_AI_TURNS };
