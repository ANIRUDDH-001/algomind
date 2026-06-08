/**
 * @codesage
 * @file      src/lib/supabase/progress-store.ts
 * @purpose   Provides a service for saving user interview sessions and retrieving progress data.
 * @tech      Supabase JS Client
 * @connects  Imports from ./client, ./type-mapping, types from @/types/assessment.
 * @apis      None
 * @db        interview_sessions, assessments, learner_profiles
 * @state     Maintains singleton store instance.
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getSupabase } from './client';
import { SessionHistory, UserProgress, SkillTrend, CognitiveSkill } from '@/types/assessment';
import {
    skillsToDbFormat,
    dbToSkillsFormat,
    ALL_COGNITIVE_SKILLS,
    ALL_DB_COLUMNS,
    DEFAULT_SKILL_SCORES,
} from './type-mapping';

export class SupabaseProgressStore {
    private supabase = getSupabase();

    async saveSession(
        userId: string,
        session: Omit<SessionHistory, 'userId'>,
        assessment?: {
            skillEvidence: Record<string, unknown>;
            overallFeedback: string;
            nextSteps: string[];
            modelUsed?: string;
            confidence?: number;
        }
    ): Promise<void> {
        if (!this.supabase) {
            console.warn('⚠️ Supabase not configured, skipping save');
            return;
        }

        try {
            // Insert interview session - let Supabase generate UUID
            const { data: sessionData, error: sessionError } = await this.supabase
                .from('interview_sessions')
                .insert({
                    // Don't pass id - let Supabase generate UUID
                    user_id: userId,
                    problem_id: session.problemId,
                    problem_title: session.problemId,
                    problem_difficulty: session.problemDifficulty,
                    duration: session.duration,
                    status: 'completed',
                    completed_at: session.timestamp.toISOString(),
                    transcript: session.transcript || [] // Add transcript to database insert
                })
                .select()
                .single();

            if (sessionError) {
                console.error('❌ [SupabaseProgressStore] Session insert failed:', {
                    code: sessionError.code,
                    message: sessionError.message,
                    details: sessionError.details,
                    hint: sessionError.hint
                });
                throw sessionError;
            }

            // Convert skills to DB format using type-safe mapping
            const dbSkills = skillsToDbFormat(session.skills);

            // Insert assessment
            //  -- automated unused local suppression
            const { data: assessmentData, error: assessmentError } = await this.supabase
                .from('assessments')
                .insert({
                    session_id: sessionData.id,
                    user_id: userId,
                    ...dbSkills,
                    overall_score: session.overallScore,
                    skill_evidence: assessment?.skillEvidence || {},
                    overall_feedback: assessment?.overallFeedback || '',
                    next_steps: assessment?.nextSteps || [],
                    model_used: assessment?.modelUsed || 'gemini-2.0-flash',
                    confidence: assessment?.confidence || 0.8,
                })
                .select()
                .single();

            if (assessmentError) {
                console.error('❌ [SupabaseProgressStore] Assessment insert failed:', {
                    code: assessmentError.code,
                    message: assessmentError.message,
                    details: assessmentError.details,
                    hint: assessmentError.hint
                });
                throw assessmentError;
            }

        } catch (error: unknown) {
            console.error('❌ [SupabaseProgressStore] Save failed:', {
                name: (error as any)?.name,
                message: (error as any)?.message,
                code: (error as any)?.code,
                details: (error as any)?.details,
                hint: (error as any)?.hint,
                stack: (error as any)?.stack
            });
            throw error;
        }
    }

    async getUserProgress(userId: string): Promise<UserProgress | null> {
        if (!this.supabase) {
            console.warn('⚠️ Supabase not configured');
            return null;
        }

        try {
            // Build dynamic select for skill columns
            const skillColumnsSelect = ALL_DB_COLUMNS.join(',\n          ');

            // Get all completed sessions with assessments
            const { data: sessions, error } = await this.supabase
                .from('interview_sessions')
                .select(`
                    id,
                    problem_id,
                    problem_title,
                    problem_difficulty,

                    duration,
                    completed_at,
                    transcript, 
                    assessments (
                      ${skillColumnsSelect},
                      overall_score
                    )
                `)
                .eq('user_id', userId)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false });

            if (error) {
                console.error('❌ [SupabaseProgressStore] Failed to get user progress:', {
                    code: error.code,
                    message: error.message,
                    details: error.details
                });
                return null;
            }

            // Fetch learner profile for narrative data
            const { data: profile } = await this.supabase
                .from('learner_profiles')
                .select('narrative, narrative_generated_at, sessions_at_last_narrative')
                .eq('user_id', userId)
                .maybeSingle();

            if (!sessions || sessions.length === 0) {
                return {
                    userId,
                    sessions: [],
                    trends: [],
                    totalSessions: 0,
                    averageScore: 0,
                    averageScores: { ...DEFAULT_SKILL_SCORES },
                    lastUpdated: new Date(),
                    narrative: profile?.narrative,
                    narrativeGeneratedAt: profile?.narrative_generated_at ? new Date(profile.narrative_generated_at) : undefined,
                    sessionsAtLastNarrative: profile?.sessions_at_last_narrative || 0,
                };
            }

            // Transform sessions using type-safe mapping
            const transformedSessions: SessionHistory[] = sessions.map((s: any) => {
                const assessment = s.assessments?.[0] || {};
                const skills = dbToSkillsFormat(assessment);

                return {
                    sessionId: s.id,
                    userId,
                    problemId: s.problem_id,
                    problemTitle: s.problem_title || s.problem_id,
                    problemDifficulty: s.problem_difficulty || 'medium',
                    timestamp: new Date(s.completed_at),
                    duration: s.duration || 0,
                    skills,
                    overallScore: Number(assessment.overall_score) || 0,
                    transcript: Array.isArray(s.transcript)
                        ? (s.transcript as unknown[]).map((entry) => {
                            const e = entry as Record<string, unknown>;
                            return {
                                role: String(e.role || 'user'),
                                content: typeof e.content === 'string'
                                    ? e.content
                                    : typeof e.content === 'object' && e.content !== null
                                        ? String(
                                            (e.content as Record<string, unknown>).text
                                            ?? (e.content as Record<string, unknown>).sentence
                                            ?? (e.content as Record<string, unknown>).content
                                            ?? JSON.stringify(e.content)
                                        )
                                        : typeof e.text === 'string'
                                            ? e.text
                                            : typeof (e as Record<string, unknown>).sentence === 'string'
                                                ? String((e as Record<string, unknown>).sentence)
                                                : (e.content ?? e.text) ? JSON.stringify(e.content ?? e.text) : '',
                            };
                        })
                        : [],
                };
            });

            // Calculate averages from last 5 sessions
            const recentSessions = transformedSessions.slice(0, 5);
            const averageScores: Record<CognitiveSkill, number> = { ...DEFAULT_SKILL_SCORES };

            ALL_COGNITIVE_SKILLS.forEach((skillId) => {
                const scores = recentSessions
                    .map((s) => s.skills[skillId])
                    .filter((s) => s != null && s > 0);
                if (scores.length > 0) {
                    averageScores[skillId] = scores.reduce((a, b) => a + b, 0) / scores.length;
                }
            });

            const validScores = Object.values(averageScores).filter(s => s > 0);
            const avgScore = validScores.length > 0
                ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                : 0;

            // Calculate trends
            const trends: SkillTrend[] = this.calculateTrends(transformedSessions);

            return {
                userId,
                sessions: transformedSessions,
                trends,
                totalSessions: sessions.length,
                averageScore: avgScore, // based on last 5 sessions (not all-time)
                averageScores, // based on last 5 sessions
                recentSessionsUsedForAverage: 5,
                lastUpdated: new Date(),
                narrative: profile?.narrative,
                narrativeGeneratedAt: profile?.narrative_generated_at ? new Date(profile.narrative_generated_at) : undefined,
                sessionsAtLastNarrative: profile?.sessions_at_last_narrative || 0,
            };
        } catch (error: unknown) {
            console.error('❌ [SupabaseProgressStore] Failed to load progress:', {
                message: (error as any)?.message,
                code: (error as any)?.code
            });
            return null;
        }
    }

    private calculateTrends(sessions: SessionHistory[]): SkillTrend[] {
        if (sessions.length < 2) return [];

        const trends: SkillTrend[] = [];

        ALL_COGNITIVE_SKILLS.forEach((skillId) => {
            const recentScores = sessions.slice(0, 3).map((s) => s.skills[skillId] || 0); // Most recent 3
            const older = sessions.slice(3, 6); // Previous 3 — no overlap

            if (older.length === 0 || recentScores.length === 0) return;

            const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
            const olderAvg = older.reduce((sum, s) => sum + (s.skills[skillId] || 0), 0) / older.length;

            if (olderAvg === 0) return;

            const change = ((recentAvg - olderAvg) / olderAvg) * 100;

            trends.push({
                skill: skillId,
                trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
                recentScores,
                change: Math.round(change * 10) / 10,
            });
        });

        return trends;
    }
}

// Export singleton instance
let storeInstance: SupabaseProgressStore | null = null;
export function getProgressStore(): SupabaseProgressStore {
    if (!storeInstance) {
        storeInstance = new SupabaseProgressStore();
    }
    return storeInstance;
}
