/**
 * @codesage
 * @file      src/lib/assessment/progress-store.ts
 * @purpose   Manages local storage persistence of interview session history and progress
 * @tech      localStorage
 * @connects  imports CognitiveSkill, SKILL_DEFINITIONS
 * @apis      None
 * @db        localStorage (algomind_progress_*)
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { CognitiveSkill } from '@/types/assessment';
import { SKILL_DEFINITIONS } from './skill-registry';

export interface SessionHistory {
    sessionId: string;
    userId: string;
    problemId: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    timestamp: Date;
    duration: number; // seconds
    skills: Record<CognitiveSkill, number>;
    overallScore: number; // weighted average
    transcript?: { role: string; content: string }[]; // conversation history
}

export interface SkillTrend {
    skill: CognitiveSkill;
    trend: 'improving' | 'stable' | 'declining';
    recentScores: number[];
    change: number;
}

export interface UserProgressOverview {
    userId: string;
    totalSessions: number;
    averageScores: Record<CognitiveSkill, number>;
    trends: SkillTrend[];
    lastUpdated: Date;
}

export class ProgressStore {
    private readonly MAX = 50;
    private readonly STORAGE = 'algomind_progress_';

    async saveSession(session: SessionHistory): Promise<void> {
        const key = `${this.STORAGE}${session.userId}`;

        try {
            const existingData = this.getRawProgress(session.userId);
            const updatedSessions = [session, ...existingData].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            const pruned = this.pruneOldSessions(updatedSessions);
            localStorage.setItem(key, JSON.stringify(pruned));
        } catch (error: unknown) {
            if ((error as any).name === 'QuotaExceededError') {
                console.warn("Storage quota exceeded. Forcing prune and retrying.");
                this.forceClearOldest(session.userId);
                return this.saveSession(session);
            }
            throw error;
        }
    }

    async getUserHistory(userId: string): Promise<SessionHistory[]> {
        return this.getRawProgress(userId).map(s => ({
            ...s,
            timestamp: new Date(s.timestamp)
        }));
    }

    private getRawProgress(userId: string): SessionHistory[] {
        const key = `${this.STORAGE}${userId}`;
        const data = localStorage.getItem(key);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    private pruneOldSessions(sessions: SessionHistory[]): SessionHistory[] {
        if (sessions.length <= this.MAX) return sessions;
        return sessions.slice(0, this.MAX);
    }

    private forceClearOldest(userId: string): void {
        const sessions = this.getRawProgress(userId);
        if (sessions.length > 10) {
            const pruned = sessions.slice(0, Math.floor(sessions.length / 2));
            localStorage.setItem(`${this.STORAGE}${userId}`, JSON.stringify(pruned));
        } else {
            localStorage.removeItem(`${this.STORAGE}${userId}`);
        }
    }

    getStorageSize(userId: string): number {
        const data = localStorage.getItem(`${this.STORAGE}${userId}`);
        return data ? new Blob([data]).size : 0;
    }

    calculateWeightedScore(skills: Record<CognitiveSkill, number>): number {
        let totalScore = 0;
        let totalWeight = 0;

        Object.entries(skills).forEach(([skillId, score]) => {
            const weight = SKILL_DEFINITIONS[skillId as CognitiveSkill]?.weight || 0;
            totalScore += score * weight;
            totalWeight += weight;
        });

        return totalWeight === 0 ? 0 : Math.round((totalScore / totalWeight) * 10) / 10;
    }
}
