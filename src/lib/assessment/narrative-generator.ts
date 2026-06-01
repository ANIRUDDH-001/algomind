/**
 * @codesage
 * @file      src/lib/assessment/narrative-generator.ts
 * @purpose   Generates a personalized cognitive profile/narrative based on user's session history
 * @tech      Supabase, AI Client
 * @connects  imports getAIClient, Supabase client; writes to learner_profiles DB
 * @apis      None directly
 * @db        score_benchmarks, learner_profiles, interview_sessions
 * @state     None
 * @env       None
 * @issues    removed unused SessionData import
 * @audit     CODESAGE-v1
 */
import { getAIClient } from '@/lib/ai/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { SessionHistory, CognitiveSkill } from '@/types/assessment';
import { ALL_COGNITIVE_SKILLS } from '@/lib/supabase/type-mapping';
import { logSystemEvent } from '@/lib/monitoring/events';

interface SkillStats {
    avgScore: number;
    trend: string; // 'stable', 'improving', 'declining'
    variance: number;
}

// When to generate a narrative:
export const NARRATIVE_MILESTONES = [1, 3, 5, 10, 15, 20, 30, 40, 50];

export function shouldGenerateNarrative(
    totalSessions: number,
    lastNarrativeCount: number
): boolean {
    return NARRATIVE_MILESTONES.some(
        milestone => totalSessions >= milestone && lastNarrativeCount < milestone
    );
}

export async function fetchBenchmarkContext(
    supabase: SupabaseClient,
    sessions: SessionHistory[]
): Promise<string> {
    if (sessions.length === 0) return '';

    // Compute user's average score per difficulty
    const byDifficulty: Record<string, number[]> = { easy: [], medium: [], hard: [] };
    sessions.forEach(s => {
        byDifficulty[s.problemDifficulty]?.push(s.overallScore);
    });

    const userAvgs: Record<string, number> = {};
    for (const [diff, scores] of Object.entries(byDifficulty)) {
        if (scores.length > 0) {
            userAvgs[diff] = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
    }

    // Fetch benchmarks for relevant difficulties
    const difficulties = Object.keys(userAvgs);
    const { data: benchmarks } = await supabase
        .from('score_benchmarks')
        .select('difficulty, p25, p50, p75')
        .in('difficulty', difficulties)
        .eq('skill_id', 'overall');  // overall score benchmark

    if (!benchmarks || benchmarks.length === 0) return '';

    return benchmarks.map(b => {
        const userAvg = userAvgs[b.difficulty];
        if (!userAvg) return '';
        const percentile = userAvg < b.p25 ? 'bottom 25%'
            : userAvg < b.p50 ? '25th-50th percentile'
                : userAvg < b.p75 ? '50th-75th percentile'
                    : 'top 25%';
        return `${b.difficulty} problems: user avg ${userAvg.toFixed(1)}/10 = ${percentile} (median ${b.p50}/10)`;
    }).filter(Boolean).join('\n');
}

export async function generateNarrative(params: {
    userId: string;
    sessions: SessionHistory[];
    benchmarkContext?: string;
}): Promise<string> {
    const { sessions, benchmarkContext } = params;

    if (sessions.length === 0) {
        return '';
    }

    // Difficulty distribution
    const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
    sessions.forEach(s => {
        difficultyCounts[s.problemDifficulty] = (difficultyCounts[s.problemDifficulty] || 0) + 1;
    });

    // Compute skill stats
    const skillData: Record<CognitiveSkill, SkillStats> = {} as any;

    for (const skill of ALL_COGNITIVE_SKILLS) {
        // All time average
        const allScores = sessions.map(s => s.skills[skill] || 0).filter(s => s > 0);
        let avgScore = 0;
        let variance = 0;

        if (allScores.length > 0) {
            avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
            const squareDiffs = allScores.map(val => Math.pow(val - avgScore, 2));
            variance = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / allScores.length);
        }

        // Trend (last 3 vs 4th-6th)
        let trend = 'stable';
        if (sessions.length >= 6) {
            const recent3 = sessions.slice(0, 3).map(s => s.skills[skill] || 0).filter(s => s > 0);
            const older3 = sessions.slice(3, 6).map(s => s.skills[skill] || 0).filter(s => s > 0);

            const recentAvg = recent3.length > 0 ? recent3.reduce((a, b) => a + b, 0) / recent3.length : 0;
            const olderAvg = older3.length > 0 ? older3.reduce((a, b) => a + b, 0) / older3.length : 0;

            if (olderAvg > 0) {
                const change = ((recentAvg - olderAvg) / olderAvg) * 100;
                if (change > 5) trend = 'improving';
                if (change < -5) trend = 'declining';
            }
        }

        skillData[skill] = { avgScore, trend, variance };
    }

    const aiClient = getAIClient();

    const prompt = `You are generating a personalized cognitive profile for an engineering candidate.
This will be shown to them as their AlgoMind Interview Profile.

Sessions analyzed: ${sessions.length}
Difficulty distribution: ${difficultyCounts.easy} easy / ${difficultyCounts.medium} medium / ${difficultyCounts.hard} hard

Skill data ${JSON.stringify(skillData, null, 2)}

Write a 350-400 word profile that:
PARAGRAPH 1 (2 sentences): Their defining cognitive signature — the one thing that sets them apart, positively OR as a limitation. Be direct and specific.
PARAGRAPH 2 (3 sentences): Top 2 genuine strengths with specific behavioral evidence from the data.
PARAGRAPH 3 (3 sentences): Top 2 growth areas with specific failure modes observed. Name the exact pattern.
PARAGRAPH 4 (2 sentences): Readiness assessment using ONLY the benchmark data provided.
Format: "Compared to other ${difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard > 0 ? Object.keys(difficultyCounts).filter(k => (difficultyCounts as any)[k] > 0).join('/') : 'problem'} attempts, this student is at the [percentile] — [above/below/at] median performance.
${benchmarkContext ? `Reference the specific percentile data: ${benchmarkContext}` : 'Insufficient benchmark data to give percentile comparison — state this honestly.'}"

DO NOT invent company names or level labels (L4, E4, SDE2).
If benchmark data is not available, say: "Benchmark comparison is not yet available with current session data."
PARAGRAPH 5 (bullet list of 3): Specific ranked actions for next 4 weeks. Each action starts with a verb.

Tone: Direct. Honest. Coach-like. Not a performance review. Not generic.
Do NOT use phrases like: "shows promise", "good foundation", "keep up the good work".`;

    try {
        const response = await aiClient.generateResponse([{ role: 'user', content: prompt }], {
            maxTokens: 600,
            preferredModel: 'gemini',
            temperature: 0.4
        });

        return response.response || '';
    } catch (e) {
        console.error('[NarrativeGenerator] AI failed:', e);
        return '';
    }
}

export async function updateNarrativeIfDue(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    // 1. Get learner_profiles data
    const { data: profile } = await supabase
        .from('learner_profiles')
        .select('sessions_at_last_narrative')
        .eq('user_id', userId)
        .maybeSingle();

    const lastNarrativeCount = profile?.sessions_at_last_narrative || 0;

    // 2. Get completed sessions count
    const { data: allSessions, error } = await supabase
        .from('interview_sessions')
        .select(`
            id,
            problem_id,
            problem_difficulty,
            completed_at,
            duration,
            assessments (
                problem_decomposition,
                pattern_recognition,
                algorithmic_thinking,
                complexity_analysis,
                communication_clarity,
                edge_case_awareness,
                optimization_mindset,
                debugging_approach,
                overall_score
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

    if (error || !allSessions) {
        return false; // Silently fail
    }

    const totalSessions = allSessions.length;

    // Check if due we haven't already generated for this milestone
    if (totalSessions > 0 && shouldGenerateNarrative(totalSessions, lastNarrativeCount)) {

        // Map DB sessions to SessionHistory format
        const transformedSessions: SessionHistory[] = allSessions.map((s: any) => {
            const assessment = s.assessments?.[0] || {};
            return {
                sessionId: s.id,
                userId,
                problemId: s.problem_id,
                problemDifficulty: s.problem_difficulty || 'medium',
                timestamp: new Date(s.completed_at),
                duration: s.duration || 0,
                skills: {
                    'problem-decomposition': assessment.problem_decomposition || 0,
                    'pattern-recognition': assessment.pattern_recognition || 0,
                    'algorithmic-thinking': assessment.algorithmic_thinking || 0,
                    'complexity-analysis': assessment.complexity_analysis || 0,
                    'communication-clarity': assessment.communication_clarity || 0,
                    'edge-case-awareness': assessment.edge_case_awareness || 0,
                    'optimization-mindset': assessment.optimization_mindset || 0,
                    'debugging-approach': assessment.debugging_approach || 0
                } as Record<CognitiveSkill, number>,
                overallScore: Number(assessment.overall_score) || 0,
            };
        });

        const MAX_SESSIONS_FOR_NARRATIVE = 20;
        const sessionsForNarrative = transformedSessions.slice(0, MAX_SESSIONS_FOR_NARRATIVE);

        const benchmarkContext = await fetchBenchmarkContext(supabase, sessionsForNarrative);

        // 3. Generate narrative
        const narrative = await generateNarrative({
            userId,
            sessions: sessionsForNarrative,
            benchmarkContext
        });

        if (narrative) {
            // 4. Update profile
            await supabase.from('learner_profiles').upsert({
                user_id: userId,
                narrative,
                narrative_benchmark_context: benchmarkContext,
                narrative_generated_at: new Date().toISOString(),
                sessions_at_last_narrative: totalSessions
            });

            void logSystemEvent({
                type: 'cron_completed', // Abusing standard event type a bit, fine for MVP
                metadata: { event: 'narrative_generated', userId, sessionCount: totalSessions }
            });

            return true;
        }
    }

    return false;
}
