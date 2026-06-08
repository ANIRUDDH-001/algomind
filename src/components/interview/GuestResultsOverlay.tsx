/**
 * @codesage
 * @file      src/components/interview/GuestResultsOverlay.tsx
 * @purpose   Displays the assessment results for a guest user with a call-to-action to sign up.
 * @tech      React, Framer Motion, Lucide
 * @connects  @/components/assessment/ReportCard
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { motion } from 'framer-motion';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { ReportCard } from '@/components/assessment/ReportCard';
import { Button } from '@/components/ui/button';
import { LogIn, RotateCcw, Clock, MessageSquare } from 'lucide-react';

interface GuestResultsOverlayProps {
    assessment: AssessmentResult;
    durationSecs: number;
    roundCount: number;
    problemTitle: string;
    onTryAnother: () => void;
    onSignUp: () => void;
    onClose: () => void;    // resets result state (calls resetAssessment)
}

export function GuestResultsOverlay({
    assessment,
    durationSecs,
    roundCount,
    problemTitle,
    onTryAnother,
    onSignUp,
    onClose: _onClose,
}: GuestResultsOverlayProps) {
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const timeStr = `${mins}m ${secs}s`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[150] bg-[var(--surface-base)] overflow-y-auto"
            data-testid="guest-results-overlay"
        >
            {/* Sticky top bar */}
            <div className="sticky top-0 z-10 border-b border-white/5 px-4 py-2.5 flex items-center justify-between gap-3"
                style={{ background: 'rgba(2, 6, 23, 0.96)', backdropFilter: 'blur(12px)' }}>

                {/* Left: session summary */}
                <div className="flex items-center gap-3 text-xs text-zinc-400 min-w-0">
                    <span className="font-bold text-white truncate">{problemTitle}</span>
                    <span className="text-zinc-600 shrink-0">·</span>
                    <span className="flex items-center gap-1 shrink-0">
                        <MessageSquare className="w-3 h-3" />
                        {roundCount} rounds
                    </span>
                    <span className="text-zinc-600 shrink-0">·</span>
                    <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeStr}
                    </span>
                </div>

                {/* Right: CTAs */}
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        onClick={onTryAnother}
                        data-testid="try-another-button"
                        className="h-8 text-xs border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 gap-1.5"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Try Another
                    </Button>
                    <Button
                        onClick={onSignUp}
                        data-testid="sign-up-button"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5"
                    >
                        <LogIn className="w-3 h-3" />
                        Sign Up Free
                    </Button>
                </div>
            </div>

            {/* Not-saved notice */}
            <div className="max-w-5xl mx-auto px-4 pt-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/6 px-4 py-3 text-sm flex items-start gap-3">
                    <span className="text-base shrink-0">⚡</span>
                    <div>
                        <p className="text-amber-200 font-bold text-xs">Guest Session — Results Not Saved</p>
                        <p className="text-amber-400/70 text-xs mt-0.5">
                            Sign up free to save your performance history, track improvement over time,
                            and get unlimited AI-powered practice interviews.
                        </p>
                    </div>
                </div>
            </div>

            {/* ReportCard — onClose routes to sign-up for guests */}
            <ReportCard
                assessment={assessment}
                onClose={onSignUp}
            />
        </motion.div>
    );
}
