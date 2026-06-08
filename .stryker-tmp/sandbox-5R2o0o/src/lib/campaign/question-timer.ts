/**
 * @codesage
 * @file      src/lib/campaign/question-timer.ts
 * @purpose   Campaign code verification and timer handling.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { QuestionState, CampaignData } from '@/types/campaign';

// Utility to compute effective remaining time for a question,
// accounting for already-elapsed seconds (for resume support).

export function getRemainingSeconds(state: QuestionState): number {
    const totalSecs = state.time_limit_mins * 60;
    if (state.status === 'completed' || state.status === 'expired') return 0;
    if (!state.started_at) return totalSecs;

    const nowMs = Date.now();
    const startedAt = new Date(state.started_at).getTime();
    const currentSessionElapsed = Math.floor((nowMs - startedAt) / 1000);
    const previousElapsed = state.elapsed_secs || 0; // Time accumulated before current session
    const totalElapsed = currentSessionElapsed + previousElapsed;
    return Math.max(0, totalSecs - totalElapsed);
}

export function getDefaultTimeMins(difficulty: string, campaign: Pick<CampaignData, 'default_easy_mins' | 'default_medium_mins' | 'default_hard_mins'>): number {
    if (difficulty === 'easy') return campaign.default_easy_mins ?? 15;
    if (difficulty === 'medium') return campaign.default_medium_mins ?? 25;
    if (difficulty === 'hard') return campaign.default_hard_mins ?? 45;
    return campaign.default_medium_mins ?? 25;
}
