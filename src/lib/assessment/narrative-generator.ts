import { getAIClient } from '@/lib/ai/client';
import { getSupabase } from '@/lib/supabase/client';
import { SessionData } from '@/lib/ai/memory-generator'; // Reuse the type from memory-generator, or assessment
import { SessionHistory, CognitiveSkill } from '@/types/assessment';
import { ALL_COGNITIVE_SKILLS } from '@/lib/supabase/type-mapping';
import { logSystemEvent } from '@/lib/monitoring/events';

interface SkillStats {
    avgScore: number;
    trend: string; // 'stable', 'improving', 'declining'
    variance: number;
}

export async function generateNarrative(params: {
    userId: string;
    sessions: SessionHistory[];
}): Promise<string> {
    const { sessions } = params;

    // Double check it's strictly a multiple of 5
    if (sessions.length === 0 || sessions.length % 5 !== 0) {
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
PARAGRAPH 4 (2 sentences): Readiness assessment — 'Currently performing at [Company] [Level] standard. With focus on [skill], [Level+1] is achievable in [timeframe]'.
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

    // Check if due: multiple of 5 AND we haven't already generated for this milestone
    if (totalSessions > 0 && totalSessions % 5 === 0 && totalSessions > lastNarrativeCount) {

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

        // 3. Generate narrative
        const narrative = await generateNarrative({
            userId,
            sessions: transformedSessions
        });

        if (narrative) {
            // 4. Update profile
            await supabase.from('learner_profiles').upsert({
                user_id: userId,
                narrative,
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
