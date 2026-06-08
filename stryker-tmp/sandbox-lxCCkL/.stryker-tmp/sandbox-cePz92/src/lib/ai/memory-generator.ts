/**
 * memory-generator.ts
 *
 * Generates and persists a short coaching memory snapshot after each interview
 * session. Kai reads this snapshot at the start of future sessions so it can
 * "remember" the user's strengths, weaknesses, and communication style.
 *
 * Server-side only (updateKaiMemory uses the service-role Supabase client).
 */
// @ts-nocheck

// 


import { UnifiedAIClient } from './client';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { getServiceClient } from '@/lib/supabase/service';
import type { KaiMemoryStructured } from '@/types/kai-memory';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionData {
    sessionId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    overallScore: number;
    /** skill_id → score (0-10) */
    skills: Record<string, number>;
    completedAt: string;
}

/** Raw row shape returned by the get_user_sessions_with_assessment RPC */
interface RpcSessionRow {
    session_id: string;
    problem_id: string;
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
}

/** Shape of a learner_profiles row (only the columns we need) */
interface LearnerProfileRow {
    kai_memory: string | null;
    kai_memory_structured: KaiMemoryStructured | null;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/** Maps a snake_case DB key to the dash-case skill id used in SKILL_DEFINITIONS */
const dbKeyToSkillId = (dbKey: string): string => dbKey.replace(/_/g, '-');

/**
 * Returns a comma-separated string of the display names of the two skills
 * with the lowest scores.
 */
function getWeakSkills(skills: Record<string, number>): string {
    const bottom2 = Object.entries(skills)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 2)
        .map(([id]) => SKILL_DEFINITIONS[dbKeyToSkillId(id) as keyof typeof SKILL_DEFINITIONS]?.name ?? id);
    return bottom2.join(', ') || 'N/A';
}

/**
 * Returns a comma-separated string of the display names of the two skills
 * with the highest scores.
 */
function getStrongSkills(skills: Record<string, number>): string {
    const top2 = Object.entries(skills)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([id]) => SKILL_DEFINITIONS[dbKeyToSkillId(id) as keyof typeof SKILL_DEFINITIONS]?.name ?? id);
    return top2.join(', ') || 'N/A';
}


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls the AI to generate (or refresh) a coaching memory note.
 *
 * Never throws — returns `existingMemory ?? ''` on any failure.
 */
export async function generateKaiMemory(params: {
    userId: string;
    recentSessions: SessionData[];
    existingMemory: string | null;
}): Promise<string> {
    const { recentSessions, existingMemory } = params;

    const fallback = existingMemory ?? '';

    if (recentSessions.length === 0) return fallback;

    try {
        const sessionLines = recentSessions
            .slice(0, 5)
            .map(
                (s) =>
                    `${s.problemTitle} (${s.problemDifficulty}): overall ${s.overallScore.toFixed(1)}/10, ` +
                    `weak: ${getWeakSkills(s.skills)}, strong: ${getStrongSkills(s.skills)}`
            )
            .join('\n');

        const promptContent =
            `Update this coaching memory snapshot for a technical interview student.\n` +
            `Max 200 tokens output. Write in third person ("This student...").\n\n` +
            `Previous memory: ${existingMemory ?? 'None - first session'}\n\n` +
            `Recent sessions (newest first):\n${sessionLines}\n\n` +
            `Output a memory note covering:\n` +
            `1. Top strength (one cognitive skill, specific pattern observed)\n` +
            `2. Main weakness (one skill, specific failure mode)\n` +
            `3. Communication style (verbose/concise, technical/conversational)\n` +
            `4. One specific thing to probe next session\n\n` +
            `Be specific. No filler phrases. Max 200 tokens.`;

        const client = new UnifiedAIClient();
        const result = await client.generateCompletion(
            [{ role: 'user', content: promptContent }],
            {
                preferredProvider: 'groq',
                maxTokens: 250,
                temperature: 0.5,
            }
        );

        if (result.success && result.response) {
            return result.response.trim();
        }

        console.warn('[memory-generator] AI generation failed:', result.error);
        return fallback;
    } catch (err) {
        console.error('[memory-generator] Unexpected error in generateKaiMemory:', err);
        return fallback;
    }
}

export async function generateStructuredKaiMemory(params: {
    userId: string;
    recentSessions: SessionData[];
    existingMemory: KaiMemoryStructured | null;
}): Promise<KaiMemoryStructured | null> {
    const { recentSessions, existingMemory } = params;

    if (recentSessions.length === 0) return existingMemory;

    try {
        const sessionLines = recentSessions
            .slice(0, 5)
            .map(
                (s) =>
                    `${s.problemTitle} (${s.problemDifficulty}): overall ${s.overallScore.toFixed(1)}/10, ` +
                    `weak: ${getWeakSkills(s.skills)}, strong: ${getStrongSkills(s.skills)}`
            )
            .join('\n');

        const promptContent =
            `Update the coaching memory snapshot for a technical interview student.\n` +
            `Output ONLY valid JSON matching this schema:\n` +
            `{\n` +
            `  "topStrength": { "skill": "<cognitive_skill_id>", "evidence": "<specific pattern> (max 15 words)" },\n` +
            `  "mainWeakness": { "skill": "<cognitive_skill_id>", "evidence": "<specific failure mode> (max 15 words)" },\n` +
            `  "communicationStyle": "analytical" | "conversational" | "terse" | "verbose" | "structured",\n` +
            `  "focusForNextSession": "<one specific thing to probe> (max 15 words)"\n` +
            `}\n\n` +
            `Previous memory: ${existingMemory ? JSON.stringify(existingMemory) : 'None'}\n\n` +
            `Recent sessions:\n${sessionLines}\n\n` +
            `Make the evidence specific. No filler.`;

        const client = new UnifiedAIClient();
        const result = await client.generateCompletion(
            [{ role: 'user', content: promptContent }],
            {
                preferredProvider: 'groq',
                maxTokens: 300,
                temperature: 0.1,
            }
        );

        if (result.success && result.response) {
            const clean = result.response.replace(/```json|```/gi, '').trim();
            return JSON.parse(clean) as KaiMemoryStructured;
        }

        console.warn('[memory-generator] AI generation failed:', result.error);
        return existingMemory;
    } catch (err) {
        console.error('[memory-generator] Unexpected error in generateStructuredKaiMemory:', err);
        return existingMemory;
    }
}

export function structuredToText(structured: KaiMemoryStructured): string {
    return `This student's top strength is ${structured.topStrength.skill} (${structured.topStrength.evidence}). ` +
        `Their main weakness is ${structured.mainWeakness.skill} (${structured.mainWeakness.evidence}). ` +
        `They communicate in a ${structured.communicationStyle} style. ` +
        `Next session focus: ${structured.focusForNextSession}.`;
}

/**
 * Fetches the user's last 5 sessions via the RPC, generates a new memory
 * snapshot, then upserts it into `learner_profiles`.
 *
 * Server-side only. Never throws.
 */
export async function updateKaiMemory(userId: string): Promise<void> {
    try {
        const supabase = getServiceClient();

        // a. Fetch last 5 sessions
        const { data: rpcRows, error: rpcError } = await supabase.rpc(
            'get_user_sessions_with_assessment',
            { p_user_id: userId, p_limit: 5 }
        );

        if (rpcError) {
            console.error('[memory-generator] RPC error fetching sessions:', rpcError.message);
            return;
        }

        const rows = (rpcRows ?? []) as RpcSessionRow[];

        const recentSessions: SessionData[] = rows.map((row) => ({
            sessionId: row.session_id,
            problemTitle: row.problem_id,
            problemDifficulty: 'medium', // RPC doesn't return difficulty; default to medium
            overallScore: Number(row.overall_score),
            completedAt: row.completed_at,
            skills: {
                'problem-decomposition': Number(row.problem_decomposition),
                'pattern-recognition': Number(row.pattern_recognition),
                'algorithmic-thinking': Number(row.algorithmic_thinking),
                'complexity-analysis': Number(row.complexity_analysis),
                'communication-clarity': Number(row.communication_clarity),
                'edge-case-awareness': Number(row.edge_case_awareness),
                'optimization-mindset': Number(row.optimization_mindset),
                'debugging-approach': Number(row.debugging_approach),
            },
        }));

        // b. Fetch existing memory
        const { data: profileData, error: profileError } = await supabase
            .from('learner_profiles')
            .select('kai_memory, kai_memory_structured')
            .eq('user_id', userId)
            .maybeSingle();

        if (profileError) {
            console.error('[memory-generator] Error fetching learner_profiles:', profileError.message);
        }

        const profile = profileData as LearnerProfileRow | null;
        const existingStructured = profile?.kai_memory_structured ?? null;

        // c. Generate memory with AI
        const newStructuredMemory = await generateStructuredKaiMemory({
            userId,
            recentSessions,
            existingMemory: existingStructured
        });

        if (!newStructuredMemory) return;

        // d. Generate text fallback
        const newTextMemory = structuredToText(newStructuredMemory);

        // e. Upsert into learner_profiles
        const { error: upsertError } = await supabase
            .from('learner_profiles')
            .upsert(
                {
                    user_id: userId,
                    kai_memory: newTextMemory,
                    kai_memory_structured: newStructuredMemory,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            );

        if (upsertError) {
            console.error('[memory-generator] DB upsert error:', upsertError.message);
        } else {
            console.log(`🧠 [memory-generator] Updated structured Kai memory for user ${userId.slice(0, 8)}...`);
        }
    } catch (err) {
        console.error('[memory-generator] Unexpected error in updateKaiMemory:', err);
    }
}
