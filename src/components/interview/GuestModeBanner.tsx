/**
 * @codesage
 * @file      src/components/interview/GuestModeBanner.tsx
 * @purpose   Displays a banner warning guest users about session limits and data persistence.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/hooks/useGuestSession, @/lib/interview/prompts
 * @apis      None
 * @db        None
 * @state     useState
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

import React, { useState } from 'react';
import { X, Sparkles, Clock, MessageSquare, Shield } from 'lucide-react';
import { GUEST_SESSION_LIMITS } from '@/hooks/useGuestSession';
import { GUEST_INTRO_BANNER } from '@/lib/interview/prompts';

const DISMISSED_KEY = 'algomind_guest_banner_dismissed';

interface GuestModeBannerProps {
    turnsUsed: number;
    timeRemaining: number;    // seconds
    onSignUp: () => void;
}

export function GuestModeBanner({ turnsUsed, timeRemaining, onSignUp }: GuestModeBannerProps) {
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            return sessionStorage.getItem(DISMISSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const handleDismiss = () => {
        setDismissed(true);
        try { sessionStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ignore */ }
    };

    if (dismissed) return null;

    const turnsLeft = Math.max(0, GUEST_SESSION_LIMITS.MAX_USER_TURNS - turnsUsed);
    const minsLeft = Math.floor(timeRemaining / 60);
    const secsLeft = timeRemaining % 60;
    const isUrgent = turnsLeft <= 1 || timeRemaining <= 60;

    return (
        <div
            data-testid="guest-mode-banner"
            className={`
                mx-4 mt-3 rounded-2xl border p-3.5
                flex flex-col gap-3
                transition-all duration-300
                ${isUrgent
                    ? 'border-amber-500/30 bg-amber-500/8'
                    : 'border-indigo-500/20 bg-indigo-500/6'
                }
                ${turnsLeft >= 9000 ? 'hidden' : ''}
            `}
        >
            {/* AlgoMind brand intro — always visible, not dismissable */}
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-bold text-white tracking-tight">
                        {GUEST_INTRO_BANNER.line1}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                        {GUEST_INTRO_BANNER.line2}
                    </p>
                </div>
                {/* Dismiss sits here so it's always accessible */}
                <button
                    data-testid="dismiss-guest-banner"
                    onClick={handleDismiss}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                    aria-label="Dismiss guest mode banner"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-zinc-700/50" />

            <div className="flex items-start gap-3 min-w-0">
                {/* Icon */}
                <div className={`
                    w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                    ${isUrgent ? 'bg-amber-500/15' : 'bg-indigo-500/15'}
                `}>
                    <Sparkles className={`w-4 h-4 ${isUrgent ? 'text-amber-400' : 'text-indigo-400'}`} />
                </div>

                <div className="space-y-2 min-w-0">
                    <p className={`text-xs font-bold ${isUrgent ? 'text-amber-300' : 'text-indigo-300'}`}>
                        Guest Mode — Session Not Saved
                    </p>

                    {/* Live stats row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <MessageSquare className="w-3 h-3" />
                            <strong className={isUrgent && turnsLeft <= 1 ? 'text-amber-400' : 'text-white'}>
                                {turnsLeft}
                            </strong>
                            {' '}round{turnsLeft !== 1 ? 's' : ''} left
                        </span>
                        <span className="w-px h-3 bg-zinc-700 shrink-0" />
                        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <strong className={isUrgent && timeRemaining <= 60 ? 'text-amber-400' : 'text-white'}>
                                {minsLeft}:{secsLeft.toString().padStart(2, '0')}
                            </strong>
                            {' '}remaining
                        </span>
                        <span className="w-px h-3 bg-zinc-700 shrink-0" />
                        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Shield className="w-3 h-3" />
                            Results shown, not saved
                        </span>
                    </div>

                    {/* Sign-up nudge */}
                    <button
                        onClick={onSignUp}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                    >
                        Sign up free to save progress & unlock unlimited practice →
                    </button>
                </div>
            </div>
        </div>
    );
}