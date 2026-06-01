/**
 * @codesage
 * @file      src/lib/__tests__/design-tokens.test.ts
 * @purpose   Tests for Defines shared design tokens and animations.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { COLORS, SPRING, ANIM, staggerChildren } from '../design-tokens';
import { SKILL_DEFINITIONS } from '../assessment/skill-registry';

describe('Design Tokens', () => {
    describe('COLORS', () => {
        it('chart array has exactly 8 entries containing valid hex strings', () => {
            expect(COLORS.chart).toHaveLength(8);
            COLORS.chart.forEach(color => {
                expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
            });
        });

        it('skills object contains exactly 8 keys matching SKILL_DEFINITIONS', () => {
            const skillKeys = Object.keys(COLORS.skills);
            const definedKeys = Object.keys(SKILL_DEFINITIONS);

            expect(skillKeys).toHaveLength(8);
            expect(skillKeys.sort()).toEqual(definedKeys.sort());
        });

        it('accent has primary, secondary, glow, glowHi', () => {
            expect(COLORS.accent).toHaveProperty('primary');
            expect(COLORS.accent).toHaveProperty('secondary');
            expect(COLORS.accent).toHaveProperty('glow');
            expect(COLORS.accent).toHaveProperty('glowHi');
        });

        it('difficulty has easy, medium, hard with exact values', () => {
            expect(COLORS.difficulty).toEqual({
                easy: '#10b981',
                medium: '#f59e0b',
                hard: '#ef4444',
            });
        });
    });

    describe('SPRING Transitions', () => {
        it('gentle, bouncy, stiff, slow all have type: spring, stiffness, damping', () => {
            const springNames = ['gentle', 'bouncy', 'stiff', 'slow'] as const;

            springNames.forEach(name => {
                const spring = SPRING[name];
                expect(spring).toHaveProperty('type', 'spring');
                expect(spring).toHaveProperty('stiffness');
                expect(typeof spring.stiffness).toBe('number');
                expect(spring).toHaveProperty('damping');
                expect(typeof spring.damping).toBe('number');
            });
        });

        it('contains no NaN values', () => {
            Object.values(SPRING).forEach(spring => {
                expect(Number.isNaN(spring.stiffness)).toBe(false);
                expect(Number.isNaN(spring.damping)).toBe(false);
            });
        });
    });

    describe('ANIM Object', () => {
        it('has exactly 5 distinct animations', () => {
            const animKeys = Object.keys(ANIM);
            expect(animKeys).toEqual(
                expect.arrayContaining(['fadeUp', 'fadeIn', 'scaleIn', 'slideLeft', 'slideRight'])
            );
            expect(animKeys).toHaveLength(5);
        });

        it('all animations have initial, animate, exit definitions', () => {
            Object.values(ANIM).forEach(anim => {
                expect(anim).toHaveProperty('initial');
                expect(anim).toHaveProperty('animate');
                expect(anim).toHaveProperty('exit');
            });
        });

        it('contains no undefined values in the config', () => {
            Object.values(ANIM).forEach(anim => {
                Object.values(anim).forEach(state => {
                    Object.values(state).forEach(val => {
                        expect(val).toBeDefined();
                    });
                });
            });
        });
    });

    describe('staggerChildren function', () => {
        it('returns proper transition object with default parameters', () => {
            const result = staggerChildren();
            expect(result).toEqual({
                animate: {
                    transition: { staggerChildren: 0.07, delayChildren: 0 }
                }
            });
        });

        it('applies custom values properly', () => {
            const result = staggerChildren(0.5, 0.2);
            expect(result).toEqual({
                animate: {
                    transition: { staggerChildren: 0.5, delayChildren: 0.2 }
                }
            });
        });
    });
});
