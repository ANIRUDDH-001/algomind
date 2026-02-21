/**
 * insight-engine.ts
 *
 * Replaces the static RecommendationEngine with a data-driven insight system.
 *
 * Server-side exports (use service-role client):
 *   computeInsightsForUser(userId) — called from nightly batch + save-session
 *
 * Client-safe exports (use anon client):
 *   getInsightSnapshot(userId) — reads cached snapshot from insight_snapshots
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import {
    computeDifficultyTier,
    selectProblemDifficulty,
    DifficultyTier,
} from './difficulty-calibrator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProblemSuggestion {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    leetcodeUrl?: string;
    leetcodeSlug?: string;
    patternTags?: string[];
}

export interface InsightCard {
    type:
    | 'reinforce_leetcode'
    | 'declining_trend'
    | 'unexplored_pattern'
    | 'momentum'
    | 'streak_at_risk';
    title: string;
    body: string;
    priority: 'high' | 'medium' | 'low';
    problemSuggestions?: ProblemSuggestion[];
}

export interface InsightSnapshot {
    userId: string;
    insights: InsightCard[];
    recommendedProblems: ProblemSuggestion[];
    recommendedTier: number;
    tierReasoning: string;
    computedAt: string;
    sessionsSnapshot: number;
}

// ─── DB row shapes ─────────────────────────────────────────────────────────────

interface RpcSessionRow {
    session_id: string;
    problem_id: string;
    problem_title: string | null;
    problem_difficulty: 'easy' | 'medium' | 'hard' | null;
    completed_at: string;
    overall_score: number;
    problem_decomposition: number;
    pattern_recognition: number;
    algorithmic_thinking: number;
    complexity_analysis: number;
    communication_clarity: number;
    edge_case_awareness: number;
    optimization_mindset: number;
    debugging_approach: number;
    pattern_tags: string[] | null;
}

interface LeetCodeProfileRow {
    contest_rating: number | null;
    medium_solved: number;
    hard_solved: number;
    recent_submissions: Array<{
        slug: string;
        title: string;
        accepted_at: string;
    }> | null;
}

interface ProblemRow {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    external_url: string | null;
    tags: string[] | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_PATTERNS = [
    'sliding-window',
    'two-pointer',
    'binary-search',
    'bfs',
    'dfs',
    'dynamic-programming',
    'backtracking',
    'heap',
    'union-find',
    'monotonic-stack',
] as const;

const SKILL_LABELS: Record<string, string> = {
    problem_decomposition: 'Problem Decomposition',
    pattern_recognition: 'Pattern Recognition',
    algorithmic_thinking: 'Algorithmic Thinking',
    complexity_analysis: 'Complexity Analysis',
    communication_clarity: 'Communication Clarity',
    edge_case_awareness: 'Edge Case Awareness',
    optimization_mindset: 'Optimization Mindset',
    debugging_approach: 'Debugging Approach',
};

const SKILL_TAGS: Record<string, string[]> = {
    problem_decomposition: ['recursion', 'trees', 'graphs', 'backtracking'],
    pattern_recognition: ['sliding-window', 'two-pointer', 'hashing'],
    algorithmic_thinking: ['sorting', 'greedy', 'binary-search'],
    complexity_analysis: ['recursion', 'dynamic-programming', 'graphs'],
    edge_case_awareness: ['arrays', 'strings', 'math'],
    optimization_mindset: ['dynamic-programming', 'heap', 'greedy'],
    debugging_approach: ['arrays', 'strings', 'linked-list'],
    communication_clarity: ['arrays', 'recursion', 'strings'],
};

// ─── Private helpers ───────────────────────────────────────────────────────────

function getServiceClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

function daysBetween(isoDate: string): number {
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function patternLabel(slug: string): string {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function rowToSuggestion(row: ProblemRow): ProblemSuggestion {
    return {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        leetcodeUrl: row.external_url ?? undefined,
        patternTags: row.tags ?? undefined,
    };
}

// ─── Card builders ─────────────────────────────────────────────────────────────

async function buildReinforceLeetcodeCards(
    supabase: SupabaseClient,
    lcProfile: LeetCodeProfileRow | null,
    sessions: RpcSessionRow[]
): Promise<InsightCard[]> {
    if (!lcProfile?.recent_submissions?.length) return [];

    const recentSlugs = new Set(sessions.map((s) => s.problem_id));
    const cards: InsightCard[] = [];

    for (const sub of lcProfile.recent_submissions.slice(0, 5)) {
        const daysAgo = daysBetween(sub.accepted_at);
        if (daysAgo > 30) continue;

        // Check if user has done it in AlgoMind in last 30 days
        const alreadyPracticed = sessions.some(
            (s) =>
                s.problem_id === sub.slug ||
                s.problem_title?.toLowerCase() === sub.title.toLowerCase()
        ) || recentSlugs.has(sub.slug);

        if (alreadyPracticed) continue;

        // Find matching AM problem
        let suggestion: ProblemSuggestion | undefined;
        try {
            const { data } = await supabase
                .from('problems')
                .select('id, title, difficulty, external_url, tags')
                .or(`id.eq.${sub.slug},title.ilike.${encodeURIComponent(sub.title)}`)
                .limit(1)
                .maybeSingle();
            if (data) suggestion = rowToSuggestion(data as ProblemRow);
        } catch { /* ignore */ }

        cards.push({
            type: 'reinforce_leetcode',
            title: `Solidify "${sub.title}" with a mock interview`,
            body: `You solved this on LeetCode ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago. An interview simulation will lock in the pattern under pressure, not just solve-and-forget.`,
            priority: daysAgo < 7 ? 'high' : 'medium',
            problemSuggestions: suggestion ? [suggestion] : undefined,
        });

        if (cards.length >= 2) break; // cap at 2 reinforce cards
    }

    return cards;
}

async function buildDecliningTrendCards(
    supabase: SupabaseClient,
    sessions: RpcSessionRow[],
    tier: DifficultyTier
): Promise<InsightCard[]> {
    if (sessions.length < 4) return [];

    const SKILL_KEYS = Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[];
    const cards: InsightCard[] = [];

    for (const skill of SKILL_KEYS) {
        const getScore = (row: RpcSessionRow): number =>
            Number((row as unknown as Record<string, number>)[skill] ?? 0);

        const recent = sessions.slice(0, 3).map(getScore);
        const older = sessions.slice(3, 6).map(getScore);

        if (older.length < 1) continue;

        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (olderAvg - recentAvg < 0.8) continue;

        // Fetch 2 problems matching skill tags + tier difficulty
        const difficulty = selectProblemDifficulty(tier);
        let suggestions: ProblemSuggestion[] = [];
        try {
            const tags = SKILL_TAGS[skill] ?? [];
            const { data } = await supabase
                .from('problems')
                .select('id, title, difficulty, external_url, tags')
                .eq('difficulty', difficulty)
                .overlaps('tags', tags)
                .limit(2);
            suggestions = (data as ProblemRow[] | null)?.map(rowToSuggestion) ?? [];
        } catch { /* ignore */ }

        cards.push({
            type: 'declining_trend',
            title: `${SKILL_LABELS[skill]} is slipping`,
            body: `Your ${SKILL_LABELS[skill].toLowerCase()} score dropped from ${olderAvg.toFixed(1)}→${recentAvg.toFixed(1)} over your last 3 sessions. This usually means rushing the approach phase. Slow down before you code.`,
            priority: 'high',
            problemSuggestions: suggestions.length ? suggestions : undefined,
        });

        if (cards.length >= 2) break; // cap
    }

    return cards;
}

async function buildUnexploredPatternCards(
    supabase: SupabaseClient,
    sessions: RpcSessionRow[],
    tier: DifficultyTier
): Promise<InsightCard[]> {
    const seenPatterns = new Set<string>();
    for (const s of sessions) {
        for (const tag of s.pattern_tags ?? []) {
            seenPatterns.add(tag.toLowerCase());
        }
    }

    const TIER_PREVALENCE: Record<string, number> = {
        'sliding-window': 18,
        'two-pointer': 15,
        'binary-search': 22,
        'bfs': 20,
        'dfs': 20,
        'dynamic-programming': 30,
        'backtracking': 12,
        'heap': 14,
        'union-find': 8,
        'monotonic-stack': 10,
    };

    for (const pattern of COMMON_PATTERNS) {
        if (seenPatterns.has(pattern)) continue;

        // Also check by tag similarity (e.g. DB tag "Binary Search" vs "binary-search")
        const normalized = pattern.replace(/-/g, ' ').toLowerCase();
        const alreadySeen = [...seenPatterns].some(
            (p) => p.replace(/-/g, ' ').toLowerCase() === normalized
        );
        if (alreadySeen) continue;

        const difficulty = selectProblemDifficulty(tier);
        let suggestions: ProblemSuggestion[] = [];
        try {
            const { data } = await supabase
                .from('problems')
                .select('id, title, difficulty, external_url, tags')
                .eq('difficulty', difficulty)
                .overlaps('tags', [pattern])
                .limit(1);
            suggestions = (data as ProblemRow[] | null)?.map(rowToSuggestion) ?? [];
        } catch { /* ignore */ }

        const pct = TIER_PREVALENCE[pattern] ?? 15;

        return [{
            type: 'unexplored_pattern',
            title: `You haven't tried ${patternLabel(pattern)} yet`,
            body: `${patternLabel(pattern)} problems appear in ~${pct}% of ${tier.label} interviews. Here's a good entry point.`,
            priority: 'medium',
            problemSuggestions: suggestions.length ? suggestions : undefined,
        }];
    }

    return [];
}

function buildMomentumCard(sessions: RpcSessionRow[]): InsightCard | null {
    if (sessions.length < 3) return null;

    // Count consecutive days with ≥1 session as a "streak" proxy
    const streak = sessions.length; // simplified: each row is a session
    if (streak < 3) return null;

    const thisWeek = sessions.slice(0, Math.min(3, sessions.length));
    const lastWeek = sessions.slice(3, Math.min(6, sessions.length));

    const thisAvg = thisWeek.reduce((a, s) => a + s.overall_score, 0) / thisWeek.length;
    const lastAvg =
        lastWeek.length > 0
            ? lastWeek.reduce((a, s) => a + s.overall_score, 0) / lastWeek.length
            : thisAvg;
    const delta = thisAvg - lastAvg;

    return {
        type: 'momentum',
        title: `${streak}-session streak — build on it`,
        body: `Your consistency is paying off. Weekly average: ${thisAvg.toFixed(1)}/10 (${delta >= 0 ? `up ↑ ${delta.toFixed(1)}` : `down ↓ ${Math.abs(delta).toFixed(1)}`} from last week).`,
        priority: 'low',
    };
}

function buildStreakAtRiskCard(sessions: RpcSessionRow[]): InsightCard | null {
    if (sessions.length < 1) return null;

    const lastSession = sessions[0];
    const daysAgo = daysBetween(lastSession.completed_at);

    if (daysAgo <= 2 || sessions.length === 0) return null;

    return {
        type: 'streak_at_risk',
        title: `Don't break your ${sessions.length}-session streak`,
        body: `You last practiced ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago. One session today keeps your momentum going.`,
        priority: 'medium',
    };
}

// ─── Main export: server-side ──────────────────────────────────────────────────

export async function computeInsightsForUser(userId: string): Promise<InsightSnapshot> {
    const supabase = getServiceClient();
    const computedAt = new Date().toISOString();

    // ── Step A: Gather data ────────────────────────────────────────────────────

    let sessions: RpcSessionRow[] = [];
    try {
        const { data, error } = await supabase.rpc(
            'get_user_sessions_with_assessment',
            { p_user_id: userId, p_limit: 20 }
        );
        if (error) console.error('[insight-engine] RPC error:', error.message);
        else sessions = (data ?? []) as RpcSessionRow[];
    } catch (err) {
        console.error('[insight-engine] Unexpected RPC error:', err);
    }

    let lcProfile: LeetCodeProfileRow | null = null;
    try {
        const { data } = await supabase
            .from('leetcode_profiles')
            .select('contest_rating, medium_solved, hard_solved, recent_submissions')
            .eq('user_id', userId)
            .maybeSingle();
        lcProfile = data as LeetCodeProfileRow | null;
    } catch { /* table may not exist — silently skip */ }

    // ── Step B: Compute tier ───────────────────────────────────────────────────

    const sessionSummaries = sessions.map((s) => ({
        overall_score: Number(s.overall_score),
        problem_difficulty:
            (s.problem_difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
    }));

    const lcSignal = lcProfile
        ? {
            contest_rating: lcProfile.contest_rating,
            medium_solved: lcProfile.medium_solved ?? 0,
            hard_solved: lcProfile.hard_solved ?? 0,
        }
        : null;

    const { tier, reasoning: tierReasoning } = computeDifficultyTier(lcSignal, sessionSummaries);

    // ── Step C: Generate insight cards ────────────────────────────────────────

    const allCards: InsightCard[] = [];

    try {
        const lcCards = await buildReinforceLeetcodeCards(supabase, lcProfile, sessions);
        allCards.push(...lcCards);
    } catch (err) { console.error('[insight-engine] LC card error:', err); }

    try {
        const trendCards = await buildDecliningTrendCards(supabase, sessions, tier);
        allCards.push(...trendCards);
    } catch (err) { console.error('[insight-engine] Trend card error:', err); }

    try {
        const patternCards = await buildUnexploredPatternCards(supabase, sessions, tier);
        allCards.push(...patternCards);
    } catch (err) { console.error('[insight-engine] Pattern card error:', err); }

    try {
        const streakRiskCard = buildStreakAtRiskCard(sessions);
        if (streakRiskCard) allCards.push(streakRiskCard);
    } catch (err) { console.error('[insight-engine] Streak-at-risk card error:', err); }

    try {
        const momentumCard = buildMomentumCard(sessions);
        if (momentumCard && !allCards.some((c) => c.type === 'streak_at_risk')) {
            allCards.push(momentumCard);
        }
    } catch (err) { console.error('[insight-engine] Momentum card error:', err); }

    // Sort: high → medium → low, cap at 4
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
    const insights = allCards
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        .slice(0, 4);

    // ── Step D: Recommended problems ──────────────────────────────────────────

    const recentProblemIds = new Set(
        sessions
            .filter((s) => daysBetween(s.completed_at) <= 14)
            .map((s) => s.problem_id)
    );

    const selectedDifficulty = selectProblemDifficulty(tier);
    let recommendedProblems: ProblemSuggestion[] = [];

    try {
        const { data } = await supabase
            .from('problems')
            .select('id, title, difficulty, external_url, tags')
            .eq('difficulty', selectedDifficulty)
            .not('id', 'in', `(${[...recentProblemIds].join(',') || 'null'})`)
            .limit(6);
        recommendedProblems = (data as ProblemRow[] | null)?.map(rowToSuggestion) ?? [];
    } catch (err) {
        console.error('[insight-engine] Recommended problems error:', err);
    }

    // ── Step E: Build snapshot ────────────────────────────────────────────────

    const snapshot: InsightSnapshot = {
        userId,
        insights,
        recommendedProblems,
        recommendedTier: tier.tier,
        tierReasoning,
        computedAt,
        sessionsSnapshot: sessions.length,
    };

    // ── Step F: Upsert to insight_snapshots (fire and forget) ─────────────────

    void (async () => {
        try {
            await supabase
                .from('insight_snapshots')
                .upsert(
                    {
                        user_id: userId,
                        insights: insights,
                        recommended_problems: recommendedProblems,
                        recommended_tier: tier.tier,
                        tier_reasoning: tierReasoning,
                        sessions_snapshot: sessions.length,
                        computed_at: computedAt,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id' }
                );
        } catch (err) {
            console.error('[insight-engine] Failed to upsert snapshot:', err);
        }
    })();

    return snapshot;
}

// ─── Client-safe export ───────────────────────────────────────────────────────

export async function getInsightSnapshot(userId: string): Promise<InsightSnapshot | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('insight_snapshots')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) return null;

        // Map DB snake_case to InsightSnapshot camelCase
        return {
            userId: data.user_id as string,
            insights: (data.insights ?? []) as InsightCard[],
            recommendedProblems: (data.recommended_problems ?? []) as ProblemSuggestion[],
            recommendedTier: data.recommended_tier as number,
            tierReasoning: data.tier_reasoning as string,
            computedAt: data.computed_at as string,
            sessionsSnapshot: data.sessions_snapshot as number,
        };
    } catch (err) {
        console.error('[insight-engine] getInsightSnapshot error:', err);
        return null;
    }
}
