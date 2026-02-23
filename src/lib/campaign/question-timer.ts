import { QuestionState, CampaignData } from '@/types/campaign';

// Utility to compute effective remaining time for a question,
// accounting for already-elapsed seconds (for resume support).

export function getRemainingSeconds(state: QuestionState): number {
    const totalSecs = state.time_limit_mins * 60;
    if (state.status === 'completed' || state.status === 'time_expired') return 0;
    if (!state.started_at) return totalSecs;

    const startedAt = new Date(state.started_at).getTime();
    const nowMs = Date.now();
    const elapsed = Math.floor((nowMs - startedAt) / 1000) + (state.elapsed_secs || 0);
    // NOTE: elapsed_secs stores paused time before this session; 
    // time since started_at is live elapsed
    return Math.max(0, totalSecs - elapsed);
}

export function getDefaultTimeMins(difficulty: string, campaign: Pick<CampaignData, 'default_easy_mins' | 'default_medium_mins' | 'default_hard_mins'>): number {
    if (difficulty === 'easy') return campaign.default_easy_mins ?? 15;
    if (difficulty === 'medium') return campaign.default_medium_mins ?? 25;
    if (difficulty === 'hard') return campaign.default_hard_mins ?? 45;
    return campaign.default_medium_mins ?? 25;
}
