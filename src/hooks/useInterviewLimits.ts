'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Interview limits configuration
const MAX_DURATION_MS = 20 * 60 * 1000; // 20 minutes
const MAX_TURNS = 20;
const WARNING_TURNS_REMAINING = 5;

export interface InterviewLimits {
    elapsedTime: number; // in seconds
    turnsUsed: number;
    turnsRemaining: number;
    timeRemaining: number; // in seconds
    isTimeUp: boolean;
    isTurnsUp: boolean;
    shouldShowTurnWarning: boolean;
    formattedElapsed: string; // MM:SS
    formattedRemaining: string; // MM:SS
    startTimer: () => void;
    stopTimer: () => void;
    incrementTurn: () => void;
    reset: () => void;
}

export function useInterviewLimits(): InterviewLimits {
    const [elapsedTime, setElapsedTime] = useState(0); // in seconds
    const [turnsUsed, setTurnsUsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Timer effect
    useEffect(() => {
        if (isRunning) {
            startTimeRef.current = Date.now() - (elapsedTime * 1000);

            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setElapsedTime(elapsed);
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning]);

    const startTimer = useCallback(() => {
        setIsRunning(true);
    }, []);

    const stopTimer = useCallback(() => {
        setIsRunning(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
    }, []);

    const incrementTurn = useCallback(() => {
        setTurnsUsed(prev => prev + 1);
    }, []);

    const reset = useCallback(() => {
        setElapsedTime(0);
        setTurnsUsed(0);
        setIsRunning(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
    }, []);

    // Derived values
    const timeRemaining = Math.max(0, Math.floor(MAX_DURATION_MS / 1000) - elapsedTime);
    const turnsRemaining = Math.max(0, MAX_TURNS - turnsUsed);
    const isTimeUp = elapsedTime >= MAX_DURATION_MS / 1000;
    const isTurnsUp = turnsUsed >= MAX_TURNS;
    const shouldShowTurnWarning = turnsRemaining > 0 && turnsRemaining <= WARNING_TURNS_REMAINING;

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        elapsedTime,
        turnsUsed,
        turnsRemaining,
        timeRemaining,
        isTimeUp,
        isTurnsUp,
        shouldShowTurnWarning,
        formattedElapsed: formatTime(elapsedTime),
        formattedRemaining: formatTime(timeRemaining),
        startTimer,
        stopTimer,
        incrementTurn,
        reset
    };
}

// Export constants for use elsewhere
export const INTERVIEW_LIMITS = {
    MAX_DURATION_MS,
    MAX_TURNS,
    WARNING_TURNS_REMAINING
};
