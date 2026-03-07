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
    isHalfTime: boolean;
    shouldShowTurnWarning: boolean;
    formattedElapsed: string; // MM:SS
    formattedRemaining: string; // MM:SS
    formattedTotal: string; // MM:SS — total duration for the mode
    startTimer: () => void;
    stopTimer: () => void;
    incrementTurn: () => void;
    reset: () => void;
}

export function useInterviewLimits(options?: {
    maxDurationMins?: number;   // old path: minutes
    maxDurationMs?: number;     // InterviewConfig path: milliseconds
    maxTurnsPerProblem?: number; // InterviewConfig field name
    maxTurns?: number;           // old field name
    startTimeOffsetSeconds?: number;
    isUnlimited?: boolean;       // InterviewConfig field
}): InterviewLimits {
    const maxDurationMs =
        options?.maxDurationMs ??
        ((options?.maxDurationMins ?? 20) * 60 * 1000);
    const effectiveMaxTurns =
        options?.maxTurnsPerProblem ??
        options?.maxTurns ??
        MAX_TURNS;
    const isUnlimited = options?.isUnlimited ?? false;
    const initialElapsed = options?.startTimeOffsetSeconds || 0;

    const [elapsedTime, setElapsedTime] = useState(initialElapsed); // in seconds
    const [turnsUsed, setTurnsUsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const elapsedTimeRef = useRef(elapsedTime);

    useEffect(() => { elapsedTimeRef.current = elapsedTime; }, [elapsedTime]);

    // Timer effect
    useEffect(() => {
        if (isRunning) {
            startTimeRef.current = Date.now() - (elapsedTimeRef.current * 1000);

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
    const timeRemaining = Math.max(0, Math.floor(maxDurationMs / 1000) - elapsedTime);
    const turnsRemaining = isUnlimited ? 9999 : Math.max(0, effectiveMaxTurns - turnsUsed);
    const isTimeUp = !isUnlimited && (elapsedTime >= maxDurationMs / 1000);
    const isTurnsUp = !isUnlimited && (turnsUsed >= effectiveMaxTurns);
    const isHalfTime = !isUnlimited && (elapsedTime >= Math.floor(maxDurationMs / 2000));
    const shouldShowTurnWarning = !isUnlimited && turnsRemaining <= WARNING_TURNS_REMAINING && !isTurnsUp;

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const totalSeconds = Math.floor(maxDurationMs / 1000);

    return {
        elapsedTime,
        turnsUsed,
        turnsRemaining,
        timeRemaining,
        isTimeUp,
        isTurnsUp,
        isHalfTime,
        shouldShowTurnWarning,
        formattedElapsed: formatTime(elapsedTime),
        formattedRemaining: formatTime(timeRemaining),
        formattedTotal: formatTime(totalSeconds),
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
