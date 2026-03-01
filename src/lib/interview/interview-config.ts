/**
 * interview-config.ts
 * 
 * Every session setting flows from ONE of these three resolver functions.
 * No limits are defined anywhere else.
 *
 * account_type values (from DB constraint):
 *   'candidate' | 'employer' | 'admin' | 'owner'
 *
 * Unlimited access: account_type IN ('admin', 'owner') OR in co_owners table.
 * This matches what check_is_admin() + check_user_rate_limit() do server-side.
 */

export type InterviewMode = 'guest' | 'practice' | 'employer';
export type DifficultyMode = 'warm-up' | 'practice' | 'crunch' | 'sprint';

export interface InterviewConfig {
    mode: InterviewMode;
    difficultyMode: DifficultyMode;
    maxDurationMs: number;
    maxTurnsPerProblem: number;
    isUnlimited: boolean;  // Hides all caps UI, uses elapsed-only timer
    ragContext: string;   // Pre-fetched DSA knowledge (once at start)
    kaiMemory: string;   // Pre-fetched learner profile narrative
    sprint: SprintState | null;
}

export interface SprintState {
    problemIds: [string, string];
    currentProblemIndex: 0 | 1;
}

// ── Time/turn limits from UI ──────────────────────────────────────────────────
// warm-up:  Basic patterns, 20 mins   | 15 turns | 1 problem
// practice: Standard pace, 30 mins    | 20 turns | 1 problem
// crunch:   Time-pressured, 25 mins   | 12 turns | 1 problem
// sprint:   Back-to-back, 45 mins     | 10/10 turns | 2 problems
const LIMITS: Record<DifficultyMode, { ms: number; turns: number }> = {
    'warm-up': { ms: 20 * 60_000, turns: 15 },
    'practice': { ms: 30 * 60_000, turns: 20 },
    'crunch': { ms: 25 * 60_000, turns: 12 },
    'sprint': { ms: 45 * 60_000, turns: 10 }, // 10 per problem
};

// ── Guest ─────────────────────────────────────────────────────────────────────
// 5 turns OR 5 minutes — whichever fires first. Saves nothing to DB.
export function resolveGuestConfig(): InterviewConfig {
    return {
        mode: 'guest',
        difficultyMode: 'practice',
        maxDurationMs: 5 * 60_000,
        maxTurnsPerProblem: 5,
        isUnlimited: false,
        ragContext: '',   // Guest problems have pre-embedded context in their object
        kaiMemory: '',
        sprint: null,
    };
}

// ── Practice ──────────────────────────────────────────────────────────────────
export function resolvePracticeConfig(opts: {
    accountType: string;           // from profiles.account_type
    isCoOwner: boolean;          // from co_owners table lookup
    rateOverride: number | null;    // from profiles.rate_limit_override
    difficultyMode: DifficultyMode;
    ragContext: string;
    kaiMemory: string;
    sprintProblemIds?: [string, string]; // Required when difficultyMode === 'sprint'
}): InterviewConfig {
    // Both 'owner' and 'admin' are unlimited (matches check_is_admin() server logic)
    const isUnlimited = ['owner', 'admin'].includes(opts.accountType) || opts.isCoOwner;
    const base = LIMITS[opts.difficultyMode];

    return {
        mode: 'practice',
        difficultyMode: opts.difficultyMode,
        maxDurationMs: isUnlimited ? 120 * 60_000 : base.ms,
        maxTurnsPerProblem: isUnlimited ? 999 : (opts.rateOverride ?? base.turns),
        isUnlimited,
        ragContext: opts.ragContext,
        kaiMemory: opts.kaiMemory,
        sprint: opts.difficultyMode === 'sprint' && opts.sprintProblemIds
            ? { problemIds: opts.sprintProblemIds, currentProblemIndex: 0 }
            : null,
    };
}

// ── Employer ──────────────────────────────────────────────────────────────────
// assessment_campaigns settings override everything.
export function resolveEmployerConfig(opts: {
    timeLimitMins: number;   // campaign.time_limit_mins
    maxTurns: number;   // campaign.max_turns
    difficulty: string;   // campaign.difficulty
    ragContext: string;
}): InterviewConfig {
    const diff: DifficultyMode = (['warm-up', 'practice', 'crunch', 'sprint'].includes(opts.difficulty)
        ? opts.difficulty : 'practice') as DifficultyMode;
    return {
        mode: 'employer',
        difficultyMode: diff,
        maxDurationMs: opts.timeLimitMins * 60_000,
        maxTurnsPerProblem: opts.maxTurns,
        isUnlimited: false,
        ragContext: opts.ragContext,
        kaiMemory: '',  // No personal memory in employer mode
        sprint: null,    // Employer = single problem
    };
}

// ── Sprint helpers ────────────────────────────────────────────────────────────
export function shouldAdvanceSprint(config: InterviewConfig, turnsOnCurrentProblem: number): boolean {
    return !!(
        config.sprint &&
        config.sprint.currentProblemIndex === 0 &&
        turnsOnCurrentProblem >= config.maxTurnsPerProblem
    );
}

export function advanceSprintProblem(config: InterviewConfig, newRagContext: string): InterviewConfig {
    if (!config.sprint || config.sprint.currentProblemIndex === 1) return config;
    return { ...config, ragContext: newRagContext, sprint: { ...config.sprint, currentProblemIndex: 1 } };
}
