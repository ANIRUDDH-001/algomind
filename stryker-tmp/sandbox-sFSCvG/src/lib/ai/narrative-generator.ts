/**
 * narrative-generator.ts
 *
 * Runs after a user completes their FIRST interview session.
 * Generates a short (~100 word) baseline profile narrative based on the results
 * of that initial assessment.
 */
// @ts-nocheck


import { UnifiedAIClient } from './client';
import { getServiceClient } from '../supabase/service';
import { SKILL_DEFINITIONS } from '../assessment/skill-registry';
import type { SessionData } from './memory-generator';

const dbKeyToSkillId = (dbKey: string): string => dbKey.replace(/_/g, '-');

function getWeakSkills(skills: Record<string, number>): string {
    const bottom2 = Object.entries(skills)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 2)
        .map(([id]) => SKILL_DEFINITIONS[dbKeyToSkillId(id) as keyof typeof SKILL_DEFINITIONS]?.name ?? id);
    return bottom2.join(', ') || 'N/A';
}

function getStrongSkills(skills: Record<string, number>): string {
    const top2 = Object.entries(skills)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([id]) => SKILL_DEFINITIONS[dbKeyToSkillId(id) as keyof typeof SKILL_DEFINITIONS]?.name ?? id);
    return top2.join(', ') || 'N/A';
}

export async function generateSession1Baseline(params: {
    userId: string;
    session: SessionData;
}): Promise<string | null> {
    const { session } = params;

    try {
        const promptContent =
            `A technical interview student just completed their FIRST diagnostic session.\n` +
            `Problem: ${session.problemTitle} (${session.problemDifficulty})\n` +
            `Overall Score: ${session.overallScore.toFixed(1)}/10\n` +
            `Strongest skills: ${getStrongSkills(session.skills)}\n` +
            `Weakest skills: ${getWeakSkills(session.skills)}\n\n` +
            `Write a 100-word baseline profile narrative about this student (in third person "This student...").\n` +
            `Summarize their performance, highlight their primary strength and primary weakness, and state the main area of focus for their next session.\n` +
            `Keep it professional, encouraging, and highly specific. Output only the narrative prose.`;

        const client = new UnifiedAIClient();
        const result = await client.generateCompletion(
            [{ role: 'user', content: promptContent }],
            {
                preferredProvider: 'groq',
                maxTokens: 200,
                temperature: 0.3,
            }
        );

        if (result.success && result.response) {
            return result.response.trim();
        }

        return null;
    } catch (err) {
        console.error('[narrative-generator] Unexpected error generating Session 1 baseline:', err);
        return null;
    }
}

/**
 * Server-only function that generates the baseline and saves it to learner_profiles.
 */
export async function createAndSaveSession1Baseline(userId: string, session: SessionData): Promise<void> {
    const supabase = getServiceClient();

    // Check if narrative already exists before overwriting
    const { data: profile } = await supabase
        .from('learner_profiles')
        .select('narrative_session_1')
        .eq('user_id', userId)
        .maybeSingle();

    if (profile && profile.narrative_session_1) {
        return; // Already exists, idempotency check
    }

    const narrative = await generateSession1Baseline({ userId, session });

    if (narrative) {
        const { error } = await supabase
            .from('learner_profiles')
            .upsert(
                {
                    user_id: userId,
                    narrative_session_1: narrative,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            console.error('[narrative-generator] Failed to save baseline:', error.message);
        } else {
            console.log(`📝 [narrative-generator] Generated Session 1 baseline for user ${userId.slice(0, 8)}`);
        }
    }
}
