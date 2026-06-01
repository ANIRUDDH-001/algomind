/**
 * @codesage
 * @file      src/lib/assessment/__tests__/skill-registry.test.ts
 * @purpose   Unit tests for assessment module
 * @tech      vitest
 * @connects  various
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { SKILL_DEFINITIONS } from '../skill-registry';
import { CognitiveSkill } from '@/types/assessment';

describe('skill registry sub-criteria', () => {
    it('1. all 8 skills have exactly 3-4 sub-criteria', () => {
        const skills = Object.keys(SKILL_DEFINITIONS) as CognitiveSkill[];
        expect(skills).toHaveLength(8);
        for (const skill of skills) {
            const sc = SKILL_DEFINITIONS[skill].subCriteria;
            expect(sc).toBeDefined();
            expect(sc.length).toBeGreaterThanOrEqual(3);
            expect(sc.length).toBeLessThanOrEqual(4);
        }
    });

    it('2. sub-criteria weights sum to 1.0 per skill (within 0.001 tolerance)', () => {
        for (const def of Object.values(SKILL_DEFINITIONS)) {
            const sum = def.subCriteria.reduce((acc, sc) => acc + sc.weight, 0);
            expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
        }
    });

    it('3. all sub-criterion ids are unique within a skill', () => {
        for (const def of Object.values(SKILL_DEFINITIONS)) {
            const ids = def.subCriteria.map(sc => sc.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        }
    });

    it('4. no sub-criterion id is undefined or empty string', () => {
        for (const def of Object.values(SKILL_DEFINITIONS)) {
            for (const sc of def.subCriteria) {
                expect(sc.id).toBeDefined();
                expect(sc.id.trim()).not.toBe('');
            }
        }
    });
});
