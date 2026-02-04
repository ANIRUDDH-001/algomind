import { getSupabase } from './client';
import { SessionHistory, UserProgress, SkillTrend, CognitiveSkill } from '@/types/assessment';

// Map from our app skill IDs to database column names
const SKILL_ID_MAP: Record<CognitiveSkill, string> = {
    'problem-decomposition': 'problem_decomposition',
    'pattern-recognition': 'pattern_recognition',
    'algorithmic-thinking': 'algorithmic_thinking',
    'complexity-analysis': 'complexity_analysis',
    'communication-clarity': 'communication_clarity',
    'edge-case-awareness': 'edge_case_handling',
    'optimization-mindset': 'debugging_skills', // Map optimization to debugging column
    'debugging-approach': 'code_quality',        // Map debugging to code quality column
};

const COLUMN_TO_SKILL_ID: Record<string, CognitiveSkill> = {
    'problem_decomposition': 'problem-decomposition',
    'pattern_recognition': 'pattern-recognition',
    'algorithmic_thinking': 'algorithmic-thinking',
    'complexity_analysis': 'complexity-analysis',
    'communication_clarity': 'communication-clarity',
    'edge_case_handling': 'edge-case-awareness',
    'debugging_skills': 'optimization-mindset',
    'code_quality': 'debugging-approach',
};

const SKILL_COLUMNS = Object.keys(COLUMN_TO_SKILL_ID);

const ALL_SKILLS: CognitiveSkill[] = [
    'problem-decomposition',
    'pattern-recognition',
    'algorithmic-thinking',
    'complexity-analysis',
    'communication-clarity',
    'edge-case-awareness',
    'optimization-mindset',
    'debugging-approach',
];

const DEFAULT_SKILLS: Record<CognitiveSkill, number> = {
    'problem-decomposition': 0,
    'pattern-recognition': 0,
    'algorithmic-thinking': 0,
    'complexity-analysis': 0,
    'communication-clarity': 0,
    'edge-case-awareness': 0,
    'optimization-mindset': 0,
    'debugging-approach': 0,
};

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
        // Insert interview session
        const { data: sessionData, error: sessionError } = await this.supabase
            .from('interview_sessions')
            .insert({
                id: session.sessionId,
                user_id: userId,
                problem_id: session.problemId,
                problem_title: session.problemId,
                problem_difficulty: session.problemDifficulty,
                duration: session.duration,
                status: 'completed',
                completed_at: session.timestamp.toISOString(),
            })
            .select()
            .single();

        if (sessionError) {
            console.error('Failed to save session:', sessionError);
            throw sessionError;
        }

        // Convert skill IDs to column names
        const skillColumns: Record<string, number> = {};
        ALL_SKILLS.forEach((skillId) => {
            const columnName = SKILL_ID_MAP[skillId];
            if (columnName && session.skills[skillId] != null) {
                skillColumns[columnName] = session.skills[skillId];
            }
        });

        // Insert assessment
        const { error: assessmentError } = await this.supabase
            .from('assessments')
            .insert({
                session_id: sessionData.id,
                user_id: userId,
                ...skillColumns,
                overall_score: session.overallScore,
                skill_evidence: assessment?.skillEvidence || {},
                overall_feedback: assessment?.overallFeedback || '',
                next_steps: assessment?.nextSteps || [],
                model_used: assessment?.modelUsed || 'unknown',
                confidence: assessment?.confidence || 0.8,
            });

        if (assessmentError) {
            console.error('Failed to save assessment:', assessmentError);
            throw assessmentError;
        }
    }

    async getUserProgress(userId: string): Promise<UserProgress | null> {
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
        assessments (
          problem_decomposition,
          pattern_recognition,
          algorithmic_thinking,
          complexity_analysis,
          communication_clarity,
          edge_case_handling,
          debugging_skills,
          code_quality,
          overall_score
        )
      `)
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false });

        if (error) {
            console.error('Failed to get user progress:', error);
            return null;
        }

        if (!sessions || sessions.length === 0) {
            return {
                userId,
                sessions: [],
                trends: [],
                totalSessions: 0,
                averageScore: 0,
                averageScores: { ...DEFAULT_SKILLS },
                lastUpdated: new Date(),
            };
        }

        // Transform sessions
        const transformedSessions: SessionHistory[] = sessions.map((s: any) => {
            const assessment = s.assessments?.[0] || {};
            const skills: Record<CognitiveSkill, number> = { ...DEFAULT_SKILLS };

            SKILL_COLUMNS.forEach((col) => {
                const skillId = COLUMN_TO_SKILL_ID[col];
                if (skillId && assessment[col] != null) {
                    skills[skillId] = Number(assessment[col]);
                }
            });

            return {
                sessionId: s.id,
                userId,
                problemId: s.problem_id,
                problemDifficulty: s.problem_difficulty || 'medium',
                timestamp: new Date(s.completed_at),
                duration: s.duration || 0,
                skills,
                overallScore: Number(assessment.overall_score) || 0,
            };
        });

        // Calculate averages from last 5 sessions
        const recentSessions = transformedSessions.slice(0, 5);
        const averageScores: Record<CognitiveSkill, number> = { ...DEFAULT_SKILLS };

        ALL_SKILLS.forEach((skillId) => {
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
            averageScore: avgScore,
            averageScores,
            lastUpdated: new Date(),
        };
    }

    private calculateTrends(sessions: SessionHistory[]): SkillTrend[] {
        if (sessions.length < 2) return [];

        const trends: SkillTrend[] = [];

        ALL_SKILLS.forEach((skillId) => {
            const recentScores = sessions.slice(0, 5).map((s) => s.skills[skillId] || 0);
            const older = sessions.slice(3, 6);

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
