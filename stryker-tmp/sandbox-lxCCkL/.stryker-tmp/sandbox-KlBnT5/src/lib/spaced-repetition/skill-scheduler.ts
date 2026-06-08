/**
 * @codesage
 * @file      src/lib/spaced-repetition/skill-scheduler.ts
 * @purpose   Spaced repetition algorithms (FSRS, SM2) and scheduling queues.
 * @tech      Node.js, ts-fsrs
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/**
 * skill-scheduler.ts
 *
 * Determines which skill FSRS cards are due and maps them to
 * problem recommendations via the `problems.tags` array.
 *
 * Used by: insight-engine.ts to generate skill-based recommendations
 * Used by: ReviewQueueWidget.tsx to show due skill problems
 */

import { getSupabase } from '@/lib/supabase/client';

// Map skill_id to problem tags that exercise that skill
export const SKILL_TO_PROBLEM_TAGS: Record<string, string[]> = {
    'problem-decomposition': ['recursion', 'trees', 'graphs', 'backtracking', 'divide-and-conquer'],
    'pattern-recognition': ['sliding-window', 'two-pointer', 'hashing', 'prefix-sum'],
    'algorithmic-thinking': ['sorting', 'greedy', 'binary-search', 'intervals'],
    'complexity-analysis': ['recursion', 'dynamic-programming', 'graphs', 'trees'],
    'edge-case-awareness': ['arrays', 'strings', 'math', 'bit-manipulation'],
    'optimization-mindset': ['dynamic-programming', 'heap', 'greedy', 'memoization'],
    'debugging-approach': ['arrays', 'strings', 'linked-list', 'pointers'],
    'communication-clarity': ['arrays', 'recursion', 'strings'],
};

export interface DueSkill {
    skillId: string;
    skillName: string;
    daysOverdue: number;
    lastScore: number | null;
    suggestedTags: string[];
}

export async function getDueSkills(userId: string): Promise<DueSkill[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data } = await supabase
        .from('skill_repetition')
        .select('skill_id, fsrs_due, last_score')
        .eq('user_id', userId)
        .lte('fsrs_due', new Date().toISOString());

    if (!data) return [];

    return data.map((row) => ({
        skillId: row.skill_id,
        skillName: formatSkillName(row.skill_id),
        daysOverdue: Math.floor(
            (Date.now() - new Date(row.fsrs_due).getTime()) / 86_400_000
        ),
        lastScore: row.last_score,
        suggestedTags: SKILL_TO_PROBLEM_TAGS[row.skill_id] ?? [],
    }));
}

export function formatSkillName(skillId: string): string {
    return skillId
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
