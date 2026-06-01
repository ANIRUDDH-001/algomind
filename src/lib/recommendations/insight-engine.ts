/**
 * @codesage
 * @file      src/lib/recommendations/insight-engine.ts
 * @purpose   Recommendation engine, calibrator, and insight processing.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @summary   This is a large file (> 500 lines) handling complex logic for Recommendation engine, calibrator, and insight processing.
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
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

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { getServiceClient } from '@/lib/supabase/service';
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
    | 'declining_trend'
    | 'unexplored_pattern'
    | 'momentum'
    | 'streak_at_risk'
    | 'consistency_gap'
    | 'difficulty_plateau'
    | 'skill_imbalance'
    | 'problem_type_gap';
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


function daysBetween(isoDate: string): number {
    return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function patternLabel(slug: string): string {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Extracts the problem slug from a LeetCode URL.
 *  e.g. "https://leetcode.com/problems/two-sum/" → "two-sum" */
function extractLeetcodeSlug(url: string | null): string | undefined {
    if (!url) return undefined;
    const match = url.match(/\/problems\/([^/]+)/);
    return match ? match[1] : undefined;
}

function rowToSuggestion(row: ProblemRow): ProblemSuggestion {
    return {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        leetcodeUrl: row.external_url ?? undefined,
        leetcodeSlug: extractLeetcodeSlug(row.external_url ?? null),
        patternTags: row.tags ?? undefined,
    };
}

// ─── Card builders ─────────────────────────────────────────────────────────────

export async function buildDecliningTrendCards(
    supabase: SupabaseClient,
    sessions: RpcSessionRow[],
    tier: DifficultyTier
): Promise<InsightCard[]> {
    if (sessions.length < 4) return [];

    const SKILL_KEYS = Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[];
    const cards: InsightCard[] = [];

    for (const skill of SKILL_KEYS) {
        let declineFound = false;
        let recentAvg = 0;
        let olderAvg = 0;

        for (const diff of ['easy', 'medium', 'hard'] as const) {
            const diffSessions = sessions.filter(s => s.problem_difficulty === diff);
            if (diffSessions.length < 4) continue;

            const getScore = (row: RpcSessionRow): number =>
                Number((row as unknown as Record<string, number>)[skill] ?? 0);

            const recent = diffSessions.slice(0, 3).map(getScore);
            const older = diffSessions.slice(3, 6).map(getScore);

            if (older.length < 1) continue;

            const curRecentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const curOlderAvg = older.reduce((a, b) => a + b, 0) / older.length;

            if (curOlderAvg - curRecentAvg >= 0.8) {
                declineFound = true;
                recentAvg = curRecentAvg;
                olderAvg = curOlderAvg;
                break;
            }
        }

        if (!declineFound) continue;

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
            body: `Your ${SKILL_LABELS[skill].toLowerCase()} score dropped from ${olderAvg.toFixed(1)}→${recentAvg.toFixed(1)} on similar constraints. This usually means rushing the approach phase. Slow down before you code.`,
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

export async function buildConsistencyGapCards(
    sessions: RpcSessionRow[]
): Promise<InsightCard[]> {
    if (sessions.length < 5) return [];
    const cards: InsightCard[] = [];

    for (const skill of Object.keys(SKILL_LABELS)) {
        const scores = sessions.map(s => (s as unknown as Record<string, number>)[skill]).filter((v: number) => v > 0);
        if (scores.length < 3) continue;

        const mean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const MathPow = Math.pow;
        const variance = Math.sqrt(
            scores.map((v: number) => MathPow(v - mean, 2)).reduce((a: number, b: number) => a + b, 0) / scores.length
        );

        if (variance > 2.5 && Math.max(...scores) - Math.min(...scores) >= 4) {
            cards.push({
                type: 'consistency_gap',
                title: `Inconsistent ${SKILL_LABELS[skill]}`,
                body: `Your ${SKILL_LABELS[skill]} scores range from ${Math.min(...scores).toFixed(0)} to ${Math.max(...scores).toFixed(0)}. This variance (${variance.toFixed(1)}) suggests the skill is pattern-dependent rather than deeply understood. Focus on understanding the underlying principle, not memorizing solutions.`,
                priority: variance > 3.5 ? 'high' : 'medium',
                problemSuggestions: [],
            });
        }
    }

    return cards.slice(0, 2);
}

export async function buildDifficultyPlateauCard(
    sessions: RpcSessionRow[]
): Promise<InsightCard | null> {
    if (sessions.length < 8) return null;

    const hardCount = sessions.filter(s => s.problem_difficulty === 'hard').length;
    const mediumCount = sessions.filter(s => s.problem_difficulty === 'medium').length;
    const easyCount = sessions.filter(s => s.problem_difficulty === 'easy').length;

    // User has done mostly easy/medium but no hard
    if (mediumCount >= 6 && hardCount === 0) {
        const recentMediumAvg = sessions
            .filter(s => s.problem_difficulty === 'medium')
            .slice(0, 5)
            .reduce((sum, s) => sum + s.overall_score, 0) / 5;

        if (recentMediumAvg >= 6.5) {
            return {
                type: 'difficulty_plateau',
                title: 'Ready for Hard Problems',
                body: `You've averaged ${recentMediumAvg.toFixed(1)}/10 on Medium problems over your last 5 attempts. This is a strong signal you're ready to stretch. Hard problems require the same patterns you already know, applied under constraints you haven't practiced yet. Attempt one Hard problem this week with no time pressure.`,
                priority: 'high',
                problemSuggestions: [],
            };
        }
    }

    // User is stuck on easy
    if (easyCount >= 5 && mediumCount === 0) {
        return {
            type: 'difficulty_plateau',
            title: 'Time to Move Beyond Easy',
            body: `You have ${easyCount} Easy sessions but haven't attempted Medium yet. Easy problems confirm you know the basics — Medium problems test whether you can apply them under constraints. The jump is achievable.`,
            priority: 'medium',
            problemSuggestions: [],
        };
    }

    return null;
}

export async function buildSkillImbalanceCard(
    sessions: RpcSessionRow[]
): Promise<InsightCard | null> {
    if (sessions.length < 4) return null;

    const skillAvgs: Record<string, number> = {};
    for (const skill of Object.keys(SKILL_LABELS)) {
        const scores = sessions.map(s => (s as unknown as Record<string, number>)[skill]).filter((v: number) => v > 0);
        if (scores.length > 0) {
            skillAvgs[skill] = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        }
    }

    const avgValues = Object.values(skillAvgs);
    if (avgValues.length === 0) return null;
    const overallAvg = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;

    const worstSkill = Object.entries(skillAvgs).sort(([, a], [, b]) => a - b)[0];
    if (!worstSkill) return null;

    const gap = overallAvg - worstSkill[1];

    if (gap >= 2.5) {
        return {
            type: 'skill_imbalance',
            title: `${SKILL_LABELS[worstSkill[0]]} is Your Bottleneck`,
            body: `Your average across all skills is ${overallAvg.toFixed(1)}/10, but ${SKILL_LABELS[worstSkill[0]]} is ${worstSkill[1].toFixed(1)}/10 — a ${gap.toFixed(1)} point gap. In real interviews, one weak dimension can cause a rejection even with strong overall performance. This imbalance is your highest-priority focus area.`,
            priority: 'high',
            problemSuggestions: [],
        };
    }

    return null;
}

export async function buildProblemTypeGapCard(
    supabase: SupabaseClient,
    sessions: RpcSessionRow[]
): Promise<InsightCard | null> {
    if (sessions.length < 5) return null;

    const usedTags = new Set<string>();
    for (const s of sessions) {
        const patternTags = s.pattern_tags as string[] | null;
        if (patternTags) patternTags.forEach(t => usedTags.add(t));
    }

    // High-priority patterns that must be covered at any level
    const CRITICAL_PATTERNS = [
        'dynamic-programming', 'binary-search', 'graphs', 'bfs', 'dfs',
        'sliding-window', 'two-pointer', 'heap',
    ];

    const missingCritical = CRITICAL_PATTERNS.filter(p => !usedTags.has(p));

    if (missingCritical.length === 0) return null;

    const gap = missingCritical[0];

    const { data: starterProblem } = await supabase
        .from('problems')
        .select('id, title, difficulty, external_url, tags')
        .contains('tags', [gap])
        .eq('difficulty', 'medium')
        .limit(1)
        .maybeSingle();

    return {
        type: 'problem_type_gap',
        title: `Zero ${patternLabel(gap)} Practice`,
        body: `You have not attempted any ${patternLabel(gap)} problems. This is a top-3 interview category at most companies. One session with a core ${patternLabel(gap)} problem will build foundational familiarity that applies across dozens of problems.`,
        priority: missingCritical.length >= 3 ? 'high' : 'medium',
        problemSuggestions: starterProblem ? [rowToSuggestion(starterProblem as ProblemRow)] : undefined,
    };
}

// ─── Main export: server-side ──────────────────────────────────────────────────

export async function computeInsightsForUser(userId: string): Promise<InsightSnapshot> {
    const supabase = getServiceClient();
    const computedAt = new Date().toISOString();

    // ── Step A: Gather data (Parallelized) ────────────────────────────────────────────────────

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase.rpc(
                'get_user_sessions_with_assessment',
                { p_user_id: userId, p_limit: 20 }
            );
            if (error) {
                console.error('[insight-engine] RPC error:', error.message);
                return [];
            }
            return (data ?? []) as RpcSessionRow[];
        } catch (err) {
            console.error('[insight-engine] Unexpected RPC error:', err);
            return [];
        }
    };

    const [sessions] = await Promise.all([
        fetchSessions()
    ]);

    // ── Step B: Compute tier ───────────────────────────────────────────────────

    const sessionSummaries = sessions.map((s) => ({
        overall_score: Number(s.overall_score),
        problem_difficulty:
            (s.problem_difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
    }));

    const { tier, reasoning: tierReasoning } = computeDifficultyTier(sessionSummaries);

    // ── Step C: Generate insight cards (Parallelized) ────────────────────────────────────────

    const buildTrendCards = async () => {
        try { return await buildDecliningTrendCards(supabase, sessions, tier); }
        catch (err) { console.error('[insight-engine] Trend card error:', err); return []; }
    };

    const buildPatternCards = async () => {
        try { return await buildUnexploredPatternCards(supabase, sessions, tier); }
        catch (err) { console.error('[insight-engine] Pattern card error:', err); return []; }
    };

    const buildStreakRiskCard = async () => {
        try { return buildStreakAtRiskCard(sessions); }
        catch (err) { console.error('[insight-engine] Streak-at-risk card error:', err); return null; }
    };

    const buildMomentumCardSafe = async () => {
        try { return buildMomentumCard(sessions); }
        catch (err) { console.error('[insight-engine] Momentum card error:', err); return null; }
    };

    const buildConsistencyCards = async () => {
        try { return await buildConsistencyGapCards(sessions); }
        catch (err) { console.error('[insight-engine] Consistency card error:', err); return []; }
    };

    const buildPlateauCardSafely = async () => {
        try { return await buildDifficultyPlateauCard(sessions); }
        catch (err) { console.error('[insight-engine] Plateau card error:', err); return null; }
    };

    const buildImbalanceCardSafely = async () => {
        try { return await buildSkillImbalanceCard(sessions); }
        catch (err) { console.error('[insight-engine] Imbalance card error:', err); return null; }
    };

    const buildTypeGapCardSafely = async () => {
        try { return await buildProblemTypeGapCard(supabase, sessions); }
        catch (err) { console.error('[insight-engine] Type gap card error:', err); return null; }
    };

    const [
        trendCards,
        patternCards,
        streakRiskCard,
        momentumCard,
        consistencyCards,
        plateauCard,
        imbalanceCard,
        typeGapCard
    ] = await Promise.all([
        buildTrendCards(),
        buildPatternCards(),
        buildStreakRiskCard(),
        buildMomentumCardSafe(),
        buildConsistencyCards(),
        buildPlateauCardSafely(),
        buildImbalanceCardSafely(),
        buildTypeGapCardSafely(),
    ]);

    const allCards: InsightCard[] = [
        ...trendCards,
        ...patternCards,
        ...consistencyCards,
    ];

    if (streakRiskCard) allCards.push(streakRiskCard);
    if (momentumCard && !allCards.some((c) => c.type === 'streak_at_risk')) {
        allCards.push(momentumCard);
    }
    if (plateauCard) allCards.push(plateauCard);
    if (imbalanceCard) allCards.push(imbalanceCard);
    if (typeGapCard) allCards.push(typeGapCard);

    // Sort: high → medium → low, cap at 6
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
    const insights = allCards
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        .slice(0, 6);

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
