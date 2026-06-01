/**
 * @codesage
 * @description Tests for the mode assessment configuration mappings.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 * @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { MODE_ASSESSMENT_CONFIGS } from '../mode-assessment-config';

describe('MODE_ASSESSMENT_CONFIGS', () => {
    it('provides correct configuration for practice mode', () => {
        const config = MODE_ASSESSMENT_CONFIGS['practice'];
        expect(config.contextBlock).toBeDefined();
        expect(config.strictnessNote).toBeDefined();
        expect(config.feedbackTone).toContain('Professional and direct');
    });

    it('adds time efficiency dimension in crunch mode', () => {
        expect(MODE_ASSESSMENT_CONFIGS['crunch'].bonusDimension?.id).toBe('time-efficiency');
    });

    it('enforces employer strictness', () => {
        expect(MODE_ASSESSMENT_CONFIGS['employer'].includeHireDecision).toBe(true);
        expect(MODE_ASSESSMENT_CONFIGS['employer'].feedbackTone).toContain('Completely objective');
    });
});
