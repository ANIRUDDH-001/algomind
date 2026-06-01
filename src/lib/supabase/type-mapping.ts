/**
 * @codesage
 * @file      src/lib/supabase/type-mapping.ts
 * @purpose   Maps TypeScript application types to Supabase database column names.
 * @tech      TypeScript
 * @connects  Imports CognitiveSkill from @/types/assessment, exported for use in database queries.
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { CognitiveSkill } from '@/types/assessment';

// Map TypeScript types to database columns
export const SKILL_TO_DB_COLUMN: Record<CognitiveSkill, string> = {
    'problem-decomposition': 'problem_decomposition',
    'pattern-recognition': 'pattern_recognition',
    'algorithmic-thinking': 'algorithmic_thinking',
    'complexity-analysis': 'complexity_analysis',
    'communication-clarity': 'communication_clarity',
    'edge-case-awareness': 'edge_case_awareness',
    'optimization-mindset': 'optimization_mindset',
    'debugging-approach': 'debugging_approach',
};

// Reverse mapping
export const DB_COLUMN_TO_SKILL: Record<string, CognitiveSkill> = Object.fromEntries(
    Object.entries(SKILL_TO_DB_COLUMN).map(([k, v]) => [v, k as CognitiveSkill])
) as Record<string, CognitiveSkill>;

// All cognitive skills list
export const ALL_COGNITIVE_SKILLS: CognitiveSkill[] = [
    'problem-decomposition',
    'pattern-recognition',
    'algorithmic-thinking',
    'complexity-analysis',
    'communication-clarity',
    'edge-case-awareness',
    'optimization-mindset',
    'debugging-approach',
];

// Default skill scores (0 for all)
export const DEFAULT_SKILL_SCORES: Record<CognitiveSkill, number> = {
    'problem-decomposition': 0,
    'pattern-recognition': 0,
    'algorithmic-thinking': 0,
    'complexity-analysis': 0,
    'communication-clarity': 0,
    'edge-case-awareness': 0,
    'optimization-mindset': 0,
    'debugging-approach': 0,
};

// Convert TypeScript skill object to DB format
export function skillsToDbFormat(skills: Record<CognitiveSkill, number>): Record<string, number> {
    const dbFormat: Record<string, number> = {};
    Object.entries(skills).forEach(([skill, score]) => {
        const dbColumn = SKILL_TO_DB_COLUMN[skill as CognitiveSkill];
        if (dbColumn) {
            dbFormat[dbColumn] = score;
        }
    });
    return dbFormat;
}

// Convert DB format back to TypeScript
export function dbToSkillsFormat(dbData: Record<string, number | null>): Record<CognitiveSkill, number> {
    const skills: Record<CognitiveSkill, number> = { ...DEFAULT_SKILL_SCORES };
    Object.entries(dbData).forEach(([column, score]) => {
        const skill = DB_COLUMN_TO_SKILL[column];
        if (skill && score != null) {
            skills[skill] = Number(score);
        }
    });
    return skills;
}

// Get all DB column names
export const ALL_DB_COLUMNS = Object.values(SKILL_TO_DB_COLUMN);
